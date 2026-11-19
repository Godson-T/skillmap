// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import fixture from './fixtures/report.json';

const addSkill = (input, value) => {
  fireEvent.change(input, { target: { value } });
  fireEvent.change(input, { target: { value: `${value},` } }); // typing a comma commits the skill
};

describe('App form → results', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('keeps earlier skills when the next one is typed (regression)', () => {
    render(<App />);
    const input = screen.getByLabelText('Current skills');
    addSkill(input, 'React');
    fireEvent.change(input, { target: { value: 'Pyth' } });
    expect(screen.getByText('React')).toBeTruthy();
    expect(screen.getByText('Pyth')).toBeTruthy();
  });

  it('submits validated fields and renders the report with estimate labels', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      requestId: 'r1', report: fixture, meta: { estimate: true, disclaimer: 'Test disclaimer.' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    render(<App />);
    const input = screen.getByLabelText('Current skills');
    addSkill(input, 'JavaScript');
    addSkill(input, 'React');
    fireEvent.change(screen.getByLabelText('Target role'), { target: { value: 'Full Stack Developer' } });
    fireEvent.click(screen.getByRole('button', { name: /Analyze My Career/i }));

    await screen.findByText('Skill Topology Map');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.skills.split(',').map(s => s.trim()).filter(Boolean)).toEqual(['JavaScript', 'React']);
    expect(body).toMatchObject({ goal: 'Full Stack Developer', location: 'US' });

    expect(screen.getByText('Test disclaimer.')).toBeTruthy();
    expect(screen.getAllByText(/Upside \(AI estimate\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Full Stack Track').length).toBeGreaterThan(0);
    // React is one of 7 distinct needed skills in the fixture → 14%
    expect(screen.getByText('14%')).toBeTruthy();
    const yt = screen.getAllByRole('link').map(a => a.getAttribute('href')).filter(h => h.includes('youtube'));
    expect(yt.length).toBeGreaterThan(0);
    expect(yt.every(h => !h.includes('2024'))).toBe(true);
  });

  it('shows the friendly server error message and field issues', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      requestId: 'r2',
      error: { code: 'INVALID_INPUT', message: 'A couple of details need a quick tweak.', issues: [{ field: 'skills', message: 'Please list 25 skills or fewer' }] },
    }), { status: 400 }));

    render(<App />);
    addSkill(screen.getByLabelText('Current skills'), 'Go');
    fireEvent.click(screen.getByRole('button', { name: /Analyze My Career/i }));
    await waitFor(() => expect(screen.getByText(/quick tweak.*25 skills or fewer/)).toBeTruthy());
  });
});
