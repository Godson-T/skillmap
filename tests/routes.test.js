import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '../server/routes.js';
import { ReportSchema } from '../server/schema.js';
import { SYSTEM_PROMPT } from '../server/prompt.js';
import fixture from './fixtures/report.json';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

describe('route parity (Vite dev server vs Vercel functions)', () => {
  for (const [path, { handler, maxDuration }] of Object.entries(ROUTES)) {
    const file = `api/${path.replace(/^\/api\//, '')}.js`;

    it(`${path}: has a Vercel adapter that uses the same handler`, async () => {
      expect(existsSync(new URL(`../${file}`, import.meta.url))).toBe(true);
      const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      expect(src).toContain(handler.name || 'makeVercelHandler');
      expect(src).toContain('makeVercelHandler');
    });

    it(`${path}: vercel.json maxDuration matches`, () => {
      expect(vercel.functions?.[file]?.maxDuration).toBe(maxDuration);
    });
  }

  it('the LLM deadline fits inside the analyze function limit', async () => {
    const { OVERALL_DEADLINE_MS } = await import('../server/llm.js');
    expect(OVERALL_DEADLINE_MS).toBeLessThan(ROUTES['/api/analyze'].maxDuration * 1000);
  });

  it('the market worst case fits inside the market function limit', async () => {
    const { WORST_CASE_MS } = await import('../server/market/service.js');
    expect(WORST_CASE_MS).toBeLessThan(ROUTES['/api/market'].maxDuration * 1000);
  });
});

describe('prompt / schema parity', () => {
  it('the prompt names every top-level report section the schema requires', () => {
    for (const key of Object.keys(ReportSchema.shape)) expect(SYSTEM_PROMPT).toContain(key);
  });

  it('the reference fixture satisfies the schema', () => {
    expect(ReportSchema.safeParse(fixture).success).toBe(true);
  });
});
