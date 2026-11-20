import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Printer, Share2 } from 'lucide-react';
import { LOCATIONS } from '../shared/options.js';
import { canonicalSkill, computeSkillGap } from '../shared/skills.js';
import BookingSlip from './components/BookingSlip.jsx';
import Logo from './components/Logo.jsx';
import PostingsBoard from './components/PostingsBoard.jsx';
import QuickWins from './components/QuickWins.jsx';
import RouteMap from './components/RouteMap.jsx';
import Signals from './components/Signals.jsx';
import { NextTickets, Stub, Wallet } from './components/Tickets.jsx';
import Timetable from './components/Timetable.jsx';
import { pickNextSkills } from './lib/nextSkills.js';
import { ApiError, isAbort, postJSON } from './lib/api.js';

const LEARNED_KEY = 'skillmap.learned.v1';
const loadLearned = () => {
  try {
    const v = JSON.parse(localStorage.getItem(LEARNED_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
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

/** Empty state: a specimen of what a run produces, labelled as sample data. */
function Specimen() {
  const sample = { id: 'docker', skill: 'Docker', evidence: 'measured', count: 12, sample: 40, alsoOnPath: true };
  return (
    <section aria-labelledby="specimen-h">
      <div className="specimen-cap">
        <h2 id="specimen-h">What you’ll get</h2>
        <p>An example route with sample data. Solid figures are counted from live postings; <b>†</b> marks an AI estimate.</p>
      </div>
      <div className="specimen">
        <ol className="tickets" style={{ gridTemplateColumns: '1fr' }} aria-label="Example ticket">
          <Stub t={sample} serial={1} destination="Backend Engineer" sample />
        </ol>
        <div className="sheet">
          <div className="table-wrap">
            <table className="tt stack">
              <caption className="sr-only">Example timetable</caption>
              <thead>
                <tr>
                  <th scope="col" className="stop">Stop</th>
                  <th scope="col">Station (role)</th>
                  <th scope="col">Arrives<span className="dagger">†</span></th>
                  <th scope="col">Via (skills to learn)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="stop"><span className="stop-dot num">1</span></td>
                  <td className="station">Junior Backend Developer</td>
                  <td className="arrives num">+4 mo<small>4 mo on this leg</small></td>
                  <td className="wide"><span className="via"><span>SQL</span><span>REST APIs</span></span></td>
                </tr>
                <tr>
                  <td className="stop"><span className="stop-dot num">2</span></td>
                  <td className="station">Backend Engineer</td>
                  <td className="arrives num">+10 mo<small>6 mo on this leg</small></td>
                  <td className="wide"><span className="via"><span>Docker</span><span>Kubernetes</span></span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="specimen-note">Each path you get is laid out stop by stop like this. Punch a ticket when you’ve learned the skill and your wallet fills up.</p>
        </div>
      </div>
    </section>
  );
}

function routeSummary({ goal, locationLabel, tickets, path }) {
  const lines = [`My SkillMap route${goal ? ` to ${goal}` : ''} (${locationLabel})`, '', 'Next skills to learn:'];
  tickets.forEach((t, i) => lines.push(`${i + 1}. ${t.skill}${t.evidence === 'measured' ? ` (in ${t.count} of ${t.sample} real postings)` : ' (AI suggestion)'}`));
  if (path) {
    let m = 0;
    lines.push('', `Timetable, ${path.pathName}:`);
    path.steps.forEach(st => { m += st.timeMonths; lines.push(`- ${st.role}: about +${m} months, via ${st.skillsNeeded.join(', ')}`); });
    lines.push('Timings are AI estimates.');
  }
  return lines.join('\n');
}

function ShareBar({ summary }) {
  const [status, setStatus] = useState('');
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: 'My SkillMap route', text: summary }); return; }
      await navigator.clipboard.writeText(summary);
      setStatus('Route copied to your clipboard');
    } catch (err) {
      if (err?.name !== 'AbortError') setStatus('Couldn’t share from this browser. Try Print instead.');
    }
  };
  return (
    <div className="sharebar">
      <button type="button" className="btn btn-quiet" onClick={share}><Share2 size={15} aria-hidden="true" />Share route</button>
      <button type="button" className="btn btn-quiet" onClick={() => window.print()}><Printer size={15} aria-hidden="true" />Print or save as PDF</button>
      <span className="status" role="status">{status}</span>
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
  const learnedLabels = useMemo(() => Object.keys(learned), [learned]);
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
    return [...seen.values()];
  }, [data]);

  useEffect(() => {
    try { localStorage.setItem(LEARNED_KEY, JSON.stringify(learned)); } catch { /* storage unavailable */ }
  }, [learned]);
  useEffect(() => { if (data) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [data]);

  const toggleLearned = (id) => setLearned(prev => {
    const next = { ...prev };
    if (next[id]) delete next[id]; else next[id] = new Date().toISOString();
    return next;
  });
  const summary = useMemo(
    () => (data ? routeSummary({ goal: submitted?.goal, locationLabel, tickets, path: data.careerPaths[tab] }) : ''),
    [data, submitted, locationLabel, tickets, tab],
  );

  /* Each run owns an AbortController; a newer run (or unmount) cancels the old
     one, so a slow stale response can never overwrite newer results. */
  const runRef = useRef(null);
  useEffect(() => () => runRef.current?.abort(), []);

  /* Live job-posting data runs in parallel and independently of the AI report */
  const loadMarket = async ({ goal: g, location: loc }, signal) => {
    if (!g.trim()) { setMarketState({ status: 'needs-role' }); return; }
    setMarketState({ status: 'loading' });
    try {
      const json = await postJSON('/api/market', { goal: g, location: loc }, { signal });
      if (!json.market) throw new ApiError('Job-posting data came back empty.');
      setMarketState({ status: 'ready', market: json.market });
    } catch (err) {
      if (isAbort(err)) return;
      setMarketState({ status: 'error', error: err.network ? 'network error' : err.message });
    }
  };

  /* AI report — the server validates input, calls the model and validates the report */
  const analyze = async () => {
    runRef.current?.abort();
    const ac = new AbortController();
    runRef.current = ac;
    const run = { skills: allSkills, goal, location };
    setSubmitted(run);
    setData(null); setMeta(null); setError(''); setTab(0);
    setLoading(true);
    loadMarket(run, ac.signal);
    try {
      const json = await postJSON('/api/analyze', run, { signal: ac.signal });
      if (!json.report) throw new ApiError('We couldn’t put together a complete report this time. Please try again.');
      setData(json.report);
      setMeta(json.meta ?? null);
    } catch (err) {
      if (isAbort(err)) return;
      setError(err.message);
    } finally {
      if (runRef.current === ac) setLoading(false);
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
          <div className="section"><Specimen /></div>
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
                <ShareBar summary={summary} />
              </div>
              <p className="sheet-sub" style={{ margin: '-4px 0 14px' }}>Start here. Measured picks come from real postings; the rest are AI suggestions from your route.</p>
              <NextTickets
                tickets={tickets} learned={learned} onToggle={toggleLearned} locationLabel={locationLabel}
                destination={submitted?.goal} waitingForPostings={marketState.status === 'loading'}
              />
              <div style={{ marginTop: 16 }}>
                <Wallet gap={gap} learned={learned} routeSkills={routeSkills} />
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
              <QuickWins micro={data.topMicroSkills} routeSkills={routeSkills.slice(0, 12)} />
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
