/**
 * BFS layer-by-layer: all shortest simple paths from start to end.
 */
export function findShortestPaths(adjacency, start, end, maxSteps = 12) {
  if (start === end) return [[]];

  let layer = [{ node: start, path: [], visited: new Set([start]) }];

  for (let depth = 0; depth < maxSteps; depth++) {
    const nextLayer = [];
    const found = [];

    for (const state of layer) {
      for (const edge of adjacency.get(state.node) || []) {
        const next = edge.to;
        if (state.visited.has(next)) continue;

        const newPath = [...state.path, edge];
        if (next === end) {
          found.push(newPath);
          continue;
        }

        const newVisited = new Set(state.visited);
        newVisited.add(next);
        nextLayer.push({ node: next, path: newPath, visited: newVisited });
      }
    }

    if (found.length > 0) return found;
    if (nextLayer.length === 0) return [];
    layer = nextLayer;
  }

  return [];
}

/** @deprecated Use findShortestPaths */
export function findAllPaths(adjacency, start, end, maxSteps = 7, maxPaths = 80) {
  return findShortestPaths(adjacency, start, end, maxSteps).slice(0, maxPaths);
}

export function buildAdjacency(reactions) {
  const adjacency = new Map();
  for (const r of reactions) {
    if (r.disabled_for_pathfinding) continue;
    if (r.from === r.to) continue;
    if (!adjacency.has(r.from)) adjacency.set(r.from, []);
    adjacency.get(r.from).push(r);
  }
  return adjacency;
}

export function pathToNodeSequence(start, edgePath) {
  const nodes = [start];
  for (const e of edgePath) nodes.push(e.to);
  return nodes;
}

export function formatReactionSummary(r) {
  const parts = [];
  if (r.path_variant) parts.push(r.path_variant);
  if (r.mechanism) parts.push(r.mechanism);
  const reagents = (r.reagents || []).filter(Boolean).join(", ");
  const conditions = (r.conditions || []).filter(Boolean).join("; ");
  if (reagents) parts.push(reagents);
  if (conditions) parts.push(conditions);
  return parts.join(" · ") || r.id;
}
