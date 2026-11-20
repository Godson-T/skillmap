/**
 * The skill topology as a rail line diagram: board with the skills you hold,
 * change at bridge skills, alight at the target role. Deterministic: stations
 * are ordered by their distance from your current skills.
 */
export function routeStations(graph) {
  const nodes = graph?.nodes ?? [];
  const edges = graph?.edges ?? [];
  const adj = new Map(nodes.map(n => [n.id, new Set()]));
  for (const e of edges) { adj.get(e.from)?.add(e.to); adj.get(e.to)?.add(e.from); }

  const type = new Map(nodes.map(n => [n.id, n.type]));
  const held = nodes.filter(n => n.type === 'current');
  const dist = new Map(held.map(n => [n.id, 0]));
  const queue = held.map(n => n.id);
  for (let head = 0; head < queue.length; head++) { // index pointer: no O(n) shift()
    const id = queue[head];
    for (const nb of adj.get(id) ?? []) {
      // the target role is the end of the line, never a way through to a station
      if (dist.has(nb) || type.get(nb) === 'target') continue;
      dist.set(nb, dist.get(id) + 1); queue.push(nb);
    }
  }
  const position = new Map(nodes.map((n, i) => [n.id, i]));
  const order = (a, b) => (dist.get(a.id) ?? 99) - (dist.get(b.id) ?? 99) || position.get(a.id) - position.get(b.id);
  const label = new Map(nodes.map(n => [n.id, n.label]));
  const sorted = nodes.filter(n => n.type === 'bridge').sort(order);
  const bridges = sorted.map((n, i) => {
    const from = [...(adj.get(n.id) ?? [])]
      .filter(id => type.get(id) !== 'target' && (dist.get(id) ?? 99) < (dist.get(n.id) ?? 99))
      .map(id => label.get(id));
    // no direct link back toward your skills: it follows the previous station on the line
    if (!from.length) from.push(i > 0 ? sorted[i - 1].label : 'your skills');
    return { ...n, from };
  });
  const termini = nodes.filter(n => n.type === 'target');
  return { held, bridges, termini };
}
