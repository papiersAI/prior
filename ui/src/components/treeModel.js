export function buildTreeModel(nodes, activeNodeId) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const root = nodes.find((node) => node.kind === "root") ?? null;
  const seeds = nodes.filter((node) => node.kind === "seed");
  const ideas = nodes.filter((node) => node.kind === "idea");
  const evidenceBy = new Map();
  const evalsBy = new Map();
  const childrenBy = new Map();

  for (const node of nodes) {
    if (node.kind === "evidence") {
      if (!evidenceBy.has(node.parentId)) evidenceBy.set(node.parentId, []);
      evidenceBy.get(node.parentId).push(node);
    } else if (node.kind === "eval") {
      if (!evalsBy.has(node.parentId)) evalsBy.set(node.parentId, []);
      evalsBy.get(node.parentId).push(node);
    }
  }

  const depthCache = new Map();
  function depthOf(node, visiting = new Set()) {
    if (depthCache.has(node.id)) return depthCache.get(node.id);
    if (visiting.has(node.id)) return 1;
    visiting.add(node.id);
    const parent = byId.get(node.parentId);
    const depth = parent?.kind === "idea" ? depthOf(parent, visiting) + 1 : 1;
    visiting.delete(node.id);
    depthCache.set(node.id, depth);
    return depth;
  }

  for (const idea of ideas) {
    const parent = byId.get(idea.parentId);
    const parentKey = parent?.kind === "idea" ? parent.id : root?.id ?? "__root";
    if (!childrenBy.has(parentKey)) childrenBy.set(parentKey, []);
    childrenBy.get(parentKey).push({ ...idea, derivedDepth: depthOf(idea) });
  }

  const activeIds = new Set();
  let cursor = byId.get(activeNodeId);
  const seen = new Set();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    activeIds.add(cursor.id);
    cursor = byId.get(cursor.parentId);
  }

  return {
    root,
    seeds,
    ideas,
    byId,
    childrenBy,
    evidenceBy,
    evalsBy,
    activeIds,
    maxDepth: ideas.reduce((maximum, idea) => Math.max(maximum, depthOf(idea)), 0),
    rootIdeas: childrenBy.get(root?.id ?? "__root") ?? [],
  };
}

export function lineageFor(node, byId) {
  const lineage = [];
  const seen = new Set();
  let cursor = node;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    if (cursor.kind === "idea" || cursor.kind === "root") lineage.unshift(cursor);
    cursor = byId.get(cursor.parentId);
  }
  return lineage;
}
