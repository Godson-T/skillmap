// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { ApiError, NETWORK_MESSAGE, postJSON } from '../src/lib/api.js';
import { partialNote } from '../src/lib/marketCopy.js';
import { LIMITS } from '../shared/options.js';
import fixture from './fixtures/report.json';

const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });

const baseMarket = (over = {}) => ({
  source: 'Public Greenhouse and Lever job boards', fetchedAt: '2026-11-19T10:00:00Z', role: 'Full Stack Developer',
  location: 'US', scope: 'location', localMatches: 40, matched: 40, sampleSize: 40, lowSample: false,
  degraded: false, detailsFailed: 0, truncated: 0, companies: ['Acme'], boards: { queried: 20, ok: 20 },
  skills: [{ skill: 'Docker', count: 12, share: 30 }],
  postings: [{ title: 'Full Stack Engineer', company: 'Acme', location: 'NYC', url: 'https://example.com/1' }],
  ...over,
});

const skillsBox = () => screen.getByRole('combobox', { name: /your skills/i });
const roleBox = () => screen.getByRole('combobox', { name: /target role/i });
const addSkill = (v) => { fireEvent.change(skillsBox(), { target: { value: v } }); fireEvent.keyDown(skillsBox(), { key: 'Enter' }); };
const submit = () => fireEvent.click(screen.getByRole('button', { name: /Plan my route/ }));

describe('postJSON', () => {
  it('returns parsed JSON on success', async () => {
    const fetchImpl = vi.fn(async () => respond({ ok: 1 }));
    await expect(postJSON('/x', { a: 1 }, { fetchImpl })).resolves.toEqual({ ok: 1 });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ a: 1 });
  });

  it('joins the server message and field issues', async () => {
    const fetchImpl = async () => respond({ error: { code: 'INVALID_INPUT', message: 'Tweak needed.', issues: [{ message: 'A' }, { message: 'B' }] } }, 400);
    const err = await postJSON('/x', {}, { fetchImpl }).catch(e => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'INVALID_INPUT', message: 'Tweak needed. A · B' });
  });

  it('falls back to the HTTP status when the error body is not JSON', async () => {
    const fetchImpl = async () => new Response('<html>bad gateway</html>', { status: 502 });
    await expect(postJSON('/x', {}, { fetchImpl })).rejects.toThrow(/HTTP 502/);
  });

  it('maps a network failure to a friendly message', async () => {
    const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
    await expect(postJSON('/x', {}, { fetchImpl })).rejects.toMatchObject({ network: true, message: NETWORK_MESSAGE });
  });

  it('re-throws AbortError untouched so callers can ignore superseded runs', async () => {
    const fetchImpl = async () => { throw abortError(); };
    await expect(postJSON('/x', {}, { fetchImpl })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('partialNote', () => {
  it('names failed boards and unread postings', () => {
    expect(partialNote({ boards: { queried: 20, ok: 18 }, detailsFailed: 2, truncated: 1 }))
      .toBe('Partial count: 2 of 20 job boards didn’t respond, and 3 matching postings couldn’t be read in time. Try again in a few minutes for a fuller sample.');
  });
  it('uses the singular for one posting', () => {
    expect(partialNote({ boards: { queried: 2, ok: 2 }, detailsFailed: 1, truncated: 0 })).toMatch(/1 matching posting couldn’t/);
  });
});

describe('App behaviour', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
    localStorage.clear();
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('cancels a stale market request so it cannot overwrite a newer run', async () => {
    const signals = [];
    let marketCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
      if (url === '/api/analyze') return Promise.resolve(respond({ report: fixture, meta: {} }));
      marketCalls += 1;
      signals.push(init.signal);
      if (marketCalls === 1) {
        // Run 1's market call hangs until aborted.
        return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(abortError())));
      }
      return Promise.resolve(respond({ market: baseMarket({ role: 'Second Run Role' }) }));
    });
    render(<App />);
    addSkill('React');
    fireEvent.change(roleBox(), { target: { value: 'Full Stack Developer' } });
    submit();
    await screen.findByRole('heading', { name: 'Your next three tickets' });
    submit(); // resubmit while run 1's market call is still pending
    await screen.findByText(/Second Run Role/);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('supports Home and End on the route tabs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => respond(url === '/api/market' ? { market: baseMarket() } : { report: fixture, meta: {} }));
    render(<App />);
    addSkill('React');
    submit();
    const tabs = await screen.findAllByRole('tab');
    fireEvent.keyDown(tabs[0], { key: 'End' });
    expect(screen.getAllByRole('tab').at(-1).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(screen.getAllByRole('tab').at(-1), { key: 'Home' });
    expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true');
  });

  it('labels a partial job-posting count', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => respond(
      url === '/api/market' ? { market: baseMarket({ degraded: true, boards: { queried: 20, ok: 17 } }) } : { report: fixture, meta: {} },
    ));
    render(<App />);
    addSkill('React');
    fireEvent.change(roleBox(), { target: { value: 'Full Stack Developer' } });
    submit();
    expect(await screen.findByText(/Partial count: 3 of 20 job boards/)).toBeTruthy();
  });

  it('explains the skill limit instead of silently disabling the field', () => {
    render(<App />);
    const many = Array.from({ length: LIMITS.maxSkills }, (_, i) => `Skill${i}`).join(',') + ',';
    fireEvent.change(skillsBox(), { target: { value: many } });
    const input = skillsBox();
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(input.disabled).toBe(false); // still focusable, so the reason is announced
    const hint = document.getElementById(input.getAttribute('aria-describedby'));
    expect(hint.textContent).toMatch(new RegExp(`Limit of ${LIMITS.maxSkills} skills reached`));
  });

  it('keeps listbox ids valid and announces the suggestion count', async () => {
    render(<App />);
    const input = skillsBox();
    expect(document.getElementById(input.getAttribute('aria-controls'))).not.toBeNull(); // mounted even when closed
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Py' } });
    await waitFor(() => expect(input.getAttribute('aria-expanded')).toBe('true'));
    expect(screen.getAllByRole('status').some(s => /suggestions? available/.test(s.textContent))).toBe(true);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const activeId = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(activeId)).not.toBeNull();
    // Changing the query resets the highlighted option so it never points at a stale node.
    fireEvent.change(input, { target: { value: 'Ty' } });
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('returns focus to the skills input after removing a chip', () => {
    render(<App />);
    addSkill('React');
    fireEvent.click(screen.getByRole('button', { name: 'Remove React' }));
    expect(document.activeElement).toBe(skillsBox());
  });
});
