import { canonicalSkill, normalizeSkillList } from '../../shared/skills.js';

/**
 * Pick the next skills to learn, measured evidence first.
 *  1. Skills real postings for the target role mention most that the user lacks (measured).
 *  2. Skills the first AI career path needs that the user lacks (estimate).
 *  3. High-impact AI micro-skills (estimate).
 * @returns {Array<{ id: string, skill: string, evidence: 'measured'|'estimate', count?: number, sample?: number, share?: number, role?: string, alsoOnPath: boolean }>}
 */
export function pickNextSkills({ userSkills, report, market, limit = 3 }) {
  const have = new Set(normalizeSkillList(userSkills).map(s => s.id));
  const pathIds = new Set();
  for (const p of report?.careerPaths ?? []) for (const st of p.steps ?? []) for (const sk of st.skillsNeeded ?? []) {
    const c = canonicalSkill(sk); if (c) pathIds.add(c.id);
  }
  const out = [];
  const seen = new Set();
  const add = (raw, extra) => {
    const c = canonicalSkill(raw);
    if (!c || have.has(c.id) || seen.has(c.id) || out.length >= limit) return;
    seen.add(c.id);
    out.push({ id: c.id, skill: c.label, alsoOnPath: pathIds.has(c.id), ...extra });
  };

  if (market?.sampleSize > 0) {
    for (const s of market.skills ?? []) add(s.skill, { evidence: 'measured', count: s.count, sample: market.sampleSize, share: s.share });
  }
  const firstPath = report?.careerPaths?.[0];
  for (const st of firstPath?.steps ?? []) for (const sk of st.skillsNeeded ?? []) add(sk, { evidence: 'estimate', role: st.role });
  for (const m of (report?.topMicroSkills ?? []).filter(x => x.impact === 'High')) add(m.skill, { evidence: 'estimate', role: null });
  return out;
}
