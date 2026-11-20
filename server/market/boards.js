// Curated public job boards. These are the ONLY hosts and tokens the market
// endpoint fetches; user input never becomes part of a URL (no SSRF surface).
//
// Greenhouse: https://boards.greenhouse.io/<token>  ->  boards-api.greenhouse.io/v1/boards/<token>/jobs
// Lever:      https://jobs.lever.co/<token>         ->  api.lever.co/v0/postings/<token>?mode=json
//
// Run `npm run boards:check` to see which tokens currently respond; a board that
// fails at request time is skipped and logged, never fatal.
// Bias note: these ATSs are used mostly by tech companies and startups, so the
// sample over-represents them. The UI says so.

export const BOARDS = [
  // Greenhouse
  { ats: 'greenhouse', token: 'stripe', company: 'Stripe' },
  { ats: 'greenhouse', token: 'databricks', company: 'Databricks' },
  { ats: 'greenhouse', token: 'cloudflare', company: 'Cloudflare' },
  { ats: 'greenhouse', token: 'gitlab', company: 'GitLab' },
  { ats: 'greenhouse', token: 'figma', company: 'Figma' },
  { ats: 'greenhouse', token: 'discord', company: 'Discord' },
  { ats: 'greenhouse', token: 'dropbox', company: 'Dropbox' },
  { ats: 'greenhouse', token: 'airbnb', company: 'Airbnb' },
  { ats: 'greenhouse', token: 'robinhood', company: 'Robinhood' },
  { ats: 'greenhouse', token: 'coinbase', company: 'Coinbase' },
  { ats: 'greenhouse', token: 'datadog', company: 'Datadog' },
  { ats: 'greenhouse', token: 'mongodb', company: 'MongoDB' },
  { ats: 'greenhouse', token: 'twilio', company: 'Twilio' },
  { ats: 'greenhouse', token: 'postman', company: 'Postman' },
  { ats: 'greenhouse', token: 'browserstack', company: 'BrowserStack' },
  // Lever
  { ats: 'lever', token: 'palantir', company: 'Palantir' },
  { ats: 'lever', token: 'spotify', company: 'Spotify' },
  { ats: 'lever', token: 'cred', company: 'CRED' },
  { ats: 'lever', token: 'meesho', company: 'Meesho' },
  { ats: 'lever', token: 'razorpay', company: 'Razorpay' },
];

const ATS = {
  greenhouse: {
    listUrl: (t) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(t)}/jobs`,
    postingUrl: (t, id) => `https://boards.greenhouse.io/${encodeURIComponent(t)}/jobs/${encodeURIComponent(String(id))}`,
    postingHosts: ['boards.greenhouse.io', 'job-boards.greenhouse.io'],
  },
  lever: {
    listUrl: (t) => `https://api.lever.co/v0/postings/${encodeURIComponent(t)}?mode=json`,
    postingUrl: (t, id) => `https://jobs.lever.co/${encodeURIComponent(t)}/${encodeURIComponent(String(id))}`,
    postingHosts: ['jobs.lever.co'],
  },
};

const ats = (b) => {
  const a = ATS[b.ats];
  if (!a) throw new Error(`unknown ATS "${b.ats}" for board ${b.token}`);
  return a;
};

export const boardUrl = (b) => ats(b).listUrl(b.token);

export const greenhouseJobUrl = (b, id) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.token)}/jobs/${encodeURIComponent(String(id))}`;

/**
 * Link shown to users for a posting. Upstream URLs are used only when they are
 * https on the ATS's own posting host; anything else falls back to the
 * canonical ATS URL, so a spoofed or odd board reply cannot inject links.
 */
export function safePostingUrl(b, id, upstreamUrl) {
  const a = ats(b);
  try {
    const u = new URL(upstreamUrl);
    if (u.protocol === 'https:' && a.postingHosts.includes(u.hostname)) return u.href;
  } catch { /* fall through */ }
  return a.postingUrl(b.token, id);
}
