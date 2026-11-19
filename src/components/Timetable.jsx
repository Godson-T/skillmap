import { useId, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { canonicalSkill, normalizeSkillList } from '../../shared/skills.js';

/** Career paths as a railway timetable: stop, station (role), arrival, via skills, upside. */
export default function Timetable({ paths, tab, setTab, userSkills }) {
  const base = useId();
  const tabRefs = useRef([]);
  const have = useMemo(() => new Set(normalizeSkillList(userSkills).map(s => s.id)), [userSkills]);
  const path = paths[tab] ?? paths[0];
  if (!path) return null;

  let elapsed = 0;
  const rows = path.steps.map(s => { elapsed += s.timeMonths; return { ...s, arrives: elapsed }; });

  const onKey = (e) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (tab + dir + paths.length) % paths.length;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="sheet">
      <div className="tabs" role="tablist" aria-label="Career paths" onKeyDown={onKey}>
        {paths.map((p, i) => (
          <button key={p.pathName + i} ref={el => { tabRefs.current[i] = el; }}
            type="button" role="tab" className="tab" id={`${base}-t${i}`}
            aria-selected={i === tab} aria-controls={`${base}-p${i}`} tabIndex={i === tab ? 0 : -1}
            onClick={() => setTab(i)}>
            {p.pathName}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-p${tab}`} aria-labelledby={`${base}-t${tab}`}>
        <div className="tt-meta">
          <span>Journey <b className="num">{path.totalTime}</b><span className="dagger">†</span></span>
          <span>Difficulty <span className={`signal signal-${path.difficulty}`}>{path.difficulty}</span><span className="dagger">†</span></span>
          <span><b className="num">{path.steps.length}</b> stops</span>
        </div>
        <div className="table-wrap">
          <table className="tt stack">
            <thead>
              <tr>
                <th scope="col" className="stop">Stop</th>
                <th scope="col">Station (role)</th>
                <th scope="col">Arrives<span className="dagger">†</span></th>
                <th scope="col">Via (skills to learn)</th>
                <th scope="col">Upside<span className="dagger">†</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.role + i}>
                  <td className="stop"><span className="stop-dot num">{i + 1}</span></td>
                  <td className="station">{r.role}</td>
                  <td className="arrives num">
                    +{r.arrives} mo
                    <small>{r.timeMonths} mo on this leg</small>
                  </td>
                  <td className="via-cell wide">
                    <span className="via">
                      {r.skillsNeeded.map(sk => {
                        const held = have.has(canonicalSkill(sk)?.id);
                        return (
                          <span key={sk} className={held ? 'held' : ''}>
                            {held && <Check size={11} aria-hidden="true" />}{sk}{held && <span className="sr-only"> (you have this)</span>}
                          </span>
                        );
                      })}
                    </span>
                  </td>
                  <td className="upside">{r.roi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
