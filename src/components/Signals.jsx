import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

const TrendIcon = ({ trend }) => {
  const Icon = trend === 'rising' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus;
  return <span className={`trend trend-${trend}`} title={trend}><Icon size={15} aria-label={trend} /></span>;
};

/** AI-estimated rising and fading skills, drawn with dashed (estimate) bars. */
export default function Signals({ rising, fading }) {
  return (
    <div className="grid-2">
      <section className="sheet sheet-pad" aria-labelledby="rising-h">
        <div className="sheet-title">
          <h3 id="rising-h">Rising demand</h3>
          <span className="mark mark-estimate">AI estimate</span>
        </div>
        <p className="sheet-sub">A relative score from 0 to 100: a direction, not a count of postings.</p>
        <div className="rows" style={{ marginTop: 8 }}>
          {rising.map(s => (
            <div className="row" key={s.skill}>
              <span className="row-name"><TrendIcon trend={s.trend} />{s.skill}</span>
              <span className="row-fig num est">{s.demandScore}<span className="dagger">†</span></span>
              <span className="bar is-est" aria-hidden="true"><i style={{ width: `${s.demandScore}%` }} /></span>
            </div>
          ))}
        </div>
      </section>

      <section className="sheet sheet-pad" aria-labelledby="fading-h">
        <div className="sheet-title">
          <h3 id="fading-h">Fading demand</h3>
          <span className="mark mark-estimate">AI estimate</span>
        </div>
        <p className="sheet-sub">Worth deprioritising for this goal. Double-check against postings you care about.</p>
        <ul className="fading" style={{ marginTop: 8 }}>
          {fading.map(s => (
            <li key={s.skill}>
              <h4>{s.skill}</h4>
              <p className="est">{s.reason}<span className="dagger">†</span></p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
