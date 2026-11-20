import { useMemo } from 'react';
import { Check, ExternalLink, Info } from 'lucide-react';
import { canonicalSkill, normalizeSkillList } from '../../shared/skills.js';
import { partialNote } from '../lib/marketCopy.js';

const fmtTime = (iso) => {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
};

function SkeletonRows() {
  return (
    <div className="rows" aria-hidden="true">
      {[78, 64, 52, 41, 33].map(w => (
        <div className="row" key={w}>
          <span className="skeleton" style={{ width: `${w * 0.6}%` }} />
          <span className="skeleton" style={{ width: 54 }} />
          <span className="skeleton" style={{ gridColumn: '1 / -1', width: `${w}%`, height: 6 }} />
        </div>
      ))}
    </div>
  );
}

/** Measured skill demand from live job postings (POST /api/market). */
export default function PostingsBoard({ state, userSkills, locationLabel }) {
  const mine = useMemo(() => new Set(normalizeSkillList(userSkills).map(s => s.id)), [userSkills]);
  const { status, market, error } = state;

  return (
    <section className="sheet sheet-pad" aria-labelledby="postings-h" aria-busy={status === 'loading'}>
      <div className="sheet-title">
        <h3 id="postings-h">What real job postings ask for</h3>
        <span className="mark mark-measured">Measured</span>
      </div>

      {status === 'needs-role' && (
        <p className="sheet-sub">Add a target role to the slip and we’ll count which skills live postings for it mention.</p>
      )}

      {status === 'loading' && (
        <>
          <p className="sheet-sub" role="status">Reading live job postings…</p>
          <div style={{ marginTop: 12 }}><SkeletonRows /></div>
        </>
      )}

      {status === 'error' && (
        <p className="sheet-sub">We couldn’t load live postings right now ({error}). Your route below is unaffected; try again in a little while.</p>
      )}

      {status === 'ready' && market && (
        <>
          <p className="sheet-sub">
            Counted from <b className="num">{market.sampleSize}</b> live <b>{market.role}</b> posting{market.sampleSize === 1 ? '' : 's'}
            {market.scope === 'location' ? <> in <b>{locationLabel}</b></> : ' across all regions'}
            {market.companies.length > 0 && <> at {market.companies.length} compan{market.companies.length === 1 ? 'y' : 'ies'}</>}.
          </p>

          {(market.scope === 'global' || (market.sampleSize > 0 && market.lowSample) || market.degraded) && (
            <div className="notes">
              {market.degraded && (
                <p><Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                  {partialNote(market)}</p>
              )}
              {market.scope === 'global' && (
                <p><Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                  Only {market.localMatches} matching posting{market.localMatches === 1 ? '' : 's'} in {locationLabel} on the boards we track, so this counts all regions.</p>
              )}
              {market.sampleSize > 0 && market.lowSample && (
                <p><Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                  Small sample: read it as a hint, not a trend.</p>
              )}
            </div>
          )}

          {market.sampleSize === 0 ? (
            <p className="sheet-sub" style={{ marginTop: 10 }}>No matching postings on the boards we track right now. Try a broader role name.</p>
          ) : (
            <div className="rows" style={{ marginTop: 8 }}>
              {market.skills.map(s => {
                const have = mine.has(canonicalSkill(s.skill)?.id);
                return (
                  <div className="row" key={s.skill}>
                    <span className="row-name">
                      {s.skill}
                      {have && <span className="held-tag"><Check size={12} aria-hidden="true" />you have this</span>}
                    </span>
                    <span className="row-fig num"><b>{s.count}</b> of {market.sampleSize} ({s.share}%)</span>
                    <span className={`bar${have ? ' is-held' : ''}`} aria-hidden="true"><i style={{ width: `${s.share}%` }} /></span>
                  </div>
                );
              })}
            </div>
          )}

          {market.postings.length > 0 && (
            <div className="postings" aria-label="Example postings">
              {market.postings.map(p => (
                <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer">
                  <span>{p.company} · {p.title}</span><ExternalLink size={12} aria-hidden="true" />
                </a>
              ))}
            </div>
          )}

          <p className="source">
            Source: {market.source} ({market.boards.ok} of {market.boards.queried} boards responded), fetched {fmtTime(market.fetchedAt)}.
            Skills are matched against a fixed dictionary, so niche tools may be under-counted. These boards are used mostly by tech companies and startups.
          </p>
        </>
      )}
    </section>
  );
}
