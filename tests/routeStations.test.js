import { describe, expect, it } from 'vitest';
import { routeStations } from '../src/lib/routeStations.js';
import fixture from './fixtures/report.json';

describe('routeStations', () => {
  it('orders bridges by distance from held skills and lists where each is reached from', () => {
    const r = routeStations(fixture.knowledgeGraph);
    expect(r.held.map(n => n.label)).toEqual(['JavaScript', 'React']);
    expect(r.bridges.map(b => b.label)).toEqual(['TypeScript', 'Node.js', 'PostgreSQL', 'Docker']);
    expect(r.bridges[0].from).toEqual(['JavaScript', 'React']);
    expect(r.termini.map(n => n.label)).toEqual(['Full Stack Developer']);
  });
  it('never lists the target role as where a station is reached from', () => {
    const r = routeStations(fixture.knowledgeGraph);
    expect(r.bridges.every(b => !b.from.includes('Full Stack Developer'))).toBe(true);
    expect(r.bridges.find(b => b.label === 'Docker').from).toEqual(['PostgreSQL']);
  });
  it('is deterministic and tolerates empty graphs', () => {
    expect(routeStations(fixture.knowledgeGraph)).toEqual(routeStations(fixture.knowledgeGraph));
    expect(routeStations({ nodes: [], edges: [] })).toEqual({ held: [], bridges: [], termini: [] });
  });
});
