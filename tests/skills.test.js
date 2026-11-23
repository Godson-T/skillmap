import { describe, expect, it } from 'vitest';
import { canonicalSkill, computeSkillGap, expandSkill, normalizeSkillList } from '../shared/skills.js';

describe('canonicalSkill', () => {
  it.each([
    ['JS', 'JavaScript'],
    ['javascript', 'JavaScript'],
    ['NodeJS', 'Node.js'],
    ['node js', 'Node.js'],
    ['Node.JS', 'Node.js'],
    ['k8s', 'Kubernetes'],
    ['Postgres', 'PostgreSQL'],
    ['golang', 'Go'],
    ['C++', 'C++'],
    ['c#', 'C#'],
    ['dotnet', '.NET'],
    ['ML', 'Machine Learning'],
    ['machine learning', 'Machine Learning'],
    ['Python 3', 'Python'],
    ['React 18', 'React'],
    ['CI/CD', 'CI/CD'],
    ['jest', 'Testing (Jest / Vitest)'],
    ['  Docker  ', 'Docker'],
  ])('%s -> %s', (raw, label) => {
    expect(canonicalSkill(raw)).toMatchObject({ label, known: true });
  });

  it('keeps unknown skills with a stable id', () => {
    const a = canonicalSkill('Quantum Basket Weaving');
    const b = canonicalSkill('quantum  basket-weaving');
    expect(a.known).toBe(false);
    expect(a.id).toBe(b.id);
  });

  it('does not conflate distinct languages', () => {
    const ids = ['C', 'C++', 'C#', 'Java', 'JavaScript'].map(s => canonicalSkill(s).id);
    expect(new Set(ids).size).toBe(5);
  });

  it('returns null for blank input', () => {
    expect(canonicalSkill('   ')).toBeNull();
  });
});

describe('expandSkill', () => {
  it('splits unknown composites', () => {
    expect(expandSkill('Docker & Kubernetes').map(s => s.label)).toEqual(['Docker', 'Kubernetes']);
    expect(expandSkill('AWS/GCP').map(s => s.label)).toEqual(['AWS', 'GCP']);
    expect(expandSkill('Python (Pandas, NumPy)').map(s => s.label)).toEqual(['Python']);
  });
  it('keeps known names that contain separators', () => {
    expect(expandSkill('OAuth / JWT').map(s => s.label)).toEqual(['OAuth / JWT']);
    expect(expandSkill('Monitoring & Observability').map(s => s.label)).toEqual(['Monitoring & Observability']);
  });
});

describe('normalizeSkillList', () => {
  it('accepts a comma string and de-duplicates aliases', () => {
    expect(normalizeSkillList('JS, JavaScript, react, ReactJS, ').map(s => s.label)).toEqual(['JavaScript', 'React']);
  });
});

describe('computeSkillGap', () => {
  const paths = [
    { steps: [{ skillsNeeded: ['Machine Learning', 'Python', 'Docker'] }] },
    { steps: [{ skillsNeeded: ['Kubernetes', 'Python'] }] },
  ];

  it('matches whole skills via aliases, not first words', () => {
    const gap = computeSkillGap('py, ML', paths);
    expect(gap).toMatchObject({ total: 4, percent: 50 });
    expect(gap.matched).toEqual(['Machine Learning', 'Python']);
    expect(gap.missing).toEqual(['Docker', 'Kubernetes']);
  });

  it('regression: "machine" alone no longer matches "Machine Learning"', () => {
    expect(computeSkillGap('Machine', paths).percent).toBe(0);
  });

  it('regression: a one-letter skill does not substring-match everything', () => {
    expect(computeSkillGap('C', paths).percent).toBe(0);
  });

  it('is 100% when all needed skills are present', () => {
    expect(computeSkillGap(['Python', 'machine learning', 'docker', 'k8s'], paths).percent).toBe(100);
  });

  it('returns null when no skills are required', () => {
    expect(computeSkillGap('Python', [])).toBeNull();
    expect(computeSkillGap('Python', [{ steps: [{ skillsNeeded: [] }] }])).toBeNull();
  });
});
