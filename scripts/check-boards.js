// Checks every curated job board in server/market/boards.js and prints which respond.
// Usage: npm run boards:check
import { BOARDS, boardUrl } from '../server/market/boards.js';

const rows = await Promise.all(BOARDS.map(async (b) => {
  try {
    const res = await fetch(boardUrl(b), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ...b, status: res.status, jobs: 0 };
    const data = await res.json();
    return { ...b, status: res.status, jobs: (b.ats === 'greenhouse' ? data.jobs : data)?.length ?? 0 };
  } catch (err) {
    return { ...b, status: err.name === 'TimeoutError' ? 'timeout' : 'error', jobs: 0 };
  }
}));
for (const r of rows) console.log(`${r.status === 200 ? 'OK  ' : 'FAIL'} ${r.ats.padEnd(10)} ${r.token.padEnd(14)} ${String(r.status).padEnd(8)} ${r.jobs} jobs`);
const ok = rows.filter(r => r.status === 200).length;
console.log(`\n${ok}/${rows.length} boards responding`);
process.exitCode = ok ? 0 : 1;
