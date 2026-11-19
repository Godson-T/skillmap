import { describe, expect, it } from 'vitest';
import { pickNextSkills } from '../src/lib/nextSkills.js';
import fixture from './fixtures/report.json';

const market = { sampleSize: 20, skills: [{ skill: 'React', count: 18, share: 90 }, { skill: 'k8s', count: 9, share: 45 }, { skill: 'Docker', count: 8, share: 40 }] };

describe('pickNextSkills', () => {
  it('puts measured, missing skills first, then the AI route', () => {
    const t = pickNextSkills({ userSkills: ['React', 'JS'], report: fixture, market });
    expect(t.map(x => [x.skill, x.evidence])).toEqual([['Kubernetes', 'measured'], ['Docker', 'measured'], ['TypeScript', 'estimate']]);
    expect(t[1]).toMatchObject({ count: 8, sample: 20, alsoOnPath: true });
  });
  it('falls back to the AI route without market data', () => {
    const t = pickNextSkills({ userSkills: 'React', report: fixture });
    expect(t.map(x => x.skill)).toEqual(['TypeScript', 'Node.js', 'PostgreSQL']);
    expect(t.every(x => x.evidence === 'estimate')).toBe(true);
  });
  it('ignores an empty market sample', () => {
    expect(pickNextSkills({ userSkills: [], report: fixture, market: { sampleSize: 0, skills: [{ skill: 'Go', count: 0 }] } })[0].skill).toBe('TypeScript');
  });
});
