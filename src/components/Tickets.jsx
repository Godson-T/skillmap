import { Check, Ticket } from 'lucide-react';
import { canonicalSkill } from '../../shared/skills.js';

const search = {
  YouTube: (s) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${s} tutorial`)}`,
  Coursera: (s) => `https://www.coursera.org/search?query=${encodeURIComponent(s)}`,
};

const fmtDay = (iso) => {
  try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch { return ''; }
};

function Why({ t, location, sample }) {
  if (sample) return <>Named in <strong className="num">{t.count} of {t.sample}</strong> postings in this example.</>;
  if (t.evidence === 'measured') {
    return (
      <>Named in <strong className="num">{t.count} of {t.sample}</strong> real postings for your role{location ? ` (${location})` : ''}.
        {t.alsoOnPath ? ' Also on your timetable.' : ''}</>
    );
  }
  return (
    <span className="est">
      {t.role ? `Your route needs it on the way to ${t.role}.` : 'A quick, high-impact win.'}<span className="dagger" aria-label="AI estimate">†</span>
    </span>
  );
}

/** One card ticket. `learnedOn` is an ISO date when punched. */
export function Stub({ t, serial, destination, learnedOn, onToggle, location, sample = false }) {
  const punched = Boolean(learnedOn);
  return (
    <li className={`stub${punched ? ' is-punched' : ''}`}>
      <div className="stub-head">
        <h3 className="stub-skill">{t.skill}</h3>
        {t.evidence === 'measured'
          ? <span className="mark mark-measured">Measured</span>
          : <span className="mark mark-estimate">AI estimate</span>}
      </div>
      <p className="stub-why"><Why t={t} location={location} sample={sample} /></p>
      <div className="stub-foot">
        {!sample && (
          <>
            <span className="stub-links">
              <a href={search.YouTube(t.skill)} target="_blank" rel="noopener noreferrer">YouTube</a>
              <a href={search.Coursera(t.skill)} target="_blank" rel="noopener noreferrer">Coursera</a>
            </span>
            <button type="button" className="punch" aria-pressed={punched} onClick={() => onToggle(t.id)}>
              {punched ? <Check size={14} aria-hidden="true" /> : <Ticket size={14} aria-hidden="true" />}
              {punched ? 'Learned' : 'Punch when learned'}
            </button>
          </>
        )}
        <span className="stub-print num">
          <span>No. {String(serial).padStart(4, '0')}{destination ? ` · to ${destination}` : ''}</span>
          {punched && <span className="punched-on">Punched {fmtDay(learnedOn)}</span>}
        </span>
      </div>
    </li>
  );
}

/** The next skills to learn, as punchable card-ticket stubs. */
export function NextTickets({ tickets, learned, onToggle, locationLabel, destination, waitingForPostings }) {
  if (!tickets.length) {
    return (
      <div className="sheet sheet-pad">
        <p className="sheet-sub">You already hold every skill this route asks for. Try a more senior target role.</p>
      </div>
    );
  }
  return (
    <div>
      <ol className="tickets" aria-label="Next skills to learn">
        {tickets.map((t, i) => (
          <Stub key={t.id} t={t} serial={i + 1} destination={destination} learnedOn={learned[t.id]}
            onToggle={onToggle} location={locationLabel} />
        ))}
      </ol>
      {waitingForPostings && (
        <p className="sheet-sub" role="status" style={{ marginTop: 10 }}>Checking real postings… tickets may switch to measured picks in a moment.</p>
      )}
    </div>
  );
}

/** Every skill on the route as a mini ticket: held, punched (learned) or still to collect. */
export function Wallet({ gap, learned, routeSkills }) {
  if (!gap) return null;
  const items = routeSkills.map(label => {
    const id = canonicalSkill(label)?.id;
    const state = learned[id] ? 'learned' : gap.matched.includes(canonicalSkill(label)?.label) ? 'held' : 'todo';
    return { label, id, state };
  });
  const held = items.filter(i => i.state !== 'todo').length;
  return (
    <div className="sheet sheet-pad">
      <div className="wallet-head">
        <h3>You hold <span className="num">{held} of {items.length}</span> tickets for this route</h3>
        <p>Blue: skills you have. Mint: punched since. Dashed: still to collect.</p>
      </div>
      <ul className="wallet">
        {items.map(i => (
          <li key={i.label} className={`mini${i.state === 'todo' ? '' : ` ${i.state}`}`}>
            <span className="dot" aria-hidden="true" />{i.label}
            <span className="sr-only">{i.state === 'held' ? ' (you have this)' : i.state === 'learned' ? ' (learned)' : ' (to learn)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
