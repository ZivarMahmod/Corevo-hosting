(function exposeActivityEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZivarActivity = api;
}(typeof globalThis === "object" ? globalThis : window, () => {
  "use strict";

  const LEASE_MS = 75_000;
  const MAX_HOPS = 12;

  function endpointId(value) {
    return String(value && typeof value === "object" ? value.id : value || "");
  }

  function edgeStrength(edge) {
    const confidence = {
      DETERMINISTIC: 5,
      EXTRACTED: 4,
      IMPORTED: 3,
      MIXED: 2,
      INFERRED: 1,
    }[String(edge.confidence || "").toUpperCase()] || 0;
    return confidence * 10 + Math.log2(Math.max(0, Number(edge.count || edge.weight) || 1) + 1);
  }

  function buildAdjacency(edges = []) {
    const adjacency = new Map();
    for (const edge of edges) {
      const source = endpointId(edge.source);
      const target = endpointId(edge.target);
      if (!source || !target || source === target) continue;
      if (!adjacency.has(source)) adjacency.set(source, []);
      if (!adjacency.has(target)) adjacency.set(target, []);
      adjacency.get(source).push({ other: target, edge, strength: edgeStrength(edge) });
      adjacency.get(target).push({ other: source, edge, strength: edgeStrength(edge) });
    }
    for (const neighbors of adjacency.values()) {
      neighbors.sort((a, b) => b.strength - a.strength || a.other.localeCompare(b.other));
    }
    return adjacency;
  }

  function findPath(edges, source, target, maxHops = MAX_HOPS) {
    source = endpointId(source);
    target = endpointId(target);
    if (!source || !target) return null;
    if (source === target) return { nodes: [source], edges: [], hops: 0, score: 0 };
    const adjacency = buildAdjacency(edges);
    let frontier = [{ id: source, nodes: [source], edges: [], score: 0 }];
    const visitedDepth = new Map([[source, 0]]);
    const limit = Math.max(1, Math.min(MAX_HOPS, Number(maxHops) || MAX_HOPS));

    for (let depth = 1; depth <= limit; depth += 1) {
      const next = new Map();
      for (const route of frontier) {
        for (const neighbor of adjacency.get(route.id) || []) {
          if (route.nodes.includes(neighbor.other)) continue;
          const earlierDepth = visitedDepth.get(neighbor.other);
          if (earlierDepth !== undefined && earlierDepth < depth) continue;
          const candidate = {
            id: neighbor.other,
            nodes: [...route.nodes, neighbor.other],
            edges: [...route.edges, neighbor.edge],
            score: route.score + neighbor.strength,
          };
          const current = next.get(neighbor.other);
          if (!current || candidate.score > current.score) next.set(neighbor.other, candidate);
        }
      }
      const winner = next.get(target);
      if (winner) return { nodes: winner.nodes, edges: winner.edges, hops: depth, score: winner.score };
      frontier = [...next.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      for (const route of frontier) visitedDepth.set(route.id, depth);
      if (!frontier.length) break;
    }
    return null;
  }

  function heatAt(visits, now, halfLifeMs) {
    if (!visits?.length) return 0;
    if (halfLifeMs === Infinity) return Math.min(3, visits.reduce((sum, visit) => sum + (visit.weight || 1), 0));
    const halfLife = Math.max(1, Number(halfLifeMs) || 120_000);
    return Math.min(3, visits.reduce((sum, visit) => {
      const age = Math.max(0, now - Number(visit.time || 0));
      return sum + (visit.weight || 1) * Math.pow(0.5, age / halfLife);
    }, 0));
  }

  function isLeaseActive(event, now = Date.now()) {
    const expires = Date.parse(event?.lease_expires_at || "");
    const started = Date.parse(event?.timestamp || "");
    return Number.isFinite(expires)
      ? now <= expires
      : Number.isFinite(started) && now - started <= LEASE_MS;
  }

  function agentColor(agent) {
    const name = String(agent || "").toLowerCase();
    if (name.includes("graphify") || name.includes("watcher") || name === "system") return "#f3c954";
    if (name.includes("codex") || name.includes("openai")) return "#2fd0df";
    if (name.includes("claude") || name.includes("anthropic")) return "#d783ce";
    return "#ff9a5f";
  }

  function activityTargets(event = {}) {
    const targets = [];
    const sourceFiles = new Set();
    const addTarget = (target) => {
      if (!target || typeof target !== "object") return;
      const sourceFile = target.sourceFile || target.source_file || target.file;
      const normalized = {
        ...(target.id ? { id: target.id } : {}),
        ...(target.label ? { label: target.label } : {}),
        ...(sourceFile ? { sourceFile } : {}),
        ...(target.community !== undefined ? { community: target.community } : {}),
      };
      if (!Object.keys(normalized).length || (sourceFile && sourceFiles.has(sourceFile))) return;
      targets.push(normalized);
      if (sourceFile) sourceFiles.add(sourceFile);
    };

    addTarget(event.target);
    addTarget({ label: event.label, sourceFile: event.file });
    for (const sourceFile of Array.isArray(event.files) ? event.files : []) addTarget({ sourceFile });
    return targets;
  }

  function expandActivityEvents(events = []) {
    return events.flatMap((event) => activityTargets(event).map((target) => ({ ...event, target })));
  }

  function latestActivityPass(events = [], gapMs = 1_800_000) {
    if (!events.length) return { start: 0, end: -1, events: [] };
    const gap = Math.max(0, Number(gapMs) || 1_800_000);
    let start = 0;
    for (let index = 1; index < events.length; index += 1) {
      if (Date.parse(events[index].timestamp) - Date.parse(events[index - 1].timestamp) >= gap) start = index;
    }
    return { start, end: events.length - 1, events: events.slice(start) };
  }

  return {
    LEASE_MS,
    MAX_HOPS,
    activityTargets,
    agentColor,
    buildAdjacency,
    edgeStrength,
    expandActivityEvents,
    findPath,
    heatAt,
    isLeaseActive,
    latestActivityPass,
  };
}));
