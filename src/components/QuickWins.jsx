import { PlayCircle } from 'lucide-react';

const q = encodeURIComponent;
const LINKS = [
  ['Udemy', (s) => `https://www.udemy.com/courses/search/?q=${q(s)}`],
  ['Coursera', (s) => `https://www.coursera.org/search?query=${q(s)}`],
  ['freeCodeCamp', (s) => `https://www.freecodecamp.org/news/search/?query=${q(s)}`],
  ['YouTube', (s) => `https://www.youtube.com/results?search_query=${q(`${s} tutorial`)}`],
];

/** High-yield micro-skills plus one-click tutorial searches for every skill on the route. */
export default function QuickWins({ micro, routeSkills }) {
  return (
    <div className="sheet">
      <div className="table-wrap">
        <table className="tt stack">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Learn time<span className="dagger">†</span></th>
              <th scope="col">Impact<span className="dagger">†</span></th>
              <th scope="col">Search a course</th>
            </tr>
          </thead>
          <tbody>
            {micro.map(m => (
              <tr key={m.skill}>
                <td className="station">{m.skill}</td>
                <td className="num est">{m.learnTime}</td>
                <td><span className={`impact impact-${m.impact}`}>{m.impact}</span></td>
                <td className="wide">
                  <span className="links">
                    {LINKS.map(([label, url]) => (
                      <a key={label} href={url(m.skill)} target="_blank" rel="noopener noreferrer" aria-label={`Search ${label} for ${m.skill}`}>{label}</a>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {routeSkills.length > 0 && (
        <div className="yt">
          <span className="yt-label">Tutorials for every skill on your route:</span>
          {routeSkills.map(s => (
            <a key={s} href={LINKS[3][1](s)} target="_blank" rel="noopener noreferrer">
              <PlayCircle size={13} aria-hidden="true" />{s}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
