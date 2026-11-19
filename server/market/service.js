// Real job-posting signal: which skills postings for the target role mention.
//
// Flow: fetch each curated board's job list (light) -> keep titles that match
// the role -> for Greenhouse, fetch full descriptions for matches only (capped)
// -> extract skills deterministically -> count. Everything is cached in memory.

import { BOARDS, boardUrl, greenhouseJobUrl } from './boards.js';
import { extractSkills, htmlToText } from './extract.js';
import { locationMatcher, roleMatcher } from './filters.js';

export const MARKET_SOURCE = 'Public Greenhouse and Lever job boards';
const LIST_TTL_MS = 6 * 3600_000;
const DETAIL_TTL_MS = 24 * 3600_000;
const RESULT_TTL_MS = 3600_000;
const LIST_TIMEOUT_MS = 6000;
const DETAIL_TIMEOUT_MS = 5000;
const MAX_PER_BOARD = 15;
const MAX_TOTAL = 150;
const MIN_LOCAL_SAMPLE = 10;
export const LOW_SAMPLE = 30;
const TOP_SKILLS = 15;

/** Tiny TTL cache with a size bound. */
function ttlCache(max) {
  const m = new Map();
  return {
    get(k, now) { const e = m.get(k); if (e && e.exp > now) return e.v; m.delete(k); return undefined; },
    set(k, v, ttl, now) { if (m.size >= max) m.delete(m.keys().next().value); m.set(k, { v, exp: now + ttl }); },
    clear() { m.clear(); },
  };
}

async function getJSON(fetchImpl, url, timeoutMs) {
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Normalize a board's postings to { id, title, location, workplaceType, url, text? }. */
function normalizeList(board, data) {
  if (board.ats === 'greenhouse') {
    return (data?.jobs ?? []).map(j => ({
      id: j.id, title: String(j.title ?? ''), location: j.location?.name ?? '', workplaceType: '',
      url: j.absolute_url, company: board.company, board,
    }));
  }
  return (Array.isArray(data) ? data : []).map(p => ({
    id: p.id, title: String(p.text ?? ''),
    location: [p.categories?.location, ...(p.categories?.allLocations ?? [])].filter(Boolean).join('; '),
    workplaceType: p.workplaceType ?? '',
    url: p.hostedUrl, company: board.company, board,
    text: [p.descriptionPlain, ...(p.lists ?? []).map(l => `${l.text} ${htmlToText(l.content)}`), p.additionalPlain].filter(Boolean).join(' '),
  }));
}

/** Run async fns with bounded concurrency. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export function createMarketService({ fetchImpl = fetch, logger, boards = BOARDS } = {}) {
  const lists = ttlCache(100);
  const details = ttlCache(5000);
  const results = ttlCache(500);

  async function boardPostings(board, now) {
    const key = `${board.ats}:${board.token}`;
    const cached = lists.get(key, now);
    if (cached) return cached;
    const postings = normalizeList(board, await getJSON(fetchImpl, boardUrl(board), LIST_TIMEOUT_MS));
    lists.set(key, postings, LIST_TTL_MS, now);
    return postings;
  }

  async function postingText(p, now) {
    if (p.text != null) return p.text;
    const key = `gh:${p.board.token}:${p.id}`;
    const cached = details.get(key, now);
    if (cached != null) return cached;
    const job = await getJSON(fetchImpl, greenhouseJobUrl(p.board, p.id), DETAIL_TIMEOUT_MS);
    const text = htmlToText(job?.content);
    details.set(key, text, DETAIL_TTL_MS, now);
    return text;
  }

  /**
   * @param {{ goal: string, location: string }} q
   */
  async function skillDemand({ goal, location }, now = Date.now()) {
    const cacheKey = `${goal.toLowerCase()}|${location}`;
    const hit = results.get(cacheKey, now);
    if (hit) return { ...hit, cached: true };

    const settled = await Promise.allSettled(boards.map(b => boardPostings(b, now)));
    const failed = [];
    const all = settled.flatMap((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      failed.push(`${boards[i].ats}:${boards[i].token}`);
      return [];
    });
    if (failed.length) logger?.('warn', 'market_boards_failed', { boards: failed });

    const isRole = roleMatcher(goal);
    const isHere = locationMatcher(location);
    const roleMatches = all.filter(p => isRole(p.title));
    const local = roleMatches.filter(p => isHere(p.location, p.workplaceType));
    const scope = local.length >= MIN_LOCAL_SAMPLE ? 'location' : 'global';
    const chosen = scope === 'location' ? local : roleMatches;

    // Cap per board so one big employer cannot dominate, then overall.
    const perBoard = new Map();
    const sample = chosen.filter(p => {
      const n = perBoard.get(p.company) ?? 0;
      if (n >= MAX_PER_BOARD) return false;
      perBoard.set(p.company, n + 1);
      return true;
    }).slice(0, MAX_TOTAL);

    const texts = await pool(sample, 8, p => postingText(p, now).catch(() => null));
    const analysed = sample.map((p, i) => ({ p, text: texts[i] })).filter(x => x.text);

    const counts = new Map();
    for (const { p, text } of analysed) for (const s of extractSkills(`${p.title} ${text}`)) counts.set(s, (counts.get(s) ?? 0) + 1);
    const n = analysed.length;
    const skills = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_SKILLS)
      .map(([skill, count]) => ({ skill, count, share: n ? Math.round((count / n) * 100) : 0 }));

    const result = {
      source: MARKET_SOURCE,
      fetchedAt: new Date(now).toISOString(),
      role: goal,
      location,
      scope,
      localMatches: local.length,
      sampleSize: n,
      lowSample: n < LOW_SAMPLE,
      companies: [...new Set(analysed.map(x => x.p.company))].sort(),
      boards: { queried: boards.length, ok: boards.length - failed.length },
      skills,
      postings: analysed.slice(0, 6).map(({ p }) => ({ title: p.title, company: p.company, location: p.location, url: p.url })),
    };
    // Don't cache an all-boards-failed result for an hour.
    if (failed.length < boards.length) results.set(cacheKey, result, RESULT_TTL_MS, now);
    return result;
  }

  return { skillDemand, _clear: () => { lists.clear(); details.clear(); results.clear(); } };
}
