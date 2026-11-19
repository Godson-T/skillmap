// Vercel serverless adapter. All logic lives in server/handler.js.
import { createDeps, handleAnalyze } from '../server/handler.js';
import { clientIp, normalizeHeaders, send } from '../server/http.js';

let deps; // reused across warm invocations (keeps the in-memory rate-limit fallback alive)

export default async function handler(req, res) {
  deps ??= createDeps(process.env);
  const headers = normalizeHeaders(req.headers);
  let body;
  try {
    body = req.body; // Vercel parses JSON lazily; malformed JSON throws here
  } catch {
    body = '\u0000invalid';
  }
  const out = await handleAnalyze({ method: req.method, headers, body, ip: clientIp(headers, req.socket) }, deps);
  send(res, out);
}
