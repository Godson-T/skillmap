import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Network, TrendingUp, TrendingDown, Minus, Layers, Briefcase,
  GraduationCap, Zap, AlertTriangle, Clock, DollarSign,
  CheckCircle, Loader2, Play, Info,
  BarChart2, BookOpen
} from 'lucide-react';
import { LIMITS, LOCATIONS, SUGGESTED_SKILLS, TARGET_ROLES } from '../shared/options.js';
import { computeSkillGap } from '../shared/skills.js';
import { initialLayout, stepLayout, LAYOUT_TICKS } from './lib/graphLayout.js';

/* ─── HELPERS ────────────────────────────────────────────────────────────────── */
const DIFFICULTY = {
  Easy: { color: '#10B981', bg: '#ECFDF5', ring: 'rgba(16,185,129,0.25)' },
  Medium: { color: '#D97706', bg: '#FFF7ED', ring: 'rgba(217,119,6,0.25)' },
  Hard: { color: '#DC2626', bg: '#FEF2F2', ring: 'rgba(220,38,38,0.25)' },
};

const IMPACT_COLOR = { High: '#10B981', Medium: '#D97706', Low: '#A8A29E' };
const IMPACT_BG = { High: '#ECFDF5', Medium: '#FFF7ED', Low: '#F5F0EB' };

const TrendIcon = ({ trend }) => {
  if (trend === 'rising') return <TrendingUp size={13} color="#34D399" />;
  if (trend === 'declining') return <TrendingDown size={13} color="#F87171" />;
  return <Minus size={13} color="#64748B" />;
};

/* ─── KNOWLEDGE GRAPH CANVAS ─────────────────────────────────────────────────── */
const KnowledgeGraph = ({ data }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !data?.nodes?.length) return;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf;

    const W = canvas.width, H = canvas.height;
    const NODE_COLOR = { current: '#EA580C', bridge: '#D97706', target: '#10B981' };

    // Deterministic: positions are seeded from the node ids, and the force
    // simulation runs a fixed number of ticks, so a report always settles
    // into the same layout.
    const nodes = initialLayout(data.nodes, W, H);
    const edges = (data.edges || [])
      .map(e => ({ ...e, s: nodes.find(n => n.id === e.from), t: nodes.find(n => n.id === e.to) }))
      .filter(e => e.s && e.t);
    const tick = () => stepLayout(nodes, edges, W, H);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // subtle dot grid
      ctx.fillStyle = 'rgba(120, 113, 108, 0.05)';
      for (let x = 0; x < W; x += 44) for (let y = 0; y < H; y += 44) {
        ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
      }

      // edges
      edges.forEach(({ s, t, label }) => {
        const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
        grad.addColorStop(0, 'rgba(234, 88, 12, 0.12)');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.08)');
        ctx.beginPath();
        ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.5; ctx.stroke();
        if (label) {
          const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2;
          ctx.fillStyle = '#A8A29E';
          ctx.font = '10px Comfortaa, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(label, mx, my - 5);
        }
      });

      // nodes
      nodes.forEach(n => {
        const c = NODE_COLOR[n.type] || '#78716C';
        // halo
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 26);
        g.addColorStop(0, c + '15'); g.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(n.x, n.y, 26, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();
        // circle
        ctx.beginPath(); ctx.arc(n.x, n.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.shadowBlur = 8; ctx.shadowColor = c + '40'; ctx.fill(); ctx.shadowBlur = 0;
        // label
        ctx.fillStyle = '#44403C';
        ctx.font = '600 12px Comfortaa, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(n.label, n.x + 15, n.y + 4);
      });
    };

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let ticks = 0;
    if (reduceMotion) {
      while (ticks++ < LAYOUT_TICKS) tick();
      draw();
    } else {
      const loop = () => {
        tick(); draw();
        if (++ticks < LAYOUT_TICKS) raf = requestAnimationFrame(loop);
      };
      loop();
    }
    return () => cancelAnimationFrame(raf);
  }, [data]);

  return (
    <div className="graph-wrap" style={{ position: 'relative' }}>
      <canvas ref={ref} width={880} height={360} style={{ width: '100%', height: 360 }} />
      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 14, left: 14,
        display: 'flex', gap: 14,
        background: 'rgba(255,253,249,0.92)', backdropFilter: 'blur(8px)',
        border: '1px solid #E7E0D8', borderRadius: 10, padding: '8px 14px',
        fontSize: 11, color: '#78716C',
      }}>
        {[['#EA580C', 'Your Skills'], ['#D97706', 'Bridge Skills'], ['#10B981', 'Target Role']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── LOADING SCREEN ─────────────────────────────────────────────────────────── */
const Loader = () => (
  <div style={{ textAlign: 'center', padding: '72px 0' }}>
    <div style={{ width: 52, height: 52, borderRadius: '50%', border: '3px solid #F5D9B6', borderTopColor: '#EA580C', margin: '0 auto 24px', animation: 'spin 0.75s linear infinite' }} />
    <p style={{ fontSize: 18, fontWeight: 700, color: '#1C1917', marginBottom: 8 }}>Analyzing your career profile</p>
    <p style={{ fontSize: 13, color: '#78716C', marginBottom: 24 }}>Mapping how your skills connect and sketching your next steps…</p>
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {['Reading your skills', 'Finding bridge skills', 'Building your roadmap'].map((s, i) => (
        <span key={s} style={{ background: '#FFF1E6', border: '1px solid #FDBA74', color: '#9A3412', borderRadius: 8, padding: '4px 12px', fontSize: 12, animation: `pulse 1.8s ease-in-out ${i * 0.3}s infinite` }}>{s}</span>
      ))}
    </div>
  </div>
);

/* ─── LABEL ──────────────────────────────────────────────────────────────────── */
const Label = ({ children, hint }) => (
  <div style={{ marginBottom: 8 }}>
    <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#57534E', textTransform: 'none', letterSpacing: '0.02em' }}>{children}</span>
    {hint && <span style={{ fontSize: 11, color: '#A8A29E', marginTop: 3, display: 'block' }}>{hint}</span>}
  </div>
);

/* ─── APP ────────────────────────────────────────────────────────────────────── */
export default function App() {
  const [form, setForm] = useState({ skills: '', goal: '', location: 'US' });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);
  const [showSkillDrop, setShowSkillDrop] = useState(false);
  const [skillQuery, setSkillQuery] = useState('');
  const [showRoleDrop, setShowRoleDrop] = useState(false);
  const resultsRef = useRef(null);

  // Skill readiness — share of the career-path skills the user already has,
  // matched on a normalized taxonomy (aliases like "JS" -> "JavaScript").
  const skillGap = useMemo(
    () => (data && form.skills ? computeSkillGap(form.skills, data.careerPaths) : null),
    [data, form.skills],
  );

  useEffect(() => { if (data) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [data]);

  const reset = () => { setData(null); setMeta(null); setError(''); setTab(0); };

  /* API call — the server validates input, calls the model and validates the report */
  const analyze = async (e) => {
    e.preventDefault(); reset(); setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: form.skills, goal: form.goal, location: form.location }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.report) {
        const issues = json?.error?.issues?.map(i => i.message).join(' · ');
        throw new Error([json?.error?.message || `Something went wrong (HTTP ${res.status}).`, issues].filter(Boolean).join(' '));
      }
      setData(json.report);
      setMeta(json.meta ?? null);
    } catch (err) {
      setError(err instanceof TypeError ? 'We couldn\'t reach SkillMap. Check your connection and try again.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Smart skill autocomplete handlers
  const getCurrentWord = (val) => { const p = val.split(','); return p[p.length - 1].trim(); };
  const handleSkillChange = (e) => {
    const val = e.target.value;
    // The input only shows the in-progress word; replace just that word so
    // previously added skills are kept.
    const parts = form.skills.split(',');
    parts[parts.length - 1] = val;
    const next = parts.map((p, i) => (i < parts.length - 1 ? p.trim() : p.trimStart())).join(', ');
    f('skills', next);
    const word = getCurrentWord(next);
    setSkillQuery(word);
    setShowSkillDrop(word.length >= 1);
  };
  const addSkillFromDrop = (skill) => {
    const parts = form.skills.split(',');
    parts[parts.length - 1] = skill;
    f('skills', parts.map(p => p.trim()).filter(Boolean).join(', ') + ', ');
    setSkillQuery('');
    setShowSkillDrop(false);
  };
  const removeSkill = (sk) => {
    const rest = form.skills.split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== sk.toLowerCase());
    f('skills', rest.length ? rest.join(', ') + ', ' : '');
    setSkillQuery('');
  };

  // Derived
  const addedSkills = form.skills.split(',').map(s => s.trim()).filter(Boolean);
  const skillSugs = skillQuery.length >= 1
    ? SUGGESTED_SKILLS.filter(s =>
        s.toLowerCase().includes(skillQuery.toLowerCase()) &&
        !addedSkills.map(a => a.toLowerCase()).includes(s.toLowerCase())
      ).slice(0, 8)
    : [];
  const roleSugs = TARGET_ROLES.filter(r =>
    !form.goal || r.toLowerCase().includes(form.goal.toLowerCase())
  ).slice(0, 7);

  /* ── JSX ── */
  return (
    <div className="app-bg" style={{ minHeight: '100vh' }}>
      <div className="app-container" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px 100px', position: 'relative' }}>

        {/* ── HERO ── */}
        <header className="hero-header" style={{ padding: '52px 0 36px' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#FFF1E6', border: '1px solid #FDBA74', borderRadius: 20, padding: '5px 14px', marginBottom: 20, fontSize: 12, fontWeight: 600, color: '#C2410C', letterSpacing: '0.03em' }}>
            <Network size={12} /> SkillMap AI · Career Intelligence Platform
          </div>
          <h1 className="hero-title" style={{ fontSize: 40, fontWeight: 700, color: '#1C1917', lineHeight: 1.18, letterSpacing: '-0.02em', marginBottom: 16, maxWidth: 620 }}>
            Discover Your Ideal Career Path with AI
          </h1>
          <p style={{ fontSize: 15, color: '#57534E', lineHeight: 1.7, maxWidth: 540, marginBottom: 0 }}>
            Enter your current skills and target role. SkillMap AI maps your skill topology, pinpoints gaps, and builds a realistic roadmap for your growth.
          </p>
        </header>

        {/* ── INPUT CARD ── */}
        <div className="card card-violet" style={{ padding: '32px 36px', marginBottom: 28 }}>
          <div style={{ marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid #E7E0D8' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1C1917', marginBottom: 4 }}>Your Career Profile</h2>
            <p style={{ fontSize: 13, color: '#78716C' }}>Enter your skills · AI builds your career roadmap instantly</p>
          </div>

          <form onSubmit={analyze}>
            {/* Skills — smart autocomplete */}
            <div style={{ marginBottom: 18, position: 'relative' }}>
              <Label hint="Type a skill name and pick from the dropdown">Current Skills *</Label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field focus-indigo"
                  placeholder="Type to search — e.g. React, Python, Docker..."
                  value={skillQuery}
                  onChange={handleSkillChange}
                  maxLength={LIMITS.maxSkillLength}
                  aria-label="Current skills"
                  onFocus={() => { const w = getCurrentWord(form.skills); setSkillQuery(w); setShowSkillDrop(w.length >= 1); }}
                  onBlur={() => setTimeout(() => setShowSkillDrop(false), 160)}
                  autoComplete="off"
                />
                {/* hidden for validation */}
                <input type="hidden" required value={addedSkills.length > 0 ? 'ok' : ''} />
                {/* Dropdown */}
                {showSkillDrop && skillSugs.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#FFFFFF', border: '1px solid #FDBA74', borderRadius: 12, boxShadow: '0 12px 32px rgba(120,113,108,0.15)', zIndex: 200, overflow: 'hidden' }}>
                    {skillSugs.map(s => (
                      <button key={s} type="button"
                        onMouseDown={() => addSkillFromDrop(s)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', borderBottom: '1px solid #F5F0EB', cursor: 'pointer', fontSize: 13, color: '#44403C', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FFF1E6'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EA580C', flexShrink: 0 }} />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Added skill tags */}
              {addedSkills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {addedSkills.map(s => (
                    <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#F5F0EB', border: '1px solid #E7E0D8', color: '#44403C', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 500 }}>
                      {s}
                      <button type="button" onClick={() => removeSkill(s)}
                        style={{ background: 'none', border: 'none', color: '#A8A29E', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: 14 }}>&#x2715;</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Row 2 — Target Role + Location */}
            <div className="r-grid-2" style={{ marginBottom: 22 }}>
              <div style={{ position: 'relative' }}>
                <Label hint="Where you want to be in 2–3 years (optional)">Target Role</Label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="input-field focus-emerald"
                    placeholder="Type a role — e.g. AI Engineer..."
                    value={form.goal}
                    onChange={e => f('goal', e.target.value)}
                    maxLength={LIMITS.maxCustomGoalLength}
                    aria-label="Target role"
                    onFocus={() => setShowRoleDrop(true)}
                    onBlur={() => setTimeout(() => setShowRoleDrop(false), 160)}
                    autoComplete="off"
                  />
                  {showRoleDrop && roleSugs.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#FFFFFF', border: '1px solid #6EE7B7', borderRadius: 12, boxShadow: '0 12px 32px rgba(120,113,108,0.15)', zIndex: 200, overflow: 'hidden' }}>
                      {roleSugs.map(r => (
                        <button key={r} type="button"
                          onMouseDown={() => { f('goal', r); setShowRoleDrop(false); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px', background: 'none', border: 'none', borderBottom: '1px solid #F5F0EB', cursor: 'pointer', fontSize: 13, color: '#44403C', textAlign: 'left' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#ECFDF5'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', flexShrink: 0 }} />
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label hint="Affects salary ranges & market context">Location</Label>
                <select className="input-field" value={form.location} onChange={e => f('location', e.target.value)}
                  style={{ cursor: 'pointer' }}>
                  {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                Analyze My Career
              </button>
            </div>
          </form>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <AlertTriangle size={18} color="#F87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#F87171', marginBottom: 4 }}>Analysis failed</p>
              <p style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.6 }}>{error}</p>
              <p style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>Your inputs are still here — adjust them if needed and try again.</p>
            </div>
          </div>
        )}

        {/* ── LOADING ── */}
        {loading && <Loader />}

        {/* ── RESULTS ── */}
        {data && !loading && (
          <div ref={resultsRef} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Success strip + Skill Gap Meter */}
            <div className="fade-up" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12, fontSize: 13, color: '#047857', fontWeight: 500, flexWrap: 'wrap' }}>
              <CheckCircle size={16} /> Analysis complete — here&apos;s your personalized career roadmap
              {skillGap !== null && (
                <div
                  title={`You already have ${skillGap.matched.length} of ${skillGap.total} skills these paths call for.${skillGap.missing.length ? ` Still to learn: ${skillGap.missing.slice(0, 8).join(', ')}${skillGap.missing.length > 8 ? '…' : ''}` : ''}`}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#57534E' }}>Skill Readiness:</span>
                  <div style={{ position: 'relative', width: 100, height: 8, background: '#E7E0D8', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${skillGap.percent}%`, background: skillGap.percent > 65 ? '#10B981' : skillGap.percent > 35 ? '#D97706' : '#EF4444', borderRadius: 99, transition: 'width 1s ease' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: skillGap.percent > 65 ? '#10B981' : skillGap.percent > 35 ? '#D97706' : '#EF4444' }}>{skillGap.percent}%</span>
                </div>
              )}
            </div>

            {/* AI-estimate notice: nothing below is measured market data */}
            <div className="fade-up" role="note" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 18px', background: '#FFFBF5', border: '1px solid #FED7AA', borderRadius: 12, fontSize: 12.5, color: '#57534E', lineHeight: 1.6 }}>
              <Info size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                <strong style={{ color: '#9A3412' }}>AI estimate.</strong>{' '}
                {meta?.disclaimer || 'Generated by a language model from your inputs, not from live job-market data. Use it as a starting point, not a forecast.'}
              </span>
            </div>

            {/* 1 · KNOWLEDGE GRAPH */}
            <div className="card card-violet fade-up delay-1" style={{ padding: 28 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FFF1E6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FDBA74' }}>
                    <Network size={16} color="#EA580C" />
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1917', margin: 0 }}>Skill Topology Map</h2>
                </div>
                <p style={{ fontSize: 13, color: '#78716C', lineHeight: 1.65 }}>
                  A physics-simulated graph of how your skills connect to your target role through bridge technologies. Nodes settle into place via force-direction.
                </p>
              </div>
              <KnowledgeGraph data={data.knowledgeGraph} />
            </div>

            {/* 2 · RISING + DYING */}
            <div className="r-grid-2 fade-up delay-2">

              {/* Rising */}
              <div className="card card-indigo" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FFF1E6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FDBA74' }}>
                    <TrendingUp size={16} color="#EA580C" />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1C1917', margin: 0 }}>High-Demand Skills</h3>
                </div>
                <p style={{ fontSize: 12, color: '#78716C', marginBottom: 22, lineHeight: 1.6 }}>AI-estimated relative demand (0–100) — a directional signal, not measured job-posting counts.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 17 }}>
                  {data.risingSkills.map((s, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, color: '#292524' }}>
                          <TrendIcon trend={s.trend} /> {s.skill}
                        </span>
                        <span title="AI-estimated relative demand score" style={{ fontSize: 12, fontWeight: 600, color: '#EA580C' }}>{s.demandScore}<span style={{ fontSize: 10, fontWeight: 500, color: '#A8A29E' }}> est.</span></span>
                      </div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${s.demandScore}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dying */}
              <div className="card card-red" style={{ padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FCA5A5' }}>
                    <TrendingDown size={16} color="#EF4444" />
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1C1917', margin: 0 }}>Declining Skills</h3>
                </div>
                <p style={{ fontSize: 12, color: '#78716C', marginBottom: 22, lineHeight: 1.6 }}>Skills the AI expects to matter less for your goal — consider deprioritizing them, and double-check against postings you care about.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {data.dyingSkills.map((s, i) => (
                    <div key={i} style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                        <span style={{ textDecoration: 'line-through', textDecorationColor: '#EF4444', textDecorationThickness: 2, color: '#78716C', fontSize: 14, fontWeight: 600 }}>{s.skill}</span>
                      </div>
                      <p style={{ fontSize: 12, color: '#57534E', lineHeight: 1.65, margin: 0 }}>{s.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3 · CAREER PATHS */}
            <div className="card card-amber fade-up delay-3" style={{ padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FDBA74' }}>
                  <Layers size={16} color="#D97706" />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1917', margin: 0 }}>Career Trajectories</h2>
              </div>
              <p style={{ fontSize: 13, color: '#78716C', marginBottom: 24, lineHeight: 1.65 }}>
                AI-suggested paths from your skills to high-value roles. Timelines and upside are estimates — adjust them to the hours you can invest.
              </p>

              {/* Tabs */}
              <div className="tab-group" style={{ marginBottom: 28 }}>
                {data.careerPaths.map((p, i) => (
                  <button key={i} className={`tab-item ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>
                    {p.pathName}
                  </button>
                ))}
              </div>

              {/* Active path */}
              {(() => {
                const path = data.careerPaths[tab];
                const d = DIFFICULTY[path.difficulty] || DIFFICULTY.Medium;
                return (
                  <>
                    {/* Summary row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, padding: '16px 20px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 14 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 17, fontWeight: 700, color: '#1C1917', marginBottom: 8 }}>{path.pathName}</p>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#78716C' }}>
                            <Clock size={13} color="#D97706" /> <span>Timeline: <strong style={{ color: '#1C1917' }}>{path.totalTime}</strong></span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#78716C' }}>
                            <BarChart2 size={13} color="#D97706" /> <span>Difficulty: <strong style={{ color: d.color }}>{path.difficulty}</strong></span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#78716C' }}>
                            <BookOpen size={13} color="#D97706" /> {path.steps.length} phases
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timeline steps */}
                    <div style={{ position: 'relative', paddingLeft: 44 }}>
                      <div className="tl-line" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        {path.steps.map((step, idx) => (
                          <div key={idx} className="step-card" style={{ position: 'relative' }}>
                            <div className="tl-dot" style={{ left: -32 }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid #E7E0D8' }}>
                              <div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 5 }}>Phase {idx + 1}</span>
                                <h4 style={{ fontSize: 16, fontWeight: 700, color: '#1C1917', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Briefcase size={14} color="#D97706" /> {step.role}
                                </h4>
                              </div>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFF7ED', border: '1px solid #FDBA74', borderRadius: 9, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#D97706', whiteSpace: 'nowrap' }}>
                                <Clock size={11} /> ~{step.timeMonths} months
                              </span>
                            </div>

                            {/* Skills */}
                            <div style={{ marginBottom: 14 }}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 9 }}>Skills to acquire</p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                                {step.skillsNeeded.map((sk, j) => (
                                  <span key={j} style={{ background: '#FFF1E6', border: '1px solid #FFEDD5', color: '#9A3412', borderRadius: 7, padding: '4px 11px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                                    {sk}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* ROI */}
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '10px 14px' }}>
                              <DollarSign size={14} color="#047857" style={{ flexShrink: 0, marginTop: 1 }} />
                              <p style={{ fontSize: 13, color: '#57534E', margin: 0, lineHeight: 1.65 }}>
                                <strong style={{ color: '#047857', marginRight: 4 }}>Upside (AI estimate):</strong>{step.roi}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* 4 · MICRO-SKILLS */}
            <div className="fade-up delay-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #A7F3D0' }}>
                  <Zap size={16} color="#10B981" />
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1917', margin: 0 }}>High-Yield Micro-Skills</h2>
              </div>
              <p style={{ fontSize: 13, color: '#78716C', marginBottom: 18, lineHeight: 1.6 }}>Quick wins, ranked by the AI&apos;s estimate of career impact. Start with <strong style={{ color: '#047857' }}>High</strong> impact items to accelerate your transition.</p>
              <div className="r-grid-4">
                {data.topMicroSkills.map((ms, i) => (
                  <div key={i} className="skill-chip">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <GraduationCap size={15} color="#A8A29E" />
                      <span style={{ background: IMPACT_BG[ms.impact], color: IMPACT_COLOR[ms.impact], border: `1px solid ${IMPACT_COLOR[ms.impact]}40`, borderRadius: 6, padding: '2px 9px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        {ms.impact}
                      </span>
                    </div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1C1917', marginBottom: 8, lineHeight: 1.4 }}>{ms.skill}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#78716C', marginBottom: 12 }}>
                      <Clock size={11} /> {ms.learnTime} to learn
                    </div>
                    {/* Course links */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid #E7E0D8', paddingTop: 10 }}>
                      {[
                        { label: 'Search Udemy', url: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(ms.skill)}`, color: '#a435f0' },
                        { label: 'Search Coursera', url: `https://www.coursera.org/search?query=${encodeURIComponent(ms.skill)}`, color: '#0056D2' },
                        { label: 'Search freeCodeCamp', url: `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(ms.skill)}`, color: '#006400' },
                      ].map(c => (
                        <a key={c.label} href={c.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, fontWeight: 600, color: c.color, background: `${c.color}14`, border: `1px solid ${c.color}30`, borderRadius: 5, padding: '2px 7px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          {c.label} →
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5 · YOUTUBE RESOURCES */}
            {(() => {
              const allSkills = new Set();
              data.topMicroSkills?.forEach(ms => allSkills.add(ms.skill));
              data.careerPaths?.forEach(p => p.steps?.forEach(s => s.skillsNeeded?.forEach(sk => allSkills.add(sk))));
              const skills = [...allSkills].slice(0, 12);
              const YTIcon = () => (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#EF4444" style={{ flexShrink: 0 }}>
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              );
              return (
                <div className="card fade-up" style={{ padding: 28, border: '1px solid #FCA5A5', background: '#FEF2F2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #FCA5A5' }}>
                      <YTIcon />
                    </div>
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1917', margin: 0 }}>Find Tutorials on YouTube</h2>
                  </div>
                  <p style={{ fontSize: 13, color: '#78716C', marginBottom: 20, lineHeight: 1.6 }}>
                    One-click YouTube searches for the skills on your roadmap. Results come straight from YouTube, so check the upload date and the creator before you dive in.
                  </p>
                  <div className="r-grid-3">
                    {skills.map((skill, i) => (
                      <a
                        key={i}
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${skill} tutorial`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: '#FFFFFF',
                          border: '1px solid #FCA5A5',
                          borderRadius: 12, padding: '13px 16px',
                          textDecoration: 'none', transition: 'all 0.18s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FFF5F5'; e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#FCA5A5'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <YTIcon />
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#1C1917', margin: 0, marginBottom: 3 }}>{skill}</p>
                          <p style={{ fontSize: 11, color: '#EF4444', margin: 0, fontWeight: 500 }}>Search tutorials →</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

          </div>
        )}
      </div>
    </div>
  );
}
