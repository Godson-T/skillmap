import { useEffect, useRef } from 'react';
import { LAYOUT_TICKS, initialLayout, stepLayout } from '../lib/graphLayout.js';

const COLOR = { current: '#1f3c88', bridge: '#c4532c', target: '#237a4b' };
const W = 880, H = 360;

/** Skill topology drawn as a rail diagram: held skills, bridge skills, target role. */
export default function RouteMap({ graph }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !graph?.nodes?.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const nodes = initialLayout(graph.nodes, W, H);
    const edges = (graph.edges || [])
      .map(e => ({ ...e, s: nodes.find(n => n.id === e.from), t: nodes.find(n => n.id === e.to) }))
      .filter(e => e.s && e.t);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      // lines
      edges.forEach(({ s, t }) => {
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
        ctx.strokeStyle = COLOR[t.type] || '#8fa2c8'; ctx.globalAlpha = 0.55; ctx.lineWidth = 4; ctx.stroke(); ctx.globalAlpha = 1;
      });
      // stations
      nodes.forEach(n => {
        const c = COLOR[n.type] || '#5d6b80';
        const r = n.type === 'target' ? 9 : 7;
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.lineWidth = n.type === 'target' ? 4 : 3; ctx.strokeStyle = c; ctx.stroke();
        if (n.type === 'current') { ctx.beginPath(); ctx.arc(n.x, n.y, 3, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); }
        ctx.font = `${n.type === 'target' ? 700 : 600} 13px 'Archivo Variable', system-ui, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const label = n.label;
        const tw = ctx.measureText(label).width;
        const lx = n.x + tw + 26 > W ? n.x - tw - 14 : n.x + 14;
        ctx.fillStyle = 'rgba(251,252,251,0.92)'; ctx.fillRect(lx - 3, n.y - 9, tw + 6, 18);
        ctx.fillStyle = '#142033'; ctx.fillText(label, lx, n.y);
      });
    };

    let raf;
    let ticks = 0;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      while (ticks++ < LAYOUT_TICKS) stepLayout(nodes, edges, W, H);
      draw();
    } else {
      const loop = () => { stepLayout(nodes, edges, W, H); draw(); if (++ticks < LAYOUT_TICKS) raf = requestAnimationFrame(loop); };
      loop();
    }
    return () => cancelAnimationFrame(raf);
  }, [graph]);

  const labels = graph?.nodes?.map(n => n.label).join(', ');
  return (
    <div className="sheet">
      <div className="map-wrap">
        <canvas ref={ref} width={W} height={H} role="img" aria-label={`Route map of your skills: ${labels}`} />
      </div>
      <div className="map-legend">
        <span><i style={{ background: COLOR.current }} />Skills you hold</span>
        <span><i style={{ background: COLOR.bridge }} />Bridge skills</span>
        <span><i style={{ background: COLOR.target }} />Target role</span>
        <span className="est">Connections are an AI estimate<span className="dagger">†</span></span>
      </div>
    </div>
  );
}
