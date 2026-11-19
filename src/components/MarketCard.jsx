import { useMemo } from 'react';
import { Briefcase, CheckCircle, ExternalLink, Info, Loader2 } from 'lucide-react';
import { canonicalSkill, normalizeSkillList } from '../../shared/skills.js';

const fmtTime = (iso) => {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
};

const Note = ({ children }) => (
  <p style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#78716C', lineHeight: 1.6, margin: 0 }}>
    <Info size={13} color="#D97706" style={{ flexShrink: 0, marginTop: 3 }} />
    <span>{children}</span>
  </p>
);

/**
 * Real-posting skill demand for the target role (from /api/market).
 * Every number here is a count from fetched postings, shown with its source.
 */
export default function MarketCard({ state, userSkills, locationLabel }) {
  const mine = useMemo(() => new Set(normalizeSkillList(userSkills).map(s => s.id)), [userSkills]);
  const { status, market, error } = state;

  return (
    <div className="card fade-up" style={{ padding: 28 }} aria-live="polite">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #A7F3D0' }}>
          <Briefcase size={16} color="#047857" />
        </div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1C1917', margin: 0 }}>What Real Job Postings Ask For</h2>
      </div>

      {status === 'needs-role' && (
        <p style={{ fontSize: 13, color: '#78716C', lineHeight: 1.65, margin: 0 }}>
          Add a target role and we&apos;ll show which skills real postings for it mention, counted from live public job boards.
        </p>
      )}

      {status === 'loading' && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#78716C', margin: 0 }}>
          <Loader2 size={14} className="spin" /> Reading live job postings…
        </p>
      )}

      {status === 'error' && (
        <p style={{ fontSize: 13, color: '#78716C', lineHeight: 1.65, margin: 0 }}>
          We couldn&apos;t load live postings right now ({error}). Your AI roadmap is unaffected. Try again in a little while.
        </p>
      )}

      {status === 'ready' && market && (
        <>
          <p style={{ fontSize: 13, color: '#57534E', marginBottom: 14, lineHeight: 1.65 }}>
            Measured, not estimated: skills mentioned in <strong>{market.sampleSize}</strong> live{' '}
            <strong>{market.role}</strong> posting{market.sampleSize === 1 ? '' : 's'}
            {market.scope === 'location' ? <> in <strong>{locationLabel}</strong></> : ' across all locations'}
            {market.companies.length > 0 && <> from {market.companies.length} compan{market.companies.length === 1 ? 'y' : 'ies'}</>}.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {market.scope === 'global' && (
              <Note>Only {market.localMatches} matching posting{market.localMatches === 1 ? '' : 's'} in {locationLabel} on the boards we track, so this shows all locations.</Note>
            )}
            {market.sampleSize > 0 && market.lowSample && <Note>Small sample, so treat this as a hint rather than a trend.</Note>}
          </div>

          {market.sampleSize === 0 ? (
            <p style={{ fontSize: 13, color: '#78716C', margin: '0 0 16px' }}>
              No matching postings on the boards we track right now. Try a broader role name.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
              {market.skills.map(s => {
                const have = mine.has(canonicalSkill(s.skill)?.id);
                return (
                  <div key={s.skill}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, color: '#292524' }}>
                        {s.skill}
                        {have && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#047857', fontWeight: 600 }}>
                            <CheckCircle size={12} /> you have this
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 12, color: '#57534E', whiteSpace: 'nowrap' }}>
                        <strong style={{ color: '#047857' }}>{s.count}</strong> of {market.sampleSize} ({s.share}%)
                      </span>
                    </div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${s.share}%`, background: have ? '#10B981' : undefined }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {market.postings.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#A8A29E', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 9 }}>Example postings</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {market.postings.map(p => (
                  <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9A3412', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '5px 10px', textDecoration: 'none', maxWidth: '100%' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.company} · {p.title}</span>
                    <ExternalLink size={11} style={{ flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: 11.5, color: '#A8A29E', lineHeight: 1.6, margin: 0, borderTop: '1px solid #E7E0D8', paddingTop: 12 }}>
            Source: {market.source} ({market.boards.ok} of {market.boards.queried} boards responded), fetched {fmtTime(market.fetchedAt)}.
            Skills are matched with a fixed dictionary, so niche tools may be under-counted. These boards are used mostly by tech companies and startups.
          </p>
        </>
      )}
    </div>
  );
}
