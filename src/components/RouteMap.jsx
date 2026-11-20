import { useMemo } from 'react';
import { routeStations } from '../lib/routeStations.js';

/** The skill topology as a rail line diagram (see lib/routeStations.js). */

export default function RouteMap({ graph }) {
  const { held, bridges, termini } = useMemo(() => routeStations(graph), [graph]);
  return (
    <div className="sheet">
      <div className="route">
        <ol className="route-line" aria-label="Route from your skills to your target role">
          <li className="stn origin">
            <span className="route-label">Board here</span>
            <span className="stn-mark" aria-hidden="true" />
            <div>
              <p className="stn-name">Your skills</p>
              <p className="stn-board">{held.map(n => <span key={n.id}>{n.label}</span>)}</p>
            </div>
          </li>
          {bridges.map((b, i) => (
            <li className="stn interchange" key={b.id}>
              {i === 0 && <span className="route-label">Change here</span>}
              <span className="stn-mark" aria-hidden="true" />
              <div>
                <p className="stn-name">{b.label}</p>
                {b.from.length > 0 && <p className="stn-from">from {b.from.join(', ')}</p>}
              </div>
            </li>
          ))}
          {termini.map((t, i) => (
            <li className="stn terminus" key={t.id}>
              {i === 0 && <span className="route-label">Alight</span>}
              <span className="stn-mark" aria-hidden="true" />
              <div><p className="terminus-board">{t.label}</p></div>
            </li>
          ))}
        </ol>
      </div>
      <div className="map-legend">
        <span><i className="lg" aria-hidden="true" />Skills you hold</span>
        <span><i className="lg ring" aria-hidden="true" />Bridge skill (change here)</span>
        <span><i className="lg term" aria-hidden="true" />Target role</span>
        <span className="est">Connections are an AI estimate<span className="dagger">†</span></span>
      </div>
    </div>
  );
}
