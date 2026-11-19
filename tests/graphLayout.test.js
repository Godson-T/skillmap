import { describe, expect, it } from 'vitest';
import { computeLayout, initialLayout, seededRandom } from '../src/lib/graphLayout.js';
import fixture from './fixtures/report.json';

const W = 880, H = 360;

describe('graph layout', () => {
  it('seededRandom is deterministic', () => {
    const a = seededRandom(42), b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces the same layout for the same graph every time', () => {
    expect(computeLayout(fixture.knowledgeGraph, W, H)).toEqual(computeLayout(fixture.knowledgeGraph, W, H));
  });

  it('depends on node ids, not on call order or Math.random', () => {
    const first = initialLayout(fixture.knowledgeGraph.nodes, W, H);
    Math.random(); Math.random();
    expect(initialLayout(fixture.knowledgeGraph.nodes, W, H)).toEqual(first);
    const renamed = fixture.knowledgeGraph.nodes.map(n => ({ ...n, id: `${n.id}-x` }));
    expect(initialLayout(renamed, W, H).map(n => n.y)).not.toEqual(first.map(n => n.y));
  });

  it('keeps nodes inside the canvas', () => {
    for (const { x, y } of computeLayout(fixture.knowledgeGraph, W, H)) {
      expect(x).toBeGreaterThanOrEqual(70); expect(x).toBeLessThanOrEqual(W - 70);
      expect(y).toBeGreaterThanOrEqual(35); expect(y).toBeLessThanOrEqual(H - 35);
    }
  });
});
