(function attachBrainLayout(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ZivarBrainLayout = api;
}(typeof window !== "undefined" ? window : globalThis, () => {
  function hash32(value) {
    let result = 2166136261;
    for (const character of String(value)) {
      result ^= character.charCodeAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function unit(seed, salt) {
    return hash32(`${seed}:${salt}`) / 4294967295;
  }

  function brainPoint(seed, hemisphere = 0, scale = 1) {
    const azimuth = unit(seed, "a") * Math.PI * 2;
    const vertical = unit(seed, "b") * 2 - 1;
    const radial = 0.22 + Math.cbrt(unit(seed, "c")) * 0.78;
    const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
    const side = hemisphere || (unit(seed, "side") < 0.5 ? -1 : 1);
    let x = side * (0.09 + Math.abs(Math.cos(azimuth) * horizontal * radial) * 1.42);
    let y = vertical * radial * 1.05 + (1 - vertical * vertical) * 0.08;
    let z = Math.sin(azimuth) * horizontal * radial * 1.22;
    const lowerTaper = 1 - Math.max(0, -y - 0.28) * 0.24;
    x *= lowerTaper;
    z *= lowerTaper;
    y = Math.max(-1.02, y);
    return { x: x * scale, y: y * scale, z: z * scale };
  }

  function groupKey(node) {
    return `${node.project || ""}:${node.community ?? node.cluster ?? node.kind ?? "other"}`;
  }

  function sortMembers(members, mode) {
    return [...members].sort((a, b) => {
      if (mode === "name") return String(a.label || a.id).localeCompare(String(b.label || b.id));
      const field = mode === "size" ? "rawCount" : "degree";
      return Number(b[field] || 0) - Number(a[field] || 0) || String(a.id).localeCompare(String(b.id));
    });
  }

  function brainLayout(nodes, options = {}) {
    const mode = options.mode === "comparison" ? "comparison" : "single";
    const split = mode === "comparison" && options.split === true;
    const placement = options.layout || "orbit";
    const spacing = Math.max(0.55, Math.min(1.8, Number(options.spacing || 100) / 100));
    const flowScore = new Map();
    for (const edge of options.edges || []) {
      flowScore.set(edge.source, (flowScore.get(edge.source) || 0) - 1);
      flowScore.set(edge.target, (flowScore.get(edge.target) || 0) + 1);
    }
    const groups = new Map();
    for (const node of nodes || []) {
      const key = groupKey(node);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(node);
    }

    const result = new Map();
    for (const [key, members] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const project = members[0]?.project === "B" ? "B" : "A";
      const integratedHemisphere = mode === "comparison" && !split ? (project === "B" ? 1 : -1) : 0;
      const scale = split ? 0.88 : 1;
      const centerX = split ? (project === "B" ? 1.55 : -1.55) * spacing : 0;
      const anchor = brainPoint(`group:${key}`, integratedHemisphere, scale);
      const cohesion = members.length > 1
        ? { constellation: 0.9, flow: 0.65, grid: 0.72 }[placement] || 0.78
        : 0.18;
      const ordered = sortMembers(members, options.sort || "degree");
      const flowOrder = [...members].sort((a, b) => (
        (flowScore.get(a.id) || 0) - (flowScore.get(b.id) || 0)
        || String(a.id).localeCompare(String(b.id))
      ));
      const flowRank = new Map(flowOrder.map((node, index) => [node.id, index]));

      ordered.forEach((node, index) => {
        const local = brainPoint(`slot:${key}:${index}`, integratedHemisphere, scale);
        if (placement === "flow" && members.length > 1) {
          local.y = ((flowRank.get(node.id) / (members.length - 1)) * 1.8 - 0.9) * scale;
        } else if (placement === "grid") {
          local.y = Math.round(local.y * 5) / 5;
          local.z = Math.round(local.z * 5) / 5;
        }
        result.set(node.id, {
          x: centerX + (anchor.x * cohesion + local.x * (1 - cohesion)) * spacing,
          y: (anchor.y * cohesion + local.y * (1 - cohesion)) * spacing,
          z: (anchor.z * cohesion + local.z * (1 - cohesion)) * spacing,
        });
      });
    }
    return result;
  }

  function brainBounds(positions) {
    const values = [...positions.values()];
    if (!values.length) return { center: { x: 0, y: 0, z: 0 }, radius: 1 };
    const minimum = {
      x: Math.min(...values.map((item) => item.x)),
      y: Math.min(...values.map((item) => item.y)),
      z: Math.min(...values.map((item) => item.z)),
    };
    const maximum = {
      x: Math.max(...values.map((item) => item.x)),
      y: Math.max(...values.map((item) => item.y)),
      z: Math.max(...values.map((item) => item.z)),
    };
    const center = {
      x: (minimum.x + maximum.x) / 2,
      y: (minimum.y + maximum.y) / 2,
      z: (minimum.z + maximum.z) / 2,
    };
    const radius = Math.max(0.5, ...values.map((item) => Math.hypot(
      item.x - center.x,
      item.y - center.y,
      item.z - center.z,
    )));
    return { center, radius };
  }

  return { brainBounds, brainLayout, brainPoint };
}));
