import { AppError } from './errors.js';
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import { ReportSchema } from './schema.js';

export const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Production-tier model on Groq (Preview models may be removed at short notice).
export const DEFAULT_MODEL = 'openai/gpt-oss-120b';

const int = (v, d) => (Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : d);

export function llmConfig(env = {}) {
  return {
    model: env.GROQ_MODEL || DEFAULT_MODEL,
    timeoutMs: int(env.LLM_TIMEOUT_MS, 20_000),
    maxTokens: int(env.LLM_MAX_TOKENS, 6_000), // reasoning tokens count against this
    maxAttempts: 2, // one retry, only for invalid/unparseable output
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

class InvalidOutput extends Error {}

function buildBody(cfg, messages) {
  const body = {
    model: cfg.model,
    messages,
    response_format: { type: 'json_object' },
    max_completion_tokens: cfg.maxTokens,
    temperature: 0.4,
  };
  if (cfg.model.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low';
  if (cfg.model.startsWith('qwen/')) body.reasoning_format = 'hidden';
  return body;
}

async function callGroq({ cfg, apiKey, messages, fetchImpl }) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), cfg.timeoutMs);
  let res;
  try {
    res = await fetchImpl(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildBody(cfg, messages)),
      signal: ac.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new AppError('TIMEOUT', { detail: `groq timeout after ${cfg.timeoutMs}ms` });
    throw new AppError('UPSTREAM_ERROR', { detail: `groq unreachable: ${err?.name}`, cause: err });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }

  if (!res.ok) {
    const code = data?.error?.code || data?.error?.type || 'unknown';
    const detail = `groq ${res.status} ${code}`;
    if (res.status === 400 && code === 'json_validate_failed') throw new InvalidOutput(detail);
    if (res.status === 429) {
      throw new AppError('UPSTREAM_BUSY', { detail, retryAfter: int(res.headers?.get?.('retry-after'), undefined) });
    }
    if (res.status === 401 || res.status === 403 || res.status === 404 || code === 'model_decommissioned' || code === 'model_not_found') {
      throw new AppError('SERVICE_UNAVAILABLE', { detail });
    }
    throw new AppError('UPSTREAM_ERROR', { detail });
  }
  return data;
}

/**
 * Generate and validate a report. Retries once if the model returns invalid
 * JSON or JSON that fails the schema.
 * @returns {Promise<{ report: object, model: string, attempts: number, usage: {prompt:number, completion:number, total:number} }>}
 */
export async function generateReport({ input, env, fetchImpl = fetch }) {
  const cfg = llmConfig(env);
  const usage = { prompt: 0, completion: 0, total: 0 };
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserMessage(input) },
  ];

  let lastProblem = 'unknown';
  for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
    try {
      const data = await callGroq({ cfg, apiKey: env.GROQ_API_KEY, messages, fetchImpl });
      usage.prompt += data?.usage?.prompt_tokens ?? 0;
      usage.completion += data?.usage?.completion_tokens ?? 0;
      usage.total += data?.usage?.total_tokens ?? 0;

      const choice = data?.choices?.[0];
      if (choice?.finish_reason === 'length') throw new InvalidOutput('output truncated (finish_reason=length)');
      let parsed;
      try { parsed = parseModelJSON(choice?.message?.content); } catch (e) { throw new InvalidOutput(e.message); }
      const result = ReportSchema.safeParse(parsed);
      if (!result.success) {
        const first = result.error.issues[0];
        throw new InvalidOutput(`schema: ${first?.path.join('.')} ${first?.message}`);
      }
      return { report: result.data, model: cfg.model, attempts: attempt, usage };
    } catch (err) {
      if (!(err instanceof InvalidOutput)) {
        err.attempts = attempt;
        err.usage = usage;
        throw err;
      }
      lastProblem = err.message;
      messages.push({
        role: 'user',
        content: 'Your previous reply was not a valid JSON object matching the schema. Reply again with ONLY the JSON object.',
      });
    }
  }
  const e = new AppError('BAD_OUTPUT', { detail: lastProblem });
  e.attempts = cfg.maxAttempts;
  e.usage = usage;
  throw e;
}
