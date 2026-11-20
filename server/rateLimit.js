// Per-client rate limiting plus a global daily budget cap.
//
// Backend: Upstash Redis REST (also what Vercel KV / Marketplace Redis exposes)
// when UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN are set; otherwise
// an in-memory store. In-memory limits are per serverless instance only, so
// they slow abuse but do not bound total spend: configure Redis in production.

import { createHash } from 'node:crypto';
import { isIPv4, isIPv6 } from 'node:net';

const day = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
const secondsToUtcMidnight = (ms) => {
  const d = new Date(ms);
  return Math.max(1, Math.ceil((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - ms) / 1000));
};
export const isProduction = (env = {}) => env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';

/** Positive integer from env, or the default; malformed values are reported, never silently used. */
function positiveInt(env, name, fallback, problems) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  problems.push(`${name} must be a positive integer (got "${raw}"); using ${fallback}`);
  return fallback;
}

export function rateLimitConfig(env = {}) {
  const problems = [];
  const cfg = {
    perMinute: positiveInt(env, 'RATE_LIMIT_PER_MINUTE', 5, problems),
    perDay: positiveInt(env, 'RATE_LIMIT_PER_DAY', 40, problems),
    marketPerMinute: positiveInt(env, 'MARKET_RATE_LIMIT_PER_MINUTE', 10, problems),
    marketPerDay: positiveInt(env, 'MARKET_RATE_LIMIT_PER_DAY', 200, problems),
    globalPerDay: positiveInt(env, 'DAILY_REQUEST_CAP', 2000, problems),
    // Global cap while the shared store is unreachable (counted per instance, so kept low).
    degradedPerDay: positiveInt(env, 'DEGRADED_DAILY_CAP', 100, problems),
    salt: env.RATE_LIMIT_SALT || 'skillmap',
  };
  return { ...cfg, problems };
}

/**
 * Bucket an IP for rate limiting. IPv6 is cut to its /64 prefix (the usual
 * single-subscriber allocation), so one host cannot rotate through 2^64 addresses.
 */
export function ipBucket(ip) {
  let s = String(ip || '').trim().replace(/^\[|\]$/g, '');
  if (s.toLowerCase().startsWith('::ffff:') && isIPv4(s.slice(7))) s = s.slice(7);
  if (isIPv4(s)) return s;
  if (!isIPv6(s)) return 'unknown';
  const [head, tail = ''] = s.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const full = s.includes('::') ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t] : h;
  return `${full.slice(0, 4).map(x => x.padStart(4, '0')).join(':')}::/64`;
}

/** Hash the client bucket so raw IPs are never stored in Redis or logs. */
export const clientKey = (ip, salt) => createHash('sha256').update(`${salt}:${ipBucket(ip)}`).digest('hex').slice(0, 24);

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
      if (!Array.isArray(out) || out.length !== commands.length) throw new Error('upstash: unexpected pipeline reply');
      return keys.map((_, i) => {
        const n = out[i * 2]?.result;
        // A per-command {error} or a non-integer must never read as "under the limit".
        if (!Number.isInteger(n)) throw new Error(`upstash: INCR failed (${out[i * 2]?.error ?? 'no result'})`);
        return n;
      });
    },
  };
}

/**
 * @returns {{ backend: string, config: object, check: (ip: string, now?: number, opts?: object) => Promise<{ ok: true } | { ok: false, code: 'RATE_LIMITED'|'DAILY_LIMIT'|'GLOBAL_DAILY_CAP', retryAfter: number }> }}
 */
export function createRateLimiter(env = {}, { fetchImpl = fetch, logger } = {}) {
  const cfg = rateLimitConfig(env);
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  const fallback = memoryStore();
  const shared = Boolean(url && token);
  const primary = shared ? upstashStore(url, token, fetchImpl) : fallback;

  // Configuration problems are reported once, at startup, where they can be alerted on.
  for (const problem of cfg.problems) logger?.('warn', 'ratelimit_config', { problem });
  if (Boolean(url) !== Boolean(token)) {
    logger?.('error', 'ratelimit_config', { problem: 'only one of the Redis REST URL/TOKEN is set; using per-instance memory limits' });
  }
  if (isProduction(env) && !shared) {
    logger?.('error', 'ratelimit_config', { problem: 'no shared rate-limit store in production; the daily budget cap is per instance only' });
  }
  if (isProduction(env) && !env.RATE_LIMIT_SALT) {
    logger?.('error', 'ratelimit_config', { problem: 'RATE_LIMIT_SALT is unset in production; hashed client keys are guessable' });
  }

  let degradedUntil = 0;
  const incr = async (keys, now) => {
    try {
      return await primary.incr(keys, now);
    } catch (err) {
      // Fail over to per-instance limits (the site stays up) under a much lower
      // global cap, and report it once per minute so it can be alerted on.
      if (now >= degradedUntil) {
        logger?.('error', 'ratelimit_degraded', { backend: primary.name, error: String(err?.message || err) });
      }
      degradedUntil = now + 60_000;
      return fallback.incr(keys, now);
    }
  };

  return {
    backend: primary.name,
    config: cfg,
    isDegraded: (now = Date.now()) => shared && now < degradedUntil,
    /**
     * @param {string} ip
     * @param {number} [now]
     * @param {{ scope?: string, perMinute?: number, perDay?: number, countGlobal?: boolean }} [opts]
     *   scope separates counters per endpoint; countGlobal=false skips the LLM budget cap.
     */
    async check(ip, now = Date.now(), opts = {}) {
      const { scope = 'a', perMinute = cfg.perMinute, perDay = cfg.perDay, countGlobal = true } = opts;
      const id = clientKey(ip, cfg.salt);
      const minute = Math.floor(now / 60_000);
      const today = day(now);
      const ns = scope === 'a' ? 'sm:rl' : `sm:rl:${scope}`;

      const [perMin, daily] = await incr([
        [`${ns}:m:${id}:${minute}`, 90],
        [`${ns}:d:${id}:${today}`, 26 * 3600],
      ], now);
      if (perMin > perMinute) return { ok: false, code: 'RATE_LIMITED', retryAfter: 60 - Math.floor((now / 1000) % 60) };
      if (daily > perDay) return { ok: false, code: 'DAILY_LIMIT', retryAfter: secondsToUtcMidnight(now) };
      if (!countGlobal) return { ok: true };

      // Global budget is only counted for requests that passed per-client limits,
      // so one abusive client cannot burn the whole day's cap.
      const [global] = await incr([[`sm:rl:g:${today}`, 26 * 3600]], now);
      const degraded = shared && now < degradedUntil;
      const cap = degraded ? Math.min(cfg.globalPerDay, cfg.degradedPerDay) : cfg.globalPerDay;
      if (global > cap) return { ok: false, code: 'GLOBAL_DAILY_CAP', retryAfter: secondsToUtcMidnight(now) };
      return { ok: true };
    },
  };
}
