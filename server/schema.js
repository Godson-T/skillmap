import { z } from 'zod';
import { LIMITS, LOCATION_VALUES, TARGET_ROLES } from '../shared/options.js';

/* ─── Input ──────────────────────────────────────────────────────────────── */

// Letters, combining marks (Indic scripts, decomposed accents) and digits in any
// script, plus the punctuation real skill names use (C++, C#, .NET, CI/CD, Node.js).
const SKILL_RE = /^[\p{L}\p{M}\p{N} .+#/&()'_-]+$/u;
const GOAL_RE = /^[\p{L}\p{M}\p{N} .,+#/&()'_-]+$/u;

/** NFC-normalize and collapse whitespace so equivalent spellings compare equal. */
const canon = (s) => s.normalize('NFC').trim().replace(/ {2,}/g, ' '); // newlines/tabs stay, and the regex rejects them
const wordCount = (s) => (s ? s.split(' ').length : 0);

// Word caps keep free text from smuggling instructions into the prompt.
const skillItem = z.string().transform(canon).pipe(z.string().min(1)
  .max(LIMITS.maxSkillLength, `Each skill must be ${LIMITS.maxSkillLength} characters or fewer`)
  .regex(SKILL_RE, 'Skills may only contain letters, numbers, spaces and . + # / & ( ) \' - _')
  .refine(s => wordCount(s) <= LIMITS.maxSkillWords, `Each skill must be ${LIMITS.maxSkillWords} words or fewer`));

const skillsField = z.union([
  z.string().max(LIMITS.maxSkillsChars, `Skills list must be ${LIMITS.maxSkillsChars} characters or fewer`)
    .transform(s => s.split(',')),
  z.array(z.string()).max(LIMITS.maxSkills * 2),
])
  .transform(list => {
    const seen = new Set();
    return list.map(canon).filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
  })
  .pipe(z.array(skillItem)
    .min(1, 'Please add at least one skill')
    .max(LIMITS.maxSkills, `Please list ${LIMITS.maxSkills} skills or fewer`));

const ROLE_LOOKUP = new Map(TARGET_ROLES.map(r => [r.toLowerCase(), r]));
const LOCATION_LOOKUP = new Map(LOCATION_VALUES.map(v => [v.toLowerCase(), v]));

const goalField = z.string().transform(canon)
  .pipe(z.string()
    .max(LIMITS.maxCustomGoalLength, `Target role must be ${LIMITS.maxCustomGoalLength} characters or fewer`)
    .refine(g => g === '' || GOAL_RE.test(g), 'Target role may only contain letters, numbers, spaces and basic punctuation')
    .refine(g => wordCount(g) <= LIMITS.maxGoalWords, `Target role must be ${LIMITS.maxGoalWords} words or fewer`))
  .transform(g => ROLE_LOOKUP.get(g.toLowerCase()) ?? g)
  .optional()
  .default('');

export const AnalyzeInput = z.object({
  skills: skillsField,
  goal: z.preprocess(v => (v == null ? '' : v), goalField),
  location: z.preprocess(v => (v == null || v === '' ? 'US' : typeof v === 'string' ? LOCATION_LOOKUP.get(v.trim().toLowerCase()) ?? v : v),
    z.enum(/** @type {[string, ...string[]]} */ (LOCATION_VALUES), {
      error: `Location must be one of: ${LOCATION_VALUES.join(', ')}`,
    })),
});

/** /api/market input: a target role is required (preset or sanitized custom). */
export const MarketInput = z.object({
  goal: z.preprocess(v => (v == null ? '' : v), goalField).refine(g => g.length > 0, 'Pick a target role to see real job-posting data'),
  location: AnalyzeInput.shape.location,
});

export const goalKind = (goal) => (!goal ? 'none' : ROLE_LOOKUP.has(goal.toLowerCase()) ? 'preset' : 'custom');

/** Flatten zod issues to [{ field, message }] for the client. */
export const formatIssues = (zodError) =>
  zodError.issues.map(i => ({ field: String(i.path[0] ?? 'body'), message: i.message })).slice(0, 5);

/* ─── LLM output ─────────────────────────────────────────────────────────── */

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Trimmed, length-capped, non-empty string. Over-long model text is truncated, not rejected. */
const text = (max) => z.preprocess(
  v => (typeof v === 'number' ? String(v) : v),
  z.string().transform(s => s.trim().replace(/\s+/g, ' ').slice(0, max)).pipe(z.string().min(1)),
);
const optText = (max) => z.preprocess(v => (v == null ? '' : v), z.string()).transform(s => s.trim().slice(0, max));

/** Number, tolerating "6" or "6 months"; clamped to a sane range. */
const num = (lo, hi) => z.preprocess(
  v => (typeof v === 'string' ? Number.parseFloat(v) : v),
  z.number().finite(),
).transform(n => clamp(Math.round(n), lo, hi));

// Named sources the model has no way to have read. Sentences that cite them
// are removed: the product only shows sourced facts or labelled estimates.
const CITATION_RE = /\b(according to|survey|octoverse|economic graph|linkedin|stack ?overflow|gartner|mckinsey|world economic forum|wef|glassdoor|statista|report(?:ed|s)? (?:by|from))\b/i;
const PERCENT_RE = /\d+(?:\.\d+)?\s?%/;

/** Drop sentences that cite named sources or state percentages as fact. */
export function stripUnsourcedClaims(s, fallback) {
  const sentences = s.match(/[^.!?]+[.!?]*/g) ?? [s];
  const kept = sentences.filter(x => !CITATION_RE.test(x) && !PERCENT_RE.test(x)).join(' ').replace(/\s+/g, ' ').trim();
  return kept || fallback;
}

/**
 * Array that drops items failing `item` instead of failing the whole report
 * (one malformed edge should not cost a paid retry), then caps length and
 * enforces a minimum on what survived.
 */
const lenientArray = (item, { min = 0, max }) => z.preprocess(
  v => (Array.isArray(v) ? v : []),
  z.array(z.unknown()).transform(list => list.flatMap(x => {
    const r = item.safeParse(x);
    return r.success ? [r.data] : [];
  }).slice(0, max)),
).pipe(z.array(z.any()).min(min));

const node = z.object({
  id: text(60),
  label: text(60),
  type: z.enum(['current', 'bridge', 'target']).catch('bridge'),
  level: num(1, 3).catch(2),
});
const edge = z.object({ from: text(60), to: text(60), label: optText(40) });

export const ReportSchema = z.object({
  risingSkills: lenientArray(z.object({
    skill: text(60),
    demandScore: num(0, 100).catch(50),
    trend: z.enum(['rising', 'stable', 'declining']).catch('stable'),
  }), { min: 1, max: 10 }),

  knowledgeGraph: z.object({
    nodes: lenientArray(node, { min: 2, max: 16 }),
    edges: lenientArray(edge, { max: 40 }),
  }).transform(g => {
    const nodes = [...new Map(g.nodes.map(n => [n.id, n])).values()];
    const ids = new Set(nodes.map(n => n.id));
    const seen = new Set();
    const edges = g.edges.filter(e => {
      const k = `${e.from}\u0000${e.to}`;
      if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { nodes, edges };
  }).refine(g => g.nodes.length >= 2, 'knowledge graph needs at least 2 distinct nodes'),

  careerPaths: lenientArray(z.object({
    pathName: text(80),
    steps: lenientArray(z.object({
      role: text(80),
      timeMonths: num(1, 60).catch(6),
      skillsNeeded: lenientArray(text(60), { max: 12 }),
      roi: text(300).transform(s => stripUnsourcedClaims(s, 'Opens the door to the next role on this path.')),
    }), { min: 1, max: 8 }),
    totalTime: text(40),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']).catch('Medium'),
  }), { min: 1, max: 4 }),

  dyingSkills: lenientArray(z.object({
    skill: text(60),
    reason: text(400).transform(s => stripUnsourcedClaims(s, 'Demand appears to be shifting toward newer alternatives.')),
  }), { min: 1, max: 6 }),

  topMicroSkills: lenientArray(z.object({
    skill: text(60),
    learnTime: text(40),
    impact: z.enum(['High', 'Medium', 'Low']).catch('Medium'),
  }), { min: 1, max: 10 }),
});
