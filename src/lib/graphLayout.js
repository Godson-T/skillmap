// Deterministic force-directed layout for the skill topology graph.
// Same node ids -> same starting positions -> same settled layout.

export const LAYOUT_TICKS = 300;

/** FNV-1a 32-bit hash of a string. */
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — small, fast, deterministic. Returns floats in [0, 1). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded starting positions: columns by level, jitter from a PRNG seeded by the node ids. */
export function initialLayout(nodes, W, H) {
  const rand = seededRandom(hash(nodes.map(n => n.id).join('|')));
  return nodes.map(n => {
    const level = Math.min(3, Math.max(1, Number(n.level) || 2));
    return {
      ...n,
      x: 60 + (level - 1) * ((W - 120) / 2) + (rand() - 0.5) * 60,
      y: 40 + rand() * (H - 80),
      vx: 0, vy: 0,
    };
  });
}

/** One simulation step (repulsion + springs + damping), mutating nodes in place. */
export function stepLayout(nodes, edges, W, H) {
  nodes.forEach(a => {
    let fx = (W / 2 - a.x) * 0.008, fy = (H / 2 - a.y) * 0.008;
    nodes.forEach(b => {
      if (a === b) return;
      const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 1;
      const f = 5000 / d2, d = Math.sqrt(d2);
      fx += f * dx / d; fy += f * dy / d;
    });
    a.fx = fx; a.fy = fy;
  });
  edges.forEach(({ s, t }) => {
    const dx = t.x - s.x, dy = t.y - s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    const f = (d - 140) * 0.38, fx = f * dx / d, fy = f * dy / d;
    s.fx += fx; s.fy += fy; t.fx -= fx; t.fy -= fy;
  });
  nodes.forEach(n => {
    n.vx = (n.vx + n.fx * 0.1) * 0.75;
    n.vy = (n.vy + n.fy * 0.1) * 0.75;
    n.x = Math.max(70, Math.min(W - 70, n.x + n.vx));
    n.y = Math.max(35, Math.min(H - 35, n.y + n.vy));
  });
}

/** Run the full simulation headlessly (used by tests and reduced-motion rendering). */
export function computeLayout(graph, W, H, ticks = LAYOUT_TICKS) {
  const nodes = initialLayout(graph.nodes, W, H);
  const edges = (graph.edges || [])
    .map(e => ({ s: nodes.find(n => n.id === e.from), t: nodes.find(n => n.id === e.to) }))
    .filter(e => e.s && e.t);
  for (let i = 0; i < ticks; i++) stepLayout(nodes, edges, W, H);
  return nodes.map(({ id, x, y }) => ({ id, x, y }));
}
