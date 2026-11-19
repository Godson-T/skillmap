// Vercel serverless adapter for /api/market. All logic lives in server/handler.js.
import { createDeps, handleMarket } from '../server/handler.js';
import { clientIp, normalizeHeaders, send } from '../server/http.js';

let deps; // reused across warm invocations (keeps job-board caches warm)

export default async function handler(req, res) {
  deps ??= createDeps(process.env);
  const headers = normalizeHeaders(req.headers);
  let body;
  try {
    body = req.body;
  } catch {
    body = '\u0000invalid';
  }
  send(res, await handleMarket({ method: req.method, headers, body, ip: clientIp(headers, req.socket) }, deps));
}
