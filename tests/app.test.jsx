// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import fixture from './fixtures/report.json';

const market = {
  source: 'Public Greenhouse and Lever job boards', fetchedAt: '2026-11-19T10:00:00Z', role: 'Full Stack Developer',
  location: 'US', scope: 'location', localMatches: 40, sampleSize: 40, lowSample: false, companies: ['Acme', 'Globex'],
  boards: { queried: 20, ok: 18 },
  skills: [{ skill: 'React', count: 30, share: 75 }, { skill: 'Docker', count: 12, share: 30 }, { skill: 'Go', count: 8, share: 20 }],
  postings: [{ title: 'Full Stack Engineer', company: 'Acme', location: 'NYC', url: 'https://example.com/1' }],
};

const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const addSkill = (value) => {
  const input = screen.getByLabelText('Current skills');
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: 'Enter' });
};

describe('App: slip → tickets → timetable', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
    localStorage.clear();
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('adds skills as chips (Enter, comma, suggestion) and removes them', () => {
    render(<App />);
    addSkill('React');
    const input = screen.getByLabelText('Current skills');
    fireEvent.change(input, { target: { value: 'Python,' } });
    fireEvent.change(input, { target: { value: 'Dock' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    for (const s of ['React', 'Python', 'Docker']) expect(screen.getByRole('button', { name: `Remove ${s}` })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Python' }));
    expect(screen.queryByRole('button', { name: 'Remove Python' })).toBeNull();
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(screen.queryByRole('button', { name: 'Remove Docker' })).toBeNull();
  });

  it('asks for a skill before submitting', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Plan my route/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/at least one skill/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits, then shows measured tickets, timetable, postings and estimate labels', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => respond(
      url === '/api/market' ? { requestId: 'm1', market } : { requestId: 'r1', report: fixture, meta: { estimate: true, disclaimer: 'Test disclaimer.' } },
    ));
    render(<App />);
    addSkill('JavaScript');
    addSkill('React');
    fireEvent.change(screen.getByLabelText('Target role'), { target: { value: 'Full Stack Developer' } });
    fireEvent.click(screen.getByRole('button', { name: /Plan my route/ }));

    await screen.findByRole('heading', { name: 'Your next three tickets' });
    await screen.findByText('What real job postings ask for');

    const body = JSON.parse(fetchMock.mock.calls.find(c => c[0] === '/api/analyze')[1].body);
    expect(body).toEqual({ skills: ['JavaScript', 'React'], goal: 'Full Stack Developer', location: 'US' });
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[0] === '/api/market')[1].body)).toEqual({ goal: 'Full Stack Developer', location: 'US' });

    // Tickets: measured picks first (Docker, Go from postings), then the AI route
    const tickets = screen.getAllByRole('listitem').filter(li => li.className.includes('stub'));
    await waitFor(() => expect(within(tickets[0]).getByText('Docker')).toBeTruthy());
    expect(within(tickets[0]).getByText('Measured')).toBeTruthy();
    expect(within(tickets[0]).getByText(/12 of 40/)).toBeTruthy();

    // Timetable tabs and estimate daggers
    expect(screen.getByRole('tab', { name: 'Full Stack Track' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Platform Track' }));
    expect(screen.getByText('DevOps Engineer')).toBeTruthy();
    expect(screen.getByText('Test disclaimer.', { exact: false })).toBeTruthy();

    // Postings: counted with source, user's own skill flagged
    expect(screen.getByText(/of 40 \(75%\)/)).toBeTruthy();
    expect(screen.getAllByText('you have this').length).toBeGreaterThan(0);
    expect(screen.getByText(/Source: Public Greenhouse and Lever job boards \(18 of 20/)).toBeTruthy();

    // Learning links are searches without a stale year
    const yt = screen.getAllByRole('link').map(a => a.getAttribute('href')).filter(h => h.includes('youtube'));
    expect(yt.length).toBeGreaterThan(0);
    expect(yt.every(h => !h.includes('2024'))).toBe(true);
  });

  it('punching a ticket marks it learned, raises readiness and persists', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => respond(
      url === '/api/market' ? { requestId: 'm', market } : { requestId: 'r', report: fixture, meta: {} },
    ));
    render(<App />);
    addSkill('React');
    fireEvent.change(screen.getByLabelText('Target role'), { target: { value: 'Full Stack Developer' } });
    fireEvent.click(screen.getByRole('button', { name: /Plan my route/ }));
    await screen.findByText('Your ticket wallet');
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Punch when learned/ }).length).toBe(3));
    const before = screen.getByText(/of 7$/).textContent;
    fireEvent.click(screen.getAllByRole('button', { name: /Punch when learned/ })[0]);
    expect(screen.getByRole('button', { name: /Learned/, pressed: true })).toBeTruthy();
    expect(screen.getByText(/of 7$/).textContent).not.toBe(before);
    expect(JSON.parse(localStorage.getItem('skillmap.learned.v1'))).toHaveLength(1);
  });

  it('shows the friendly server error with field issues and keeps the inputs', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => respond({
      requestId: 'r2',
      error: { code: 'INVALID_INPUT', message: 'A couple of details need a quick tweak.', issues: [{ field: 'skills', message: 'Please list 25 skills or fewer' }] },
    }, 400));
    render(<App />);
    addSkill('Go');
    fireEvent.click(screen.getByRole('button', { name: /Plan my route/ }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/quick tweak.*25 skills or fewer/));
    expect(screen.getByRole('button', { name: 'Remove Go' })).toBeTruthy();
  });
});
