// Small HTTP helpers shared by the Vercel function and the Vite dev middleware.

export const MAX_BODY_BYTES = 8 * 1024;

/** Lower-case header map from a Node IncomingMessage-like object. */
export const normalizeHeaders = (h = {}) =>
  Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : v]));

/**
 * Whether proxy headers (x-forwarded-for, x-forwarded-host) can be trusted.
 * True on Vercel, whose edge overwrites them, or when TRUST_PROXY is set for
 * another reverse proxy that does the same. Anywhere else they are client-
 * controlled, so trusting them would let a caller pick any IP per request.
 */
export const trustsProxy = (env = {}) => Boolean(env.VERCEL) || /^(1|true|yes)$/i.test(String(env.TRUST_PROXY || ''));

/** Client IP: platform headers behind a trusted proxy, else the socket address. */
export function clientIp(headers, socket, env = {}) {
  if (trustsProxy(env)) {
    const forwarded = headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'];
    const ip = headers['x-real-ip'] || (forwarded ? String(forwarded).split(',')[0].trim() : '');
    if (ip) return ip;
  }
  return socket?.remoteAddress || 'unknown';
}

/**
 * CORS: allow same-origin requests (Origin host == Host header, which covers
 * production, preview deployments and local dev with no config) plus any
 * origin listed in ALLOWED_ORIGINS. Requests without an Origin header are
 * not browser cross-origin requests; CORS is browser hygiene only, and
 * scripted abuse is bounded by the rate limits and the daily budget cap.
 */
export function resolveCors(headers, env = {}) {
  const origin = headers.origin;
  if (!origin) return { allowed: true, headers: {} };
  const allowList = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const host = (trustsProxy(env) && headers['x-forwarded-host']) || headers.host;
  let sameHost = false;
  try { sameHost = new URL(origin).host === host; } catch { /* bad origin */ }
  if (!sameHost && !allowList.includes(origin)) return { allowed: false, headers: { Vary: 'Origin' } };
  return {
    allowed: true,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    },
  };
}

/** Read a request body stream with a size cap. Resolves to a string, or null if too large. */
export function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let tooLarge = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { tooLarge = true; return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(tooLarge ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Write a handler result ({ status, headers, body }) to a Node ServerResponse. */
export function send(res, out) {
  res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
  res.end(out.body === undefined ? undefined : JSON.stringify(out.body));
}

/**
 * Build a Vercel Node function from a framework-agnostic handler.
 * Rejects oversized bodies from Content-Length before Vercel parses them.
 * @param {(req: object, deps: object) => Promise<{status:number, headers:object, body?:unknown}>} handle
 * @param {(env: object) => object} makeDeps
 */
export function makeVercelHandler(handle, makeDeps) {
  let deps; // reused across warm invocations (keeps in-memory limits and caches alive)
  return async function vercelHandler(req, res) {
    deps ??= makeDeps(process.env);
    const headers = normalizeHeaders(req.headers);
    const declared = Number(headers['content-length']);
    let body;
    let bodyTooLarge = Number.isFinite(declared) && declared > MAX_BODY_BYTES;
    if (!bodyTooLarge) {
      try {
        body = req.body; // Vercel parses JSON lazily; malformed JSON throws here
      } catch {
        body = '\u0000invalid';
      }
    }
    if (!bodyTooLarge && body && typeof body === 'object' && Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) bodyTooLarge = true;
    send(res, await handle({ method: req.method, headers, body, bodyTooLarge, ip: clientIp(headers, req.socket, deps.env) }, deps));
  };
}
