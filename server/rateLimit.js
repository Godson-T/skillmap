// Per-client rate limiting plus a global daily budget cap.
//
// Backend: Upstash Redis REST (also what Vercel KV / Marketplace Redis exposes)
// when UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN are set; otherwise
// an in-memory store. In-memory limits are per serverless instance only, so
// they slow abuse but do not bound total spend — configure Redis in production.

import { createHash } from 'node:crypto';

const int = (v, d) => (Number.isFinite(Number.parseInt(v, 10)) ? Number.parseInt(v, 10) : d);
const day = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
const secondsToUtcMidnight = (ms) => {
  const d = new Date(ms);
  return Math.max(1, Math.ceil((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - ms) / 1000));
};

export function rateLimitConfig(env = {}) {
  return {
    perMinute: int(env.RATE_LIMIT_PER_MINUTE, 5),
    perDay: int(env.RATE_LIMIT_PER_DAY, 40),
    globalPerDay: int(env.DAILY_REQUEST_CAP, 2000),
    salt: env.RATE_LIMIT_SALT || 'skillmap',
  };
}

/** Hash the client IP so raw IPs are never stored in Redis or logs. */
export const clientKey = (ip, salt) => createHash('sha256').update(`${salt}:${ip || 'unknown'}`).digest('hex').slice(0, 24);

function memoryStore() {
  const counters = new Map(); // key -> { n, exp }
  return {
    name: 'memory',
    async incr(keys, now) {
      if (counters.size > 10_000) for (const [k, v] of counters) if (v.exp <= now) counters.delete(k);
      return keys.map(([key, ttlSec]) => {
        const cur = counters.get(key);
        const entry = cur && cur.exp > now ? cur : { n: 0, exp: now + ttlSec * 1000 };
        entry.n += 1;
        counters.set(key, entry);
        return entry.n;
      });
    },
  };
}

function upstashStore(url, token, fetchImpl) {
  return {
    name: 'upstash',
    async incr(keys) {
      const commands = keys.flatMap(([key, ttlSec]) => [['INCR', key], ['EXPIRE', key, String(ttlSec), 'NX']]);
      const res = await fetchImpl(`${url.replace(/\/$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commands),
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) throw new Error(`upstash ${res.status}`);
      const out = await res.json();
      return keys.map((_, i) => Number(out[i * 2]?.result));
    },
  };
}

/**
 * @returns {{ backend: string, check: (ip: string, now?: number) => Promise<{ ok: true } | { ok: false, code: 'RATE_LIMITED'|'DAILY_LIMIT'|'GLOBAL_DAILY_CAP', retryAfter: number }> }}
 */
export function createRateLimiter(env = {}, { fetchImpl = fetch, logger } = {}) {
  const cfg = rateLimitConfig(env);
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  const fallback = memoryStore();
  const primary = url && token ? upstashStore(url, token, fetchImpl) : fallback;

  const incr = async (keys, now) => {
    try {
      return await primary.incr(keys, now);
    } catch (err) {
      // Fail over to per-instance limits rather than fail open or take the site down.
      logger?.('warn', 'ratelimit_backend_error', { backend: primary.name, error: String(err?.message || err) });
      return fallback.incr(keys, now);
    }
  };

  return {
    backend: primary.name,
    async check(ip, now = Date.now()) {
      const id = clientKey(ip, cfg.salt);
      const minute = Math.floor(now / 60_000);
      const today = day(now);

      const [perMin, perDay] = await incr([
        [`sm:rl:m:${id}:${minute}`, 90],
        [`sm:rl:d:${id}:${today}`, 26 * 3600],
      ], now);
      if (perMin > cfg.perMinute) return { ok: false, code: 'RATE_LIMITED', retryAfter: 60 - Math.floor((now / 1000) % 60) };
      if (perDay > cfg.perDay) return { ok: false, code: 'DAILY_LIMIT', retryAfter: secondsToUtcMidnight(now) };

      // Global budget is only counted for requests that passed per-client limits,
      // so one abusive client cannot burn the whole day's cap.
      const [global] = await incr([[`sm:rl:g:${today}`, 26 * 3600]], now);
      if (global > cfg.globalPerDay) return { ok: false, code: 'GLOBAL_DAILY_CAP', retryAfter: secondsToUtcMidnight(now) };
      return { ok: true };
    },
  };
}
