import { describe, expect, it } from 'vitest';
import { AppError } from '../server/errors.js';
import { DEFAULT_MODEL, GROQ_URL, generateReport, llmConfig, parseModelJSON } from '../server/llm.js';
import { SYSTEM_PROMPT } from '../server/prompt.js';
import fixture from './fixtures/report.json';
import { fetchSequence, groqOk, jsonResponse } from './helpers.js';

const env = { GROQ_API_KEY: 'test-key' };
const input = { skills: ['React', 'Python'], goal: 'AI Engineer', location: 'US' };

describe('parseModelJSON', () => {
  it('parses plain JSON', () => expect(parseModelJSON('{"a":1}')).toEqual({ a: 1 }));
  it('strips code fences', () => expect(parseModelJSON('```json\n{"a":1}\n```')).toEqual({ a: 1 }));
  it('strips <think> blocks', () => expect(parseModelJSON('<think>hmm {no}</think>\n{"a":1}')).toEqual({ a: 1 }));
  it('extracts JSON surrounded by prose', () => expect(parseModelJSON('Sure! {"a":{"b":2}} Hope this helps')).toEqual({ a: { b: 2 } }));
  it.each([undefined, '', 'no json here', '{"a":'])('throws on %j', (v) => expect(() => parseModelJSON(v)).toThrow());
});

describe('generateReport', () => {
  it('sends JSON mode, model from env default, capped tokens; returns validated report', async () => {
    const fetchImpl = fetchSequence(groqOk());
    const out = await generateReport({ input, env, fetchImpl });

    expect(out.attempts).toBe(1);
    expect(out.model).toBe(DEFAULT_MODEL);
    expect(out.usage).toEqual({ prompt: 500, completion: 1200, total: 1700 });
    expect(out.report.careerPaths).toHaveLength(2);
    expect(out.report).not.toHaveProperty('x_groq');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(GROQ_URL);
    const body = JSON.parse(init.body);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.model).toBe('openai/gpt-oss-120b');
    expect(body.messages[0].content).toBe(SYSTEM_PROMPT);
    expect(body.messages[1].content).toContain('"skills":["React","Python"]');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('honours GROQ_MODEL', async () => {
    const fetchImpl = fetchSequence(groqOk());
    await generateReport({ input, env: { ...env, GROQ_MODEL: 'qwen/qwen3.8-27b' }, fetchImpl });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.model).toBe('qwen/qwen3.8-27b');
    expect(body.reasoning_format).toBe('hidden');
  });

  it('retries once on invalid JSON, then succeeds', async () => {
    const fetchImpl = fetchSequence(groqOk('not json at all'), groqOk());
    const out = await generateReport({ input, env, fetchImpl });
    expect(out.attempts).toBe(2);
    expect(out.usage.total).toBe(3400);
    const retryMsgs = JSON.parse(fetchImpl.mock.calls[1][1].body).messages;
    expect(retryMsgs.at(-1).content).toMatch(/ONLY the JSON object/);
  });

  it('retries once on schema-invalid JSON', async () => {
    const fetchImpl = fetchSequence(groqOk('{"risingSkills": []}'), groqOk());
    expect((await generateReport({ input, env, fetchImpl })).attempts).toBe(2);
  });

  it('retries when Groq rejects with json_validate_failed', async () => {
    const fetchImpl = fetchSequence(jsonResponse(400, { error: { code: 'json_validate_failed' } }), groqOk());
    expect((await generateReport({ input, env, fetchImpl })).attempts).toBe(2);
  });

  it('treats truncated output as invalid', async () => {
    const fetchImpl = fetchSequence(groqOk(JSON.stringify(fixture), 'length'), groqOk());
    expect((await generateReport({ input, env, fetchImpl })).attempts).toBe(2);
  });

  it('gives up with BAD_OUTPUT after two invalid replies (no third call)', async () => {
    const fetchImpl = fetchSequence(groqOk('nope'), groqOk('still nope'), groqOk());
    await expect(generateReport({ input, env, fetchImpl })).rejects.toMatchObject({ code: 'BAD_OUTPUT', status: 502 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    [429, {}, 'UPSTREAM_BUSY', 503],
    [401, { error: { code: 'invalid_api_key' } }, 'SERVICE_UNAVAILABLE', 503],
    [404, { error: { code: 'model_not_found' } }, 'SERVICE_UNAVAILABLE', 503],
    [400, { error: { code: 'model_decommissioned' } }, 'SERVICE_UNAVAILABLE', 503],
    [400, { error: { code: 'invalid_request_error' } }, 'INTERNAL', 500],
    [413, { error: { code: 'request_too_large' } }, 'INTERNAL', 500],
    [500, {}, 'UPSTREAM_BUSY', 503],
    [503, null, 'UPSTREAM_BUSY', 503],
  ])('maps Groq %i to %s without retrying', async (status, body, code, httpStatus) => {
    const fetchImpl = fetchSequence(jsonResponse(status, body, { 'retry-after': '7' }), groqOk());
    const err = await generateReport({ input, env, fetchImpl }).catch(e => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code, status: httpStatus });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('times out after LLM_TIMEOUT_MS', async () => {
    const hang = (_url, init) => new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    const err = await generateReport({ input, env: { ...env, LLM_TIMEOUT_MS: '20' }, fetchImpl: fetchSequence(hang) }).catch(e => e);
    expect(err).toMatchObject({ code: 'TIMEOUT', status: 504 });
  });

  it('maps network failures to UPSTREAM_ERROR', async () => {
    const boom = async () => { throw new TypeError('fetch failed'); };
    await expect(generateReport({ input, env, fetchImpl: fetchSequence(boom) })).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });

  it('shows the model its bad reply and the reason when retrying', async () => {
    const fetchImpl = fetchSequence(groqOk('{"nodes": "nope"}'), groqOk());
    await generateReport({ input, env, fetchImpl });
    const msgs = JSON.parse(fetchImpl.mock.calls[1][1].body).messages;
    expect(msgs.at(-2)).toEqual({ role: 'assistant', content: '{"nodes": "nope"}' });
    expect(msgs.at(-1).content).toMatch(/schema/);
  });

  it('gives a truncated reply a larger token budget on retry', async () => {
    const cut = jsonResponse(200, { choices: [{ finish_reason: 'length', message: { content: '{"a":' } }], usage: {} });
    const fetchImpl = fetchSequence(cut, groqOk());
    await generateReport({ input, env, fetchImpl });
    const first = JSON.parse(fetchImpl.mock.calls[0][1].body).max_completion_tokens;
    const second = JSON.parse(fetchImpl.mock.calls[1][1].body).max_completion_tokens;
    expect(second).toBeGreaterThan(first);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).messages.at(-1).content).toMatch(/cut off/);
  });

  it('carries retry-after from a 429', async () => {
    const err = await generateReport({ input, env, fetchImpl: fetchSequence(jsonResponse(429, {}, { 'retry-after': '7' })) }).catch(e => e);
    expect(err).toMatchObject({ code: 'UPSTREAM_BUSY', retryAfter: 7 });
  });

  it('maps a 200 with a non-JSON body to UPSTREAM_ERROR', async () => {
    const res = { ok: true, status: 200, headers: new Headers(), json: async () => { throw new SyntaxError('bad'); } };
    await expect(generateReport({ input, env, fetchImpl: fetchSequence(res) })).rejects.toMatchObject({ code: 'UPSTREAM_ERROR' });
  });

  it('times out when the response body stalls (timer covers res.json)', async () => {
    const stall = (_url, init) => Promise.resolve({
      ok: true, status: 200, headers: new Headers(),
      json: () => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
    });
    const err = await generateReport({ input, env: { ...env, LLM_TIMEOUT_MS: '1000' }, fetchImpl: fetchSequence(stall) }).catch(e => e);
    expect(err).toMatchObject({ code: 'TIMEOUT', status: 504 });
  });

  it('does not start a retry once the overall deadline is spent', async () => {
    let t = 0;
    const now = () => t;
    const slowBad = async () => { t += 49_500; return groqOk('not json'); };
    const fetchImpl = fetchSequence(slowBad, groqOk());
    const err = await generateReport({ input, env, fetchImpl, now }).catch(e => e);
    expect(err).toMatchObject({ code: 'TIMEOUT' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('llmConfig', () => {
  it('clamps timeout and token budget into safe ranges', () => {
    expect(llmConfig({ LLM_TIMEOUT_MS: '999999', LLM_MAX_TOKENS: '999999' })).toMatchObject({ timeoutMs: 30_000, maxTokens: 12_000 });
    expect(llmConfig({ LLM_TIMEOUT_MS: '1', LLM_MAX_TOKENS: '1' })).toMatchObject({ timeoutMs: 1_000, maxTokens: 512 });
  });
});
