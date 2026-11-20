// Real job-posting signal: which skills postings for the target role mention.
//
// Flow: fetch each curated board's job list (light) -> keep titles that match
// the role -> for Greenhouse, fetch full descriptions for matches only (capped)
// -> extract skills deterministically -> count. Everything is cached in memory,
// identical concurrent work is shared, and failures are counted and reported
// rather than turned into empty answers.

import { BOARDS, boardUrl, greenhouseJobUrl, safePostingUrl } from './boards.js';
import { extractSkills, htmlToText } from './extract.js';
import { locationMatcher, roleMatcher } from './filters.js';

export const MARKET_SOURCE = 'Public Greenhouse and Lever job boards';
const LIST_TTL_MS = 6 * 3600_000;
const LIST_FAILURE_TTL_MS = 5 * 60_000; // skip a dead board briefly instead of waiting on it every request
const DETAIL_TTL_MS = 24 * 3600_000;
const RESULT_TTL_MS = 3600_000;
const DEGRADED_RESULT_TTL_MS = 5 * 60_000;
const LIST_TIMEOUT_MS = 6000;
const DETAIL_TIMEOUT_MS = 5000;
const DETAIL_PHASE_DEADLINE_MS = 18_000; // stop starting new detail fetches after this (function limit is 30s)
const MAX_PER_BOARD = 15;
const MAX_TOTAL = 150;
const MAX_UNCACHED_DETAILS = 60; // per request, bounds outbound fan-out for cold or unique queries
const DETAIL_CONCURRENCY = 8;
const MIN_LOCAL_SAMPLE = 10;
export const LOW_SAMPLE = 30;
const TOP_SKILLS = 15;
const BOARD_FAILED = Symbol('board-failed');
/** Upper bound on one uncached request: the last detail fetch may start just before the phase deadline. */
export const WORST_CASE_MS = DETAIL_PHASE_DEADLINE_MS + DETAIL_TIMEOUT_MS;

/** Tiny TTL cache with a size bound; expired entries are purged before live ones are evicted. */
function ttlCache(max) {
  const m = new Map();
  return {
    get(k, now) { const e = m.get(k); if (e && e.exp > now) return e.v; m.delete(k); return undefined; },
    has(k, now) { return this.get(k, now) !== undefined; },
    set(k, v, ttl, now) {
      if (m.size >= max) {
        for (const [key, e] of m) if (e.exp <= now) m.delete(key);
        if (m.size >= max) m.delete(m.keys().next().value);
      }
      m.set(k, { v, exp: now + ttl });
    },
    clear() { m.clear(); },
  };
}

/** Run `fn` once per key at a time: concurrent callers share the same promise. */
function singleFlight() {
  const inflight = new Map();
  return (key, fn) => {
    if (inflight.has(key)) return inflight.get(key);
    const p = Promise.resolve().then(fn).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
}

async function getJSON(fetchImpl, url, timeoutMs) {
  const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Normalize a board's postings to { id, title, location, workplaceType, url, raw? }. Throws on an unexpected shape. */
function normalizeList(board, data) {
  if (board.ats === 'greenhouse') {
    if (!Array.isArray(data?.jobs)) throw new Error('unexpected Greenhouse reply (no jobs array)');
    return data.jobs.map(j => ({
      id: j.id, title: String(j.title ?? ''), location: j.location?.name ?? '', workplaceType: '',
      url: safePostingUrl(board, j.id, j.absolute_url), company: board.company, board,
    }));
  }
  if (!Array.isArray(data)) throw new Error('unexpected Lever reply (not an array)');
  return data.map(p => ({
    id: p.id, title: String(p.text ?? ''),
    location: [p.categories?.location, ...(p.categories?.allLocations ?? [])].filter(Boolean).join('; '),
    workplaceType: p.workplaceType ?? '',
    url: safePostingUrl(board, p.id, p.hostedUrl), company: board.company, board,
    // Raw fields only: text is built lazily for the few postings actually sampled.
    raw: { description: p.descriptionPlain, lists: p.lists, additional: p.additionalPlain },
  }));
}

const leverText = (raw) => [raw?.description, ...(raw?.lists ?? []).map(l => `${l.text} ${htmlToText(l.content)}`), raw?.additional]
  .filter(Boolean).join(' ');

/** Run async fns with bounded concurrency; `shouldStart` can stop scheduling new work. */
async function pool(items, limit, fn, shouldStart = () => true) {
  const out = new Array(items.length).fill(undefined);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length && shouldStart()) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

const normalizeGoal = (g) => String(g).toLowerCase().replace(/\s+/g, ' ').trim();

export function createMarketService({ fetchImpl = fetch, logger, boards = BOARDS, now: clock = Date.now } = {}) {
  const lists = ttlCache(100);
  const skillsByPosting = ttlCache(5000); // posting key -> extracted skill labels (not full text)
  const results = ttlCache(500);
  const flight = singleFlight();

  /** Postings for one board, or throws. Recently failed boards fail fast. */
  function boardPostings(board, now) {
    const key = `${board.ats}:${board.token}`;
    const cached = lists.get(key, now);
    if (cached === BOARD_FAILED) return Promise.reject(new Error('failed recently; skipped'));
    if (cached) return Promise.resolve(cached);
    return flight(`list:${key}`, async () => {
      try {
        const postings = normalizeList(board, await getJSON(fetchImpl, boardUrl(board), LIST_TIMEOUT_MS));
        lists.set(key, postings, LIST_TTL_MS, now);
        return postings;
      } catch (err) {
        lists.set(key, BOARD_FAILED, LIST_FAILURE_TTL_MS, now);
        throw err;
      }
    });
  }

  const postingKey = (p) => `${p.board.ats}:${p.board.token}:${p.id}`;

  /** Skill labels mentioned by one posting, or null when its text could not be read. */
  function postingSkills(p, now) {
    const key = postingKey(p);
    const cached = skillsByPosting.get(key, now);
    if (cached) return Promise.resolve(cached);
    return flight(`detail:${key}`, async () => {
      let text;
      if (p.raw) {
        text = leverText(p.raw);
      } else {
        const job = await getJSON(fetchImpl, greenhouseJobUrl(p.board, p.id), DETAIL_TIMEOUT_MS);
        text = htmlToText(job?.content);
      }
      if (!text) throw new Error('empty posting content');
      const skills = [...extractSkills(`${p.title} ${text}`)];
      skillsByPosting.set(key, skills, DETAIL_TTL_MS, now);
      return skills;
    });
  }

  async function compute({ goal, location }, now) {
    const started = clock();
    const settled = await Promise.allSettled(boards.map(b => boardPostings(b, now)));
    const failed = [];
    const all = settled.flatMap((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      failed.push({ board: `${boards[i].ats}:${boards[i].token}`, reason: String(r.reason?.message || r.reason) });
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

    // Cached postings are free; uncached detail fetches are budgeted per request.
    let uncachedBudget = MAX_UNCACHED_DETAILS;
    const budgeted = sample.filter(p => {
      if (p.raw || skillsByPosting.has(postingKey(p), now)) return true;
      if (uncachedBudget <= 0) return false;
      uncachedBudget -= 1;
      return true;
    });
    const skippedForBudget = sample.length - budgeted.length;

    let detailsFailed = 0;
    let detailsSkippedForTime = 0;
    const withinDeadline = () => clock() - started < DETAIL_PHASE_DEADLINE_MS;
    const skillLists = await pool(budgeted, DETAIL_CONCURRENCY, async (p) => {
      try {
        return await postingSkills(p, now);
      } catch {
        detailsFailed += 1;
        return null;
      }
    }, withinDeadline);
    detailsSkippedForTime = skillLists.filter(x => x === undefined).length;
    if (detailsFailed) logger?.('warn', 'market_details_failed', { failed: detailsFailed, attempted: budgeted.length - detailsSkippedForTime });

    const analysed = budgeted.map((p, i) => ({ p, skills: skillLists[i] })).filter(x => Array.isArray(x.skills));
    const counts = new Map();
    for (const { skills } of analysed) for (const s of skills) counts.set(s, (counts.get(s) ?? 0) + 1);
    const n = analysed.length;
    const skills = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_SKILLS)
      .map(([skill, count]) => ({ skill, count, share: n ? Math.round((count / n) * 100) : 0 }));

    const degraded = failed.length > 0 || detailsFailed > 0 || detailsSkippedForTime > 0;
    return {
      source: MARKET_SOURCE,
      fetchedAt: new Date(now).toISOString(),
      role: goal,
      location,
      scope,
      localMatches: local.length,
      matched: sample.length,
      sampleSize: n,
      lowSample: n < LOW_SAMPLE,
      degraded,
      detailsFailed,
      truncated: skippedForBudget + detailsSkippedForTime,
      companies: [...new Set(analysed.map(x => x.p.company))].sort(),
      boards: { queried: boards.length, ok: boards.length - failed.length },
      skills,
      postings: analysed.slice(0, 6).map(({ p }) => ({ title: p.title, company: p.company, location: p.location, url: p.url })),
    };
  }

  /**
   * @param {{ goal: string, location: string }} q
   */
  async function skillDemand(q, now = clock()) {
    const cacheKey = `${normalizeGoal(q.goal)}|${q.location}`;
    const hit = results.get(cacheKey, now);
    if (hit) return { ...hit, cached: true };
    return flight(`result:${cacheKey}`, async () => {
      const result = await compute(q, now);
      // Never cache a total failure; cache a degraded answer only briefly.
      if (result.boards.ok > 0 && !(result.matched > 0 && result.sampleSize === 0)) {
        results.set(cacheKey, result, result.degraded ? DEGRADED_RESULT_TTL_MS : RESULT_TTL_MS, now);
      }
      return result;
    });
  }

  return { skillDemand, _clear: () => { lists.clear(); skillsByPosting.clear(); results.clear(); } };
}
