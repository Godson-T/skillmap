import { AppError } from './errors.js';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import { ReportSchema } from './schema.js';

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Production-tier model on Groq (Preview models may be removed at short notice).
export const DEFAULT_MODEL = 'openai/gpt-oss-120b';

const int = (v, d) => (Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : d);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// The analyze function has maxDuration 60s (vercel.json). Every attempt, including
// reading the response body, must finish inside this budget so the client gets a
// clean 504 instead of a platform kill.
export const OVERALL_DEADLINE_MS = 50_000;
const MAX_TOKENS_CEILING = 12_000;
const PRIOR_REPLY_CHARS = 4_000; // how much of a bad reply to echo back on retry

export function llmConfig(env = {}) {
  return {
    model: env.GROQ_MODEL || DEFAULT_MODEL,
    timeoutMs: clamp(int(env.LLM_TIMEOUT_MS, 20_000), 1_000, 30_000), // per attempt
    maxTokens: clamp(int(env.LLM_MAX_TOKENS, 6_000), 512, MAX_TOKENS_CEILING), // reasoning tokens count against this
    maxAttempts: 2, // one retry, only for invalid/unparseable/truncated output
    deadlineMs: OVERALL_DEADLINE_MS,
  };
}

/** Parse model text into JSON, tolerating code fences, <think> blocks and stray prose. */
export function parseModelJSON(content) {
  if (typeof content !== 'string' || !content.trim()) throw new Error('empty model output');
  let t = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error('model output is not JSON');
  }
}

class InvalidOutput extends Error {
  /** @param {string} message @param {{ reply?: string, truncated?: boolean }} [extra] */
  constructor(message, extra = {}) {
    super(message);
    this.reply = extra.reply;
    this.truncated = Boolean(extra.truncated);
  }
}

function buildBody(cfg, messages, maxTokens) {
  const body = {
    model: cfg.model,
    messages,
    response_format: { type: 'json_object' },
    max_completion_tokens: maxTokens,
    temperature: 0.4,
  };
  if (cfg.model.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low';
  if (cfg.model.startsWith('qwen/')) body.reasoning_format = 'hidden';
  return body;
}

/** One Groq call. The timeout covers the request AND the body read. */
async function callGroq({ cfg, apiKey, messages, maxTokens, timeoutMs, fetchImpl }) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const timedOut = () => new AppError('TIMEOUT', { detail: `groq timeout after ${timeoutMs}ms` });
  try {
    let res;
    try {
      res = await fetchImpl(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(buildBody(cfg, messages, maxTokens)),
        signal: ac.signal,
      });
    } catch (err) {
      if (ac.signal.aborted || err?.name === 'AbortError' || err?.name === 'TimeoutError') throw timedOut();
      throw new AppError('UPSTREAM_ERROR', { detail: `groq unreachable: ${err?.name}`, cause: err });
    }

    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      if (ac.signal.aborted || err?.name === 'AbortError') throw timedOut();
      /* non-JSON body: handled below by status */
    }

    if (!res.ok) {
      const code = data?.error?.code || data?.error?.type || 'unknown';
      const detail = `groq ${res.status} ${code}`;
      if (res.status === 400 && code === 'json_validate_failed') {
        throw new InvalidOutput(detail, { reply: data?.error?.failed_generation });
      }
      if (res.status === 429 || res.status === 498 || res.status >= 500) {
        // Provider overloaded or down: tell the user to try again shortly.
        throw new AppError('UPSTREAM_BUSY', { detail, retryAfter: int(res.headers?.get?.('retry-after'), undefined) });
      }
      if (res.status === 401 || res.status === 403 || res.status === 404 || code === 'model_decommissioned' || code === 'model_not_found') {
        throw new AppError('SERVICE_UNAVAILABLE', { detail });
      }
      // Remaining 4xx are request bugs on our side; retrying the same request will not help.
      throw new AppError('INTERNAL', { detail });
    }
    if (!data) throw new AppError('UPSTREAM_ERROR', { detail: `groq ${res.status} non-JSON body` });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function retryMessages(err) {
  const out = [];
  if (err.reply) out.push({ role: 'assistant', content: String(err.reply).slice(0, PRIOR_REPLY_CHARS) });
  out.push({
    role: 'user',
    content: err.truncated
      ? 'Your previous reply was cut off before the JSON object was complete. Reply again with ONLY the JSON object, and keep every text field short so it fits.'
      : `Your previous reply was not a valid JSON object matching the schema (${err.message}). Reply again with ONLY the JSON object, corrected.`,
  });
  return out;
}

/**
 * Generate and validate a report. Retries once if the model returns invalid
 * JSON or JSON that fails the schema.
 * @returns {Promise<{ report: object, model: string, attempts: number, usage: {prompt:number, completion:number, total:number} }>}
 */
export async function generateReport({ input, env, fetchImpl = fetch, now = Date.now }) {
  const cfg = llmConfig(env);
  const started = now();
  const usage = { prompt: 0, completion: 0, total: 0 };
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserMessage(input) },
  ];
  let maxTokens = cfg.maxTokens;

  const fail = (err, attempt) => {
    err.attempts = attempt;
    err.usage = usage;
    return err;
  };

  let lastProblem = 'unknown';
  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    const remaining = cfg.deadlineMs - (now() - started);
    if (remaining < 1_000) throw fail(new AppError('TIMEOUT', { detail: `deadline exhausted before attempt ${attempt}` }), attempt - 1);
    try {
      const data = await callGroq({
        cfg, apiKey: env.GROQ_API_KEY, messages, maxTokens, timeoutMs: Math.min(cfg.timeoutMs, remaining), fetchImpl,
      });
      usage.prompt += data?.usage?.prompt_tokens ?? 0;
      usage.completion += data?.usage?.completion_tokens ?? 0;
      usage.total += data?.usage?.total_tokens ?? 0;

      const choice = data?.choices?.[0];
      const content = choice?.message?.content;
      if (choice?.finish_reason === 'length') {
        throw new InvalidOutput('output truncated (finish_reason=length)', { truncated: true });
      }
      let parsed;
      try { parsed = parseModelJSON(content); } catch (e) { throw new InvalidOutput(e.message, { reply: content }); }
      const result = ReportSchema.safeParse(parsed);
      if (!result.success) {
        const first = result.error.issues[0];
        throw new InvalidOutput(`schema: ${first?.path.join('.')} ${first?.message}`, { reply: content });
      }
      return { report: result.data, model: cfg.model, attempts: attempt, usage };
    } catch (err) {
      if (!(err instanceof InvalidOutput)) throw fail(err, attempt);
      lastProblem = err.message;
      if (err.truncated) maxTokens = Math.min(MAX_TOKENS_CEILING, Math.round(maxTokens * 1.5));
      messages.push(...retryMessages(err));
    }
  }
  throw fail(new AppError('BAD_OUTPUT', { detail: lastProblem }), cfg.maxAttempts);
}
