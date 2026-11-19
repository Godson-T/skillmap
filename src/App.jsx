import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Route, Ticket, TableProperties } from 'lucide-react';
import { LOCATIONS } from '../shared/options.js';
import { canonicalSkill, computeSkillGap } from '../shared/skills.js';
import BookingSlip from './components/BookingSlip.jsx';
import Logo from './components/Logo.jsx';
import PostingsBoard from './components/PostingsBoard.jsx';
import QuickWins from './components/QuickWins.jsx';
import RouteMap from './components/RouteMap.jsx';
import Signals from './components/Signals.jsx';
import { NextTickets, Readiness } from './components/Tickets.jsx';
import Timetable from './components/Timetable.jsx';
import { pickNextSkills } from './lib/nextSkills.js';

const LEARNED_KEY = 'skillmap.learned.v1';
const loadLearned = () => {
  try { return new Set(JSON.parse(localStorage.getItem(LEARNED_KEY) || '[]')); } catch { return new Set(); }
};

const NAV = [
  ['#plan', 'Plan'],
  ['#tickets', 'Next tickets'],
  ['#timetable', 'Timetable'],
  ['#postings', 'Postings'],
  ['#signals', 'Demand'],
  ['#map', 'Route map'],
  ['#quick-wins', 'Quick wins'],
];

function Legend() {
  return (
    <div className="sheet legend" aria-label="How to read your route">
      <div>
        <Ticket size={22} color="var(--rail)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div><h3>Three tickets</h3><p>The next skills to learn, picked from real postings first. Punch each one when you’ve learned it.</p></div>
      </div>
      <div>
        <TableProperties size={22} color="var(--rail)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div><h3>A timetable</h3><p>Each career path laid out stop by stop: the role, when you arrive, and the skills you pick up on the way.</p></div>
      </div>
      <div>
        <Route size={22} color="var(--rail)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
        <div><h3>Measured or estimated</h3><p>Solid figures are counted from live job postings. Anything marked <b>†</b> is an AI estimate.</p></div>
      </div>
    </div>
  );
}

function LoadingRoute() {
  return (
    <div className="sheet sheet-pad" role="status" aria-live="polite">
      <p className="sheet-sub">Planning your route. This usually takes 10–20 seconds.</p>
      <div className="rows" style={{ marginTop: 12 }} aria-hidden="true">
        {[92, 76, 84, 60].map(w => (
          <div className="row" key={w}><span className="skeleton" style={{ width: `${w}%` }} /><span className="skeleton" style={{ width: 48 }} /></div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [skills, setSkills] = useState([]);
  const [draft, setDraft] = useState('');
  const [goal, setGoal] = useState('');
  const [location, setLocation] = useState('US');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [marketState, setMarketState] = useState({ status: 'idle' });
  const [submitted, setSubmitted] = useState(null); // inputs of the last run
  const [learned, setLearned] = useState(loadLearned);
  const resultsRef = useRef(null);

  const allSkills = useMemo(() => [...skills, draft.trim()].filter(Boolean), [skills, draft]);
  const runSkills = submitted?.skills ?? allSkills;
  const learnedLabels = useMemo(() => [...learned], [learned]);
  const ownedSkills = useMemo(() => [...runSkills, ...learnedLabels], [runSkills, learnedLabels]);
  const locationLabel = (LOCATIONS.find(l => l.value === (submitted?.location ?? location))?.label ?? location).replace(/^\S+\s/, '');

  const gap = useMemo(() => (data ? computeSkillGap(ownedSkills, data.careerPaths) : null), [data, ownedSkills]);
  const tickets = useMemo(
    () => (data ? pickNextSkills({ userSkills: runSkills, report: data, market: marketState.market }) : []),
    [data, runSkills, marketState.market],
  );
  const routeSkills = useMemo(() => {
    const seen = new Map();
    for (const p of data?.careerPaths ?? []) for (const st of p.steps) for (const s of st.skillsNeeded) {
      const c = canonicalSkill(s); if (c && !seen.has(c.id)) seen.set(c.id, s);
    }
    return [...seen.values()].slice(0, 12);
  }, [data]);

  useEffect(() => {
    try { localStorage.setItem(LEARNED_KEY, JSON.stringify([...learned])); } catch { /* storage unavailable */ }
  }, [learned]);
  useEffect(() => { if (data) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [data]);

  const toggleLearned = (id) => setLearned(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /* Live job-posting data runs in parallel and independently of the AI report */
  const loadMarket = async ({ goal: g, location: loc }) => {
    if (!g.trim()) { setMarketState({ status: 'needs-role' }); return; }
    setMarketState({ status: 'loading' });
    try {
      const res = await fetch('/api/market', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: g, location: loc }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.market) throw new Error(json?.error?.message || `HTTP ${res.status}`);
      setMarketState({ status: 'ready', market: json.market });
    } catch (err) {
      setMarketState({ status: 'error', error: err instanceof TypeError ? 'network error' : err.message });
    }
  };

  /* AI report — the server validates input, calls the model and validates the report */
  const analyze = async () => {
    const run = { skills: allSkills, goal, location };
    setSubmitted(run);
    setData(null); setMeta(null); setError(''); setTab(0);
    setLoading(true);
    loadMarket(run);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(run),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.report) {
        const issues = json?.error?.issues?.map(i => i.message).join(' · ');
        throw new Error([json?.error?.message || `Something went wrong (HTTP ${res.status}).`, issues].filter(Boolean).join(' '));
      }
      setData(json.report);
      setMeta(json.meta ?? null);
    } catch (err) {
      setError(err instanceof TypeError ? 'We couldn’t reach SkillMap. Check your connection and try again.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const nav = data ? NAV : NAV.slice(0, 1);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="wordmark" href="#plan" aria-label="SkillMap, back to the planner">
            <Logo />
            <span className="wordmark-name">SkillMap</span>
          </a>
          <nav className="topnav" aria-label="Sections">
            {nav.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          </nav>
        </div>
      </header>

      <main className="page">
        <div className="intro" id="plan">
          <div>
            <h1>Plan the route from the skills you have to the role you want</h1>
            <p>Tell us where you’re starting and where you’re headed. You’ll get your next three skills to learn, a timetable for getting there, and what real job postings ask for.</p>
          </div>
        </div>

        <BookingSlip
          skills={skills} setSkills={setSkills} draft={draft} setDraft={setDraft}
          goal={goal} setGoal={setGoal} location={location} setLocation={setLocation}
          onSubmit={analyze} loading={loading}
        />

        {!data && !loading && !error && marketState.status === 'idle' && (
          <div className="section"><Legend /></div>
        )}

        {error && (
          <div className="section notice notice-warn" role="alert">
            <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p><strong>We couldn’t plan your route this time.</strong> {error}</p>
              <p>Your inputs are still on the slip. Adjust them if needed and try again.</p>
            </div>
          </div>
        )}

        {loading && <div className="section"><LoadingRoute /></div>}

        {data && !loading && (
          <div ref={resultsRef}>
            <section className="section" id="tickets" aria-labelledby="tickets-h">
              <div className="section-head">
                <h2 id="tickets-h">Your next three tickets</h2>
                <p>Start here. Measured picks come from real postings; the rest are AI suggestions from your route.</p>
              </div>
              <div className="grid-main">
                <NextTickets
                  tickets={tickets} learned={learned} onToggle={toggleLearned} locationLabel={locationLabel}
                  waitingForPostings={marketState.status === 'loading'}
                />
                <Readiness gap={gap} />
              </div>
            </section>

            <section className="section" id="timetable" aria-labelledby="timetable-h">
              <div className="section-head">
                <h2 id="timetable-h">Your timetable</h2>
                <p>Each path, stop by stop. Arrival times and upside are AI estimates; adjust them to the hours you can put in.</p>
              </div>
              <Timetable paths={data.careerPaths} tab={tab} setTab={setTab} userSkills={ownedSkills} />
            </section>
          </div>
        )}

        {marketState.status !== 'idle' && (
          <section className="section" id="postings" aria-label="Real job postings">
            <PostingsBoard state={marketState} userSkills={ownedSkills} locationLabel={locationLabel} />
          </section>
        )}

        {data && !loading && (
          <>
            <section className="section" id="signals" aria-labelledby="signals-h">
              <div className="section-head"><h2 id="signals-h">Where demand is heading</h2></div>
              <Signals rising={data.risingSkills} fading={data.dyingSkills} />
            </section>

            <section className="section" id="map" aria-labelledby="map-h">
              <div className="section-head">
                <h2 id="map-h">Route map</h2>
                <p>How the skills you hold connect, through bridge skills, to your target role.</p>
              </div>
              <RouteMap graph={data.knowledgeGraph} />
            </section>

            <section className="section" id="quick-wins" aria-labelledby="qw-h">
              <div className="section-head">
                <h2 id="qw-h">Quick wins</h2>
                <p>Small skills with a big payoff, plus searches to find a course. Links open search results, not vetted courses.</p>
              </div>
              <QuickWins micro={data.topMicroSkills} routeSkills={routeSkills} />
            </section>
          </>
        )}

        <footer className="footer">
          <span>
            <b>†</b> AI estimate. {meta?.disclaimer || 'Generated by a language model from your inputs, not from live job-market data. Use it as a starting point, not a forecast.'}
          </span>
          <span>Measured figures are counted from public Greenhouse and Lever job boards.</span>
        </footer>
      </main>
    </>
  );
}
