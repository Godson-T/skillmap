import { describe, expect, it, vi } from 'vitest';
import { createDeps, handleAnalyze } from '../server/handler.js';
import { createRateLimiter } from '../server/rateLimit.js';
import { fetchSequence, groqOk, jsonResponse } from './helpers.js';

const ENV = { GROQ_API_KEY: 'sk-test-SECRET' };

function setup({ env = ENV, fetchImpl = fetchSequence(groqOk()), limiterEnv } = {}) {
  const logs = [];
  const logger = (level, event, fields) => logs.push({ level, event, ...fields });
  const deps = createDeps(env, {
    fetchImpl,
    logger,
    randomId: () => 'req-123',
    rateLimiter: createRateLimiter(limiterEnv ?? env, { fetchImpl: vi.fn(), logger }),
  });
  const call = (overrides = {}) => handleAnalyze({
    method: 'POST',
    headers: { host: 'skillmap.example', origin: 'https://skillmap.example', 'content-type': 'application/json' },
    body: { skills: 'React, Python', goal: 'AI Engineer', location: 'US' },
    ip: '203.0.113.9',
    ...overrides,
  }, deps);
  return { call, logs, fetchImpl };
}

describe('handleAnalyze — happy path', () => {
  it('returns the validated report, not the raw provider response', async () => {
    const { call } = setup();
    const out = await call();
    expect(out.status).toBe(200);
    expect(out.body.requestId).toBe('req-123');
    expect(out.body.report.risingSkills.length).toBeGreaterThan(0);
    expect(out.body.meta).toMatchObject({ model: 'openai/gpt-oss-120b', estimate: true });
    expect(out.body.meta.disclaimer).toMatch(/AI estimate/);
    const raw = JSON.stringify(out.body);
    expect(raw).not.toContain('choices');
    expect(raw).not.toContain('x_groq');
    expect(raw).not.toContain('usage');
    expect(out.headers['X-Request-Id']).toBe('req-123');
    expect(out.headers['Cache-Control']).toBe('no-store');
  });

  it('accepts a JSON string body (dev middleware path)', async () => {
    const { call } = setup();
    const out = await call({ body: JSON.stringify({ skills: 'Go' }) });
    expect(out.status).toBe(200);
  });

  it('logs latency and token counts but no skills, goal, prompt, IP or key', async () => {
    const { call, logs } = setup();
    await call({ body: { skills: 'SecretSkillXYZ', goal: 'Quant Developer', location: 'UK' } });
    const entry = logs.find(l => l.event === 'analyze');
    expect(entry).toMatchObject({
      requestId: 'req-123', status: 200, attempts: 1, promptTokens: 500, completionTokens: 1200, totalTokens: 1700,
      skillsCount: 1, location: 'UK', goalKind: 'custom', rateLimitBackend: 'memory',
    });
    expect(typeof entry.latencyMs).toBe('number');
    const line = JSON.stringify(logs);
    for (const secret of ['SecretSkillXYZ', 'Quant Developer', '203.0.113.9', 'sk-test-SECRET', 'career coach']) {
      expect(line).not.toContain(secret);
    }
  });
});

describe('handleAnalyze — request checks', () => {
  it('rejects non-POST methods', async () => {
    const out = await setup().call({ method: 'GET' });
    expect(out.status).toBe(405);
    expect(out.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('answers same-origin preflight and echoes the origin (never *)', async () => {
    const out = await setup().call({ method: 'OPTIONS' });
    expect(out.status).toBe(204);
    expect(out.headers['Access-Control-Allow-Origin']).toBe('https://skillmap.example');
  });

  it('blocks cross-origin browser requests not on the allow-list', async () => {
    const { call, fetchImpl } = setup();
    const out = await call({ headers: { host: 'skillmap.example', origin: 'https://evil.example' } });
    expect(out.status).toBe(403);
    expect(out.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('allows origins listed in ALLOWED_ORIGINS', async () => {
    const { call } = setup({ env: { ...ENV, ALLOWED_ORIGINS: 'https://partner.example, https://other.example' } });
    const out = await call({ headers: { host: 'api.example', origin: 'https://partner.example' } });
    expect(out.status).toBe(200);
    expect(out.headers['Access-Control-Allow-Origin']).toBe('https://partner.example');
  });

  it.each([
    ['malformed JSON string', '{"skills":', 'INVALID_JSON', 400],
    ['array body', [], 'INVALID_JSON', 400],
    ['oversized body', 'x'.repeat(9000), 'PAYLOAD_TOO_LARGE', 413],
  ])('rejects %s', async (_, body, code, status) => {
    const out = await setup().call({ body });
    expect(out).toMatchObject({ status });
    expect(out.body.error.code).toBe(code);
  });

  it('returns field-level issues for invalid input without calling Groq', async () => {
    const { call, fetchImpl } = setup();
    const out = await call({ body: { skills: '', location: 'Atlantis' } });
    expect(out.status).toBe(400);
    expect(out.body.error.code).toBe('INVALID_INPUT');
    expect(out.body.error.issues.map(i => i.field).sort()).toEqual(['location', 'skills']);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not reveal which env var is missing', async () => {
    const { call } = setup({ env: {} });
    const out = await call();
    expect(out.status).toBe(503);
    expect(JSON.stringify(out.body)).not.toMatch(/GROQ|API_KEY/i);
  });
});

describe('handleAnalyze — limits and upstream errors', () => {
  it('rate-limits per client and sets Retry-After', async () => {
    const { call, fetchImpl } = setup({
      fetchImpl: vi.fn(async () => groqOk()),
      limiterEnv: { RATE_LIMIT_PER_MINUTE: '2' },
    });
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    const third = await call();
    expect(third.status).toBe(429);
    expect(third.body.error).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
    expect(Number(third.headers['Retry-After'])).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // A different client is unaffected.
    expect((await call({ ip: '198.51.100.1' })).status).toBe(200);
  });

  it('enforces the global daily cap', async () => {
    const { call } = setup({ fetchImpl: vi.fn(async () => groqOk()), limiterEnv: { DAILY_REQUEST_CAP: '1' } });
    expect((await call()).status).toBe(200);
    const out = await call({ ip: '198.51.100.2' });
    expect(out.status).toBe(503);
    expect(out.body.error.code).toBe('GLOBAL_DAILY_CAP');
  });

  it('sanitizes provider errors', async () => {
    const providerBody = { error: { message: 'Invalid API Key sk-test-SECRET', code: 'invalid_api_key' } };
    const { call, logs } = setup({ fetchImpl: fetchSequence(jsonResponse(401, providerBody)) });
    const out = await call();
    expect(out.status).toBe(503);
    expect(out.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(out.body)).not.toMatch(/invalid_api_key|sk-test|Groq/i);
    expect(logs.find(l => l.event === 'analyze')).toMatchObject({ level: 'error', code: 'SERVICE_UNAVAILABLE', detail: 'groq 401 invalid_api_key' });
  });

  it('returns 502 BAD_OUTPUT after one retry and logs both attempts', async () => {
    const { call, logs } = setup({ fetchImpl: fetchSequence(groqOk('x'), groqOk('y')) });
    const out = await call();
    expect(out.status).toBe(502);
    expect(out.body.error).toMatchObject({ code: 'BAD_OUTPUT', retryable: true });
    expect(logs.find(l => l.event === 'analyze')).toMatchObject({ attempts: 2, totalTokens: 3400 });
  });

  it('turns unexpected exceptions into a generic 500', async () => {
    const deps = createDeps(ENV, {
      logger: () => {},
      randomId: () => 'r',
      rateLimiter: { backend: 'test', check: async () => { throw new Error('db exploded at 10.0.0.5'); } },
    });
    const out = await handleAnalyze({ method: 'POST', headers: {}, body: { skills: 'Go' }, ip: '1.1.1.1' }, deps);
    expect(out.status).toBe(500);
    expect(JSON.stringify(out.body)).not.toContain('10.0.0.5');
  });
});
