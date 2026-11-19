import { Check, Ticket } from 'lucide-react';

const search = {
  YouTube: (s) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${s} tutorial`)}`,
  Coursera: (s) => `https://www.coursera.org/search?query=${encodeURIComponent(s)}`,
};

function Why({ t, location }) {
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

/** The next skills to learn, as punchable card-ticket stubs. */
export function NextTickets({ tickets, learned, onToggle, locationLabel, waitingForPostings }) {
  if (!tickets.length) {
    return (
      <div className="sheet sheet-pad">
        <p className="sheet-sub">You already hold every skill this route asks for. Try a more senior target role.</p>
      </div>
    );
  }
  return (
    <div>
      <ol className="tickets">
        {tickets.map((t, i) => {
          const punched = learned.has(t.id);
          return (
            <li key={t.id} className={`stub${punched ? ' is-punched' : ''}`}>
              <span className="hole" aria-hidden="true" />
              <span className="stamp" aria-hidden="true">Learned</span>
              <div className="stub-top">
                <span>Ticket {i + 1} of {tickets.length}</span>
                {t.evidence === 'measured'
                  ? <span className="mark mark-measured">Measured</span>
                  : <span className="mark mark-estimate">AI estimate</span>}
              </div>
              <h3 className="stub-skill">{t.skill}</h3>
              <p className="stub-why"><Why t={t} location={locationLabel} /></p>
              <div className="stub-foot">
                <span className="stub-links">
                  <a href={search.YouTube(t.skill)} target="_blank" rel="noopener noreferrer">YouTube</a>
                  <a href={search.Coursera(t.skill)} target="_blank" rel="noopener noreferrer">Coursera</a>
                </span>
                <button type="button" className="punch" aria-pressed={punched} onClick={() => onToggle(t.id)}>
                  {punched ? <Check size={14} aria-hidden="true" /> : <Ticket size={14} aria-hidden="true" />}
                  {punched ? 'Learned' : 'Punch when learned'}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {waitingForPostings && (
        <p className="sheet-sub" style={{ marginTop: 10 }}>Checking real postings… tickets may switch to measured picks in a moment.</p>
      )}
    </div>
  );
}

/** How many of the route's skills the user already holds, drawn as a row of tickets. */
export function Readiness({ gap }) {
  if (!gap) return null;
  const held = gap.matched.length;
  return (
    <div className="sheet sheet-pad readiness">
      <div className="sheet-title"><h3>Your ticket wallet</h3></div>
      <p className="readiness-count">
        <strong className="num">{held} of {gap.total}</strong>
        skills on this route are already yours ({gap.percent}%).
      </p>
      <div className="ticket-row" role="img" aria-label={`${held} of ${gap.total} skills held`}>
        {Array.from({ length: gap.total }, (_, i) => <span key={i} className={i < held ? 'held' : ''} />)}
      </div>
      {gap.missing.length > 0 && (
        <div>
          <p className="field-label" style={{ marginBottom: 6 }}>Still to collect</p>
          <ul>
            {gap.missing.slice(0, 6).map(m => <li key={m}><span>{m}</span></li>)}
            {gap.missing.length > 6 && <li><span>+{gap.missing.length - 6} more on the timetable</span></li>}
          </ul>
        </div>
      )}
    </div>
  );
}
