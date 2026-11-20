import { describe, expect, it, vi } from 'vitest';
import { createDeps, handleMarket } from '../server/handler.js';
import { extractSkills, htmlToText } from '../server/market/extract.js';
import { locationMatcher, roleMatcher } from '../server/market/filters.js';
import { createMarketService } from '../server/market/service.js';
import { createRateLimiter } from '../server/rateLimit.js';
import { jsonResponse } from './helpers.js';

const esc = (html) => html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Fake Greenhouse + Lever APIs. */
function fakeBoards({ ghJobs = [], leverPostings = [], failTokens = [] } = {}) {
  const calls = [];
  const fetchImpl = vi.fn(async (url) => {
    calls.push(url);
    const u = new URL(url);
    const token = u.pathname.split('/')[u.hostname.includes('lever') ? 3 : 3];
    if (failTokens.includes(token)) return jsonResponse(404, {});
    if (u.hostname === 'boards-api.greenhouse.io') {
      const m = u.pathname.match(/\/jobs\/(\d+)$/);
      if (m) {
        const j = ghJobs.find(x => String(x.id) === m[1]);
        return jsonResponse(200, { ...j, content: esc(j.html) });
      }
      return jsonResponse(200, { jobs: ghJobs.map(j => ({ id: j.id, title: j.title, location: j.location, absolute_url: j.absolute_url })) });
    }
    if (u.hostname === 'api.lever.co') return jsonResponse(200, leverPostings);
    return jsonResponse(404, {});
  });
  return { fetchImpl, calls };
}

const gh = (id, title, loc, html) => ({ id, title, location: { name: loc }, absolute_url: `https://example.com/jobs/${id}`, html });
const many = (n, loc, html, start = 1) => Array.from({ length: n }, (_, i) => gh(start + i, `Backend Engineer ${i}`, loc, html));
const BOARDS = [
  { ats: 'greenhouse', token: 'acme', company: 'Acme' },
  { ats: 'lever', token: 'globex', company: 'Globex' },
];

describe('extractSkills / htmlToText', () => {
  it('decodes Greenhouse entity-escaped HTML', () => {
    expect(htmlToText(esc('<p>R&amp;D with <b>Kubernetes</b></p>'))).toBe('R&D with Kubernetes');
  });
  it('matches aliases and punctuation-heavy names with boundaries', () => {
    const s = extractSkills('Python, Go and TypeScript; Node.js, k8s, CI/CD, C++, .NET, RESTful APIs, Postgres');
    expect([...s].sort()).toEqual(['.NET', 'C++', 'CI/CD', 'Go', 'Kubernetes', 'Node.js', 'PostgreSQL', 'Python', 'REST APIs', 'TypeScript']);
  });
  it('avoids common-word false positives', () => {
    const s = extractSkills('Go deep on problems, react to incidents, rest well, spark ideas, R&D, express yourself, network nodes.');
    expect([...s]).toEqual([]);
  });
  it('does not match Java inside JavaScript', () => {
    expect([...extractSkills('JavaScript')]).toEqual(['JavaScript']);
  });
});

describe('filters', () => {
  it('matches preset roles on titles and requires a technical title', () => {
    const be = roleMatcher('Backend Engineer');
    expect(be('Senior Backend Engineer, Payments')).toBe(true);
    expect(be('Back-end Developer')).toBe(true);
    expect(be('Backend Sales Lead Generation Rep')).toBe(false);
    expect(be('Frontend Engineer')).toBe(false);
  });
  it('matches custom roles word by word', () => {
    expect(roleMatcher('Quant Developer')('Senior Quant Developer (Rates)')).toBe(true);
    expect(roleMatcher('Quant Developer')('Quant Researcher')).toBe(false);
  });
  it('matches locations', () => {
    expect(locationMatcher('India')('Bengaluru, Karnataka')).toBe(true);
    expect(locationMatcher('US')('San Francisco, CA')).toBe(true);
    expect(locationMatcher('US')('Seattle, WA; New York, NY')).toBe(true);
    expect(locationMatcher('US')('Dublin')).toBe(false);
    expect(locationMatcher('UK')('London')).toBe(true);
    expect(locationMatcher('EU')('Berlin, Germany')).toBe(true);
    expect(locationMatcher('Remote')('Anywhere')).toBe(true);
    expect(locationMatcher('Remote')('Toronto', 'remote')).toBe(true);
  });
});

describe('createMarketService', () => {

  it('counts skills from matching postings only, with shares and source metadata', async () => {
    const ghJobs = [
      ...many(8, 'Bengaluru', '<p>Python, PostgreSQL and Docker</p>'),
      ...many(4, 'Mumbai', '<p>Go, Kubernetes</p>', 100),
      gh(500, 'Account Executive', 'Bengaluru', '<p>Salesforce</p>'),
    ];
    const leverPostings = [{ id: 'l1', text: 'Backend Engineer', categories: { location: 'Pune' }, hostedUrl: 'https://jobs.example/l1', descriptionPlain: 'We use Python and Kafka.', lists: [] }];
    const { fetchImpl } = fakeBoards({ ghJobs, leverPostings });
    const svc = createMarketService({ fetchImpl, boards: BOARDS });
    const r = await svc.skillDemand({ goal: 'Backend Engineer', location: 'India' }, 0);

    expect(r).toMatchObject({ source: 'Public Greenhouse and Lever job boards', scope: 'location', sampleSize: 13, lowSample: true, companies: ['Acme', 'Globex'], boards: { queried: 2, ok: 2 } });
    expect(r.skills[0]).toEqual({ skill: 'Python', count: 9, share: 69 });
    expect(r.skills.find(s => s.skill === 'Kafka')).toEqual({ skill: 'Kafka', count: 1, share: 8 });
    expect(r.skills.some(s => s.skill === 'Salesforce')).toBe(false);
    expect(r.postings.length).toBeLessThanOrEqual(6);
    expect(r.postings[0].url).toMatch(/^https:\/\//);
  });

  it('falls back to all locations when the local sample is tiny, and says so', async () => {
    const { fetchImpl } = fakeBoards({ ghJobs: [...many(3, 'London', '<p>Rust</p>'), gh(9, 'Backend Engineer', 'Pune', '<p>Rust</p>')] });
    const r = await createMarketService({ fetchImpl, boards: BOARDS.slice(0, 1) }).skillDemand({ goal: 'Backend Engineer', location: 'India' }, 0);
    expect(r).toMatchObject({ scope: 'global', localMatches: 1, sampleSize: 4 });
  });

  it('caps postings per company and only fetches details for matches', async () => {
    const { fetchImpl, calls } = fakeBoards({ ghJobs: [...many(40, 'Remote', '<p>Java</p>'), ...Array.from({ length: 20 }, (_, i) => gh(900 + i, 'Recruiter', 'Remote', 'x'))] });
    const r = await createMarketService({ fetchImpl, boards: BOARDS.slice(0, 1) }).skillDemand({ goal: 'Backend Engineer', location: 'Remote' }, 0);
    expect(r.sampleSize).toBe(15);
    expect(calls.filter(u => /\/jobs\/\d+$/.test(u))).toHaveLength(15);
  });

  it('skips failing boards and caches results', async () => {
    const { fetchImpl } = fakeBoards({ ghJobs: many(12, 'Remote', '<p>Go, Python</p>'), failTokens: ['globex'] });
    const logger = vi.fn();
    const svc = createMarketService({ fetchImpl, boards: BOARDS, logger });
    const r = await svc.skillDemand({ goal: 'Backend Engineer', location: 'Remote' }, 0);
    expect(r.boards).toEqual({ queried: 2, ok: 1 });
    expect(logger).toHaveBeenCalledWith('warn', 'market_boards_failed', { boards: [{ board: 'lever:globex', reason: expect.any(String) }] });
    const before = fetchImpl.mock.calls.length;
    const again = await svc.skillDemand({ goal: 'backend engineer', location: 'Remote' }, 1000);
    expect(again.cached).toBe(true);
    expect(fetchImpl.mock.calls.length).toBe(before);
  });

  it('only ever calls the curated hosts', async () => {
    const { fetchImpl, calls } = fakeBoards({ ghJobs: many(2, 'Remote', '<p>Go</p>') });
    await createMarketService({ fetchImpl, boards: BOARDS }).skillDemand({ goal: 'https://evil.example/x', location: 'Remote' }, 0);
    expect(calls.every(u => /^https:\/\/(boards-api\.greenhouse\.io|api\.lever\.co)\//.test(u))).toBe(true);
  });

  it('marks the result degraded and counts detailsFailed when a posting detail 404s', async () => {
    const jobs = many(3, 'Remote', '<p>Go</p>');
    const fetchImpl = vi.fn(async (url) => {
      const u = new URL(url);
      const m = u.pathname.match(/\/jobs\/(\d+)$/);
      if (m) {
        if (m[1] === String(jobs[0].id)) return jsonResponse(404, {}); // one detail fetch fails
        const j = jobs.find(x => String(x.id) === m[1]);
        return jsonResponse(200, { ...j, content: esc(j.html) });
      }
      return jsonResponse(200, { jobs: jobs.map(j => ({ id: j.id, title: j.title, location: j.location, absolute_url: j.absolute_url })) });
    });
    const r = await createMarketService({ fetchImpl, boards: BOARDS.slice(0, 1) }).skillDemand({ goal: 'Backend Engineer', location: 'Remote' }, 0);
    expect(r.degraded).toBe(true);
    expect(r.detailsFailed).toBe(1);
    expect(r.sampleSize).toBe(2); // the failed posting is excluded from the skill tally
  });

  it('is not degraded and has no truncation when everything succeeds within budget', async () => {
    const { fetchImpl } = fakeBoards({ ghJobs: many(3, 'Remote', '<p>Go</p>') });
    const r = await createMarketService({ fetchImpl, boards: BOARDS.slice(0, 1) }).skillDemand({ goal: 'Backend Engineer', location: 'Remote' }, 0);
    expect(r.degraded).toBe(false);
    expect(r.detailsFailed).toBe(0);
    expect(r.truncated).toBe(0);
  });

  it('never caches a total failure (every board down)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, {}));
    const svc = createMarketService({ fetchImpl, boards: BOARDS });
    const first = await svc.skillDemand({ goal: 'Backend Engineer', location: 'Remote' }, 0);
    expect(first).toMatchObject({ boards: { queried: 2, ok: 0 }, sampleSize: 0, degraded: true });
    // After the negative-cache window, a fresh attempt must hit the boards again, not a cached failure.
    const before = fetchImpl.mock.calls.length;
    const again = await svc.skillDemand({ goal: 'Backend Engineer', location: 'Remote' }, 6 * 60_000);
    expect(again.cached).toBeUndefined();
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(before);
  });
});

describe('handleMarket', () => {
  const setup = (fetchImpl, limiterEnv = {}) => {
    const logs = [];
    const deps = createDeps({}, {
      logger: (level, event, f) => logs.push({ level, event, ...f }),
      randomId: () => 'm1',
      rateLimiter: createRateLimiter(limiterEnv),
      market: createMarketService({ fetchImpl, boards: BOARDS }),
    });
    const call = (body, ip = '1.2.3.4') => handleMarket({ method: 'POST', headers: { host: 'h', origin: 'http://h' }, body, ip }, deps);
    return { call, logs };
  };

  it('returns market data and needs no Groq key', async () => {
    const { fetchImpl } = fakeBoards({ ghJobs: many(12, 'Remote', '<p>Python</p>') });
    const { call, logs } = setup(fetchImpl);
    const out = await call({ goal: 'Backend Engineer', location: 'Remote' });
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ requestId: 'm1', market: { sampleSize: 12, skills: [{ skill: 'Python', count: 12, share: 100 }] } });
    expect(logs.at(-1)).toMatchObject({ event: 'market', status: 200, sampleSize: 12, goalKind: 'preset' });
  });

  it('requires a target role and validates location', async () => {
    const { call } = setup(vi.fn());
    const out = await call({ goal: '', location: 'Mars' });
    expect(out.status).toBe(400);
    expect(out.body.error.issues.map(i => i.field).sort()).toEqual(['goal', 'location']);
  });

  it('returns 502 when every board fails', async () => {
    const { call } = setup(vi.fn(async () => jsonResponse(500, {})));
    expect((await call({ goal: 'Backend Engineer', location: 'US' })).body.error.code).toBe('UPSTREAM_ERROR');
  });

  it('has its own rate limit that does not consume the analysis budget', async () => {
    const { fetchImpl } = fakeBoards({ ghJobs: many(2, 'Remote', '<p>Go</p>') });
    const limiter = createRateLimiter({ MARKET_RATE_LIMIT_PER_MINUTE: '1', DAILY_REQUEST_CAP: '1' });
    const deps = createDeps({}, { logger: () => {}, rateLimiter: limiter, market: createMarketService({ fetchImpl, boards: BOARDS }) });
    const req = { method: 'POST', headers: {}, body: { goal: 'Backend Engineer', location: 'Remote' }, ip: '9.9.9.9' };
    expect((await handleMarket(req, deps)).status).toBe(200);
    expect((await handleMarket(req, deps)).status).toBe(429);
    expect((await limiter.check('9.9.9.9')).ok).toBe(true); // analysis budget untouched
  });
});
