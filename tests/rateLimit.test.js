import { describe, expect, it, vi } from 'vitest';
import { clientKey, createRateLimiter } from '../server/rateLimit.js';
import { jsonResponse } from './helpers.js';

const T0 = Date.UTC(2026, 10, 19, 12, 0, 30);

describe('createRateLimiter (memory)', () => {
  it('limits per minute and resets the next minute', async () => {
    const rl = createRateLimiter({ RATE_LIMIT_PER_MINUTE: '2' });
    expect(rl.backend).toBe('memory');
    expect((await rl.check('a', T0)).ok).toBe(true);
    expect((await rl.check('a', T0)).ok).toBe(true);
    expect(await rl.check('a', T0)).toMatchObject({ ok: false, code: 'RATE_LIMITED', retryAfter: 30 });
    expect((await rl.check('a', T0 + 60_000)).ok).toBe(true);
  });

  it('limits per day', async () => {
    const rl = createRateLimiter({ RATE_LIMIT_PER_MINUTE: '100', RATE_LIMIT_PER_DAY: '3' });
    for (let i = 0; i < 3; i++) expect((await rl.check('a', T0 + i * 60_000)).ok).toBe(true);
    expect(await rl.check('a', T0 + 5 * 60_000)).toMatchObject({ ok: false, code: 'DAILY_LIMIT' });
  });

  it('does not let rate-limited clients consume the global cap', async () => {
    const rl = createRateLimiter({ RATE_LIMIT_PER_MINUTE: '1', DAILY_REQUEST_CAP: '2' });
    await rl.check('203.0.113.1', T0);
    for (let i = 0; i < 10; i++) await rl.check('203.0.113.1', T0);
    expect((await rl.check('203.0.113.2', T0)).ok).toBe(true);
    expect(await rl.check('203.0.113.3', T0)).toMatchObject({ ok: false, code: 'GLOBAL_DAILY_CAP' });
  });
});

describe('createRateLimiter (upstash)', () => {
  const env = { UPSTASH_REDIS_REST_URL: 'https://redis.example/', UPSTASH_REDIS_REST_TOKEN: 'tok' };

  it('uses a pipeline of INCR + EXPIRE NX with hashed keys', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const cmds = JSON.parse(init.body);
      return jsonResponse(200, cmds.map(c => ({ result: c[0] === 'INCR' ? 1 : 1 })));
    });
    const rl = createRateLimiter(env, { fetchImpl });
    expect(rl.backend).toBe('upstash');
    expect((await rl.check('203.0.113.9', T0)).ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://redis.example/pipeline');
    expect(init.headers.Authorization).toBe('Bearer tok');
    const cmds = JSON.parse(init.body);
    expect(cmds[0][0]).toBe('INCR');
    expect(cmds[1]).toEqual(['EXPIRE', cmds[0][1], '90', 'NX']);
    expect(init.body).not.toContain('203.0.113.9');
  });

  it('also reads Vercel KV env names', () => {
    expect(createRateLimiter({ KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 't' }, { fetchImpl: vi.fn() }).backend).toBe('upstash');
  });

  it('fails over to in-memory limits when Redis errors', async () => {
    const logger = vi.fn();
    const rl = createRateLimiter({ ...env, RATE_LIMIT_PER_MINUTE: '1' }, { fetchImpl: vi.fn(async () => jsonResponse(500, {})), logger });
    expect((await rl.check('a', T0)).ok).toBe(true);
    expect((await rl.check('a', T0)).ok).toBe(false);
    expect(logger).toHaveBeenCalledWith('error', 'ratelimit_degraded', expect.objectContaining({ backend: 'upstash' }));
  });
});

describe('clientKey', () => {
  it('is a salted, stable hash', () => {
    expect(clientKey('1.2.3.4', 's')).toBe(clientKey('1.2.3.4', 's'));
    expect(clientKey('1.2.3.4', 's')).not.toBe(clientKey('1.2.3.4', 't'));
    expect(clientKey('1.2.3.4', 's')).not.toContain('1.2.3.4');
  });
});
