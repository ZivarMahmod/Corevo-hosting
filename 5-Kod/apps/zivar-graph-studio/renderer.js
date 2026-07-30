function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function webFile() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.csv,.sql";
    input.addEventListener("change", () => resolve(input.files?.[0] || null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

function createWebApi() {
  const request = async (route, body = {}) => {
    const response = await fetch(`/api/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.json();
  };
  return {
    bootstrap: async () => (await fetch("/api/bootstrap")).json(),
    loadLibraryProject: (slot, projectId) => request("load-library-project", { slot, projectId }),
    pickProject: async () => ({ ok: false, error: "Projektmappar öppnas i desktopappen. Datafiler och GitHub fungerar här." }),
    pickDataFile: async (slot) => {
      const file = await webFile();
      return file ? request("load-data", { slot, fileName: file.name, text: await file.text() }) : { ok: true, value: null };
    },
    loadGithub: (slot, url) => request("load-github", { slot, url }),
    loadGithubBranch: (url, branch, base) => request("load-github-branch", { url, branch, base }),
    pickBranchRepo: async () => ({ ok: false, error: "Lokala Git-mappar kan bara öppnas i desktopappen." }),
    refreshProject: (slot) => request("refresh-project", { slot }),
    getView: (payload) => request("get-view", payload),
    getNode: (slot, id) => request("get-node", { slot, id }),
    search: (slot, query) => request("search", { slot, query }),
    compare: () => request("compare"),
    comparisonGraph: (diffOnly = false) => request("comparison-graph", { diffOnly }),
    branchImpact: () => request("branch-impact"),
    simulate: (aId, bId) => request("simulate", { aId, bId }),
    getActivity: (after) => request("get-activity", { after }),
    studioV1: (operation, payload) => request("studio-v1", { operation, payload }),
    updateState: (payload) => request("update-state", payload),
    saveImage: async (dataUrl) => {
      const response = await fetch(dataUrl);
      downloadBlob(await response.blob(), `zivar-graph-${new Date().toISOString().slice(0, 10)}.png`);
      return { ok: true, value: "Hämtningar" };
    },
    exportReport: async () => {
      const result = await request("export-report");
      if (result.ok) {
        downloadBlob(
          new Blob([JSON.stringify(result.value, null, 2)], { type: "application/json" }),
          `zivar-graph-analysis-${new Date().toISOString().slice(0, 10)}.json`,
        );
      }
      return result;
    },
    onProgress: () => () => {},
  };
}

const api = window.zivarStudio || createWebApi();
const runtime = window.zivarStudio ? "desktop" : "web";

const COLORS = [
  "#2fd0df",
  "#ff716b",
  "#f3c954",
  "#48d28b",
  "#5f96e8",
  "#d783ce",
  "#8ccf70",
  "#f29b46",
  "#65c0a8",
  "#dc6f91",
  "#91a7d7",
  "#d3c56f",
];

const DEFAULT_OPTIONS = {
  arrows: true,
  edgeLabels: false,
  pulse: false,
  inferredDash: true,
  color: "community",
  shape: "circle",
  size: "importance",
  sort: "degree",
  labelDensity: 2,
  showIsolates: true,
  hubsOnly: false,
  showHubs: true,
  layout: "orbit",
  spacing: 100,
  pulseSpeed: 25,
  grid: true,
  minimap: true,
  brainMode: "integrated",
};

const OPTION_BINDINGS = [
  ["#toggle-arrows", "arrows", "checked", false],
  ["#toggle-edge-labels", "edgeLabels", "checked", false],
  ["#toggle-pulse", "pulse", "checked", false],
  ["#toggle-inferred-dash", "inferredDash", "checked", false],
  ["#toggle-isolates", "showIsolates", "checked", true],
  ["#toggle-hubs-only", "hubsOnly", "checked", true],
  ["#color-mode", "color", "value", false],
  ["#shape-mode", "shape", "value", false],
  ["#size-mode", "size", "value", false],
  ["#sort-mode", "sort", "value", true],
  ["#label-density", "labelDensity", "value", false, true],
  ["#toggle-hubs", "showHubs", "checked", false],
  ["#brain-mode", "brainMode", "value", true],
  ["#layout-mode", "layout", "value", true],
  ["#node-spacing", "spacing", "value", true, true],
  ["#pulse-speed", "pulseSpeed", "value", false, true],
  ["#toggle-grid", "grid", "checked", false],
  ["#toggle-minimap", "minimap", "checked", false],
];

const state = {
  projects: { A: null, B: null },
  libraryProjects: [],
  workspace: "both",
  activeSlot: "A",
  stacks: { A: [{ mode: "overview" }], B: [{ mode: "overview" }] },
  filters: { relation: "ALL", confidence: "ALL", minWeight: 0 },
  options: { ...DEFAULT_OPTIONS },
  currentView: null,
  selected: { A: null, B: null },
  selectedLabels: { A: "", B: "" },
  selectedDetail: null,
  selectedDetailSlot: "A",
  selectedViewNode: null,
  inspected: { slot: "", id: "", viewId: "" },
  comparison: null,
  branchImpact: null,
  activeDetailTab: "inspector",
  searchQuery: "",
  context: { projectId: "", snapshotId: "", query: "" },
  catalogProjects: [],
  catalogSnapshots: {},
  readerPacket: null,
  knowledgeRecords: [],
  jobs: [],
  integration: { status: "unknown", error: "", loading: null },
  activity: [],
  lastActivityId: "",
  lastV1ActivityId: "",
  nextV1ActivityPoll: 0,
  activityPolling: false,
  playback: {
    mode: "live",
    passStart: 0,
    cursor: 0,
    speed: 1,
    halfLife: 120_000,
    agents: new Set(),
    knownAgents: new Set(),
    accumulator: 0,
    offset: 0,
    lastTick: performance.now(),
  },
  mobilePanel: "",
  focusMode: false,
  mobileInitialized: false,
  requestId: 0,
  searchTimer: 0,
  stateTimer: 0,
  bootstrapped: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const formatNumber = (value) => new Intl.NumberFormat("sv-SE").format(Number(value) || 0);
const formatPercent = (value, digits = 0) => `${(Number(value || 0) * 100).toFixed(digits)}%`;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const freshnessLabel = (status) => ({
  fresh: "Aktuell",
  stale: "Inaktuell",
  contradicted: "Motsagd",
  needs_review: "Behöver granskas",
  unverifiable: "Kan inte verifieras",
  mixed: "Blandad",
  unknown: "Okänd",
}[status] || status || "Okänd");
const answerStatusLabel = (status) => ({
  answered: "Besvarad",
  partial: "Delvis",
  conflicted: "Motsägelse",
  insufficient: "Otillräckligt underlag",
  insufficient_evidence: "Otillräckligt underlag",
  needs_review: "Behöver granskas",
  unverifiable: "Kan inte verifieras",
  unanswered: "Obesvarad",
}[status] || status || "Okänd");

function syncOptionOutputs() {
  $("#label-density-value").textContent = `${state.options.labelDensity}%`;
  $("#node-spacing-value").textContent = `${state.options.spacing}%`;
  $("#pulse-speed-value").textContent = `${(state.options.pulseSpeed / 100).toLocaleString("sv-SE", { maximumFractionDigits: 2 })}×`;
  document.body.classList.toggle("mobile-minimap-on", window.innerWidth <= 720 && state.options.minimap);
}

function syncControlsFromState() {
  for (const [selector, key, property] of OPTION_BINDINGS) $(selector)[property] = state.options[key];
  $("#confidence-filter").value = state.filters.confidence;
  $("#weight-filter").value = String(state.filters.minWeight);
  $("#weight-filter-value").textContent = state.filters.minWeight ? String(state.filters.minWeight) : "Alla";
  $("#global-search").value = state.searchQuery;
  $("#reader-query").value = state.context.query;
  $("#activity-speed").value = String(state.playback.speed);
  $("#heat-decay").value = state.playback.halfLife === Infinity ? "session" : String(state.playback.halfLife);
  syncOptionOutputs();
}

function restoreSavedState(saved) {
  if (!saved || typeof saved !== "object") return;
  const view = saved.view && typeof saved.view === "object" ? saved.view : {};
  const activeSlot = view.activeSlot === "B" ? "B" : "A";
  state.activeSlot = state.projects[activeSlot] ? activeSlot : state.projects.A ? "A" : "B";
  const requestedWorkspace = ["A", "B", "both", "diff"].includes(view.workspace) ? view.workspace : "both";
  state.workspace = ["both", "diff"].includes(requestedWorkspace)
    ? state.projects.A && state.projects.B ? requestedWorkspace : state.activeSlot
    : state.projects[requestedWorkspace] ? requestedWorkspace : state.activeSlot;
  for (const slot of ["A", "B"]) {
    if (Array.isArray(view.stacks?.[slot]) && view.stacks[slot].length) state.stacks[slot] = view.stacks[slot];
  }
  if (saved.filters && typeof saved.filters === "object") {
    state.filters = { ...state.filters, ...saved.filters };
  }
  if (saved.options && typeof saved.options === "object") {
    state.options = Object.fromEntries(Object.keys(DEFAULT_OPTIONS).map((key) => [
      key,
      Object.hasOwn(saved.options, key) ? saved.options[key] : DEFAULT_OPTIONS[key],
    ]));
    state.mobileInitialized = true;
  }
  if (saved.selection && typeof saved.selection === "object") {
    state.selected = { A: saved.selection.A || null, B: saved.selection.B || null };
    state.selectedLabels = {
      A: saved.selection.labels?.A || "",
      B: saved.selection.labels?.B || "",
    };
  }
  if (saved.ui && typeof saved.ui === "object") {
    if (["inspector", "reader", "knowledge", "audit", "compare", "agents", "jobs"].includes(saved.ui.detailTab)) {
      state.activeDetailTab = saved.ui.detailTab;
    }
    state.searchQuery = String(saved.ui.searchQuery || "").slice(0, 500);
    state.mobilePanel = ["filters", "search", "info", "agents"].includes(saved.ui.mobilePanel)
      ? saved.ui.mobilePanel
      : "";
    state.focusMode = Boolean(saved.ui.focusMode);
    const inspected = saved.ui.inspected;
    if (inspected && ["A", "B"].includes(inspected.slot) && inspected.id && inspected.viewId) {
      state.inspected = {
        slot: inspected.slot,
        id: String(inspected.id),
        viewId: String(inspected.viewId),
      };
    }
  }
  if (saved.context && typeof saved.context === "object") {
    state.context = {
      projectId: String(saved.context.projectId || "").slice(0, 256),
      snapshotId: String(saved.context.snapshotId || "").slice(0, 256),
      query: String(saved.context.query || "").slice(0, 4000),
    };
  }
  if (saved.playback && typeof saved.playback === "object") {
    if (["live", "playing", "paused"].includes(saved.playback.mode)) state.playback.mode = saved.playback.mode;
    state.playback.cursor = Math.max(0, Number(saved.playback.cursor) || 0);
    state.playback.speed = [0.5, 1, 2, 4].includes(Number(saved.playback.speed))
      ? Number(saved.playback.speed)
      : 1;
    state.playback.halfLife = saved.playback.halfLife === "session"
      ? Infinity
      : Math.max(30_000, Number(saved.playback.halfLife) || 120_000);
    if (Array.isArray(saved.playback.agents)) {
      state.playback.agents = new Set(saved.playback.agents.map(String));
      state.playback.knownAgents = new Set(state.playback.agents);
    }
  }
}

async function invoke(name, ...args) {
  const response = await api[name](...args);
  if (!response?.ok) throw new Error(response?.error || "Okänt fel");
  return response.value;
}

async function invokeStudioV1(operation, payload = {}) {
  const response = await api.studioV1(operation, payload);
  if (!response?.ok) throw new Error(response?.error || "Studio V1 svarade inte.");
  return response.value;
}

let toastTimer = 0;
let panelReturnFocus = null;
function toast(message, isError = false) {
  const element = $("#toast");
  element.textContent = message;
  element.style.borderColor = isError ? "#8d3940" : "";
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 3200);
}

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function withAlpha(hex, alpha) {
  const clean = hex.replace("#", "");
  const number = Number.parseInt(clean, 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

class GraphCanvas {
  constructor(canvas, minimap) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.minimap = minimap;
    this.miniContext = minimap.getContext("2d");
    this.data = { nodes: [], edges: [] };
    this.nodes = [];
    this.edges = [];
    this.nodeById = new Map();
    this.positions = new Map();
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.options = { ...state.options };
    this.selected = new Set();
    this.hovered = null;
    this.pointer = null;
    this.pointers = new Map();
    this.gesture = null;
    this.lastTap = null;
    this.drag = null;
    this.lasso = null;
    this.tool = "select";
    this.autoOrbit = false;
    this.activity = [];
    this.activityAsOf = Date.now();
    this.activityLive = true;
    this.activityHalfLife = 120_000;
    this.activityAgents = null;
    this.activityFocus = false;
    this.lastActivityDraw = 0;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.onSelect = null;
    this.onDoubleClick = null;
    this.lastFrame = performance.now();
    this.frame = 0;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.installEvents();
    this.resize();
    requestAnimationFrame((time) => this.animate(time));
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.width = rect.width;
      this.height = rect.height;
      this.draw();
    }
  }

  setOptions(options, relayout = false) {
    const oldLayout = this.options.layout;
    const oldSpacing = this.options.spacing;
    const oldSort = this.options.sort;
    this.options = { ...this.options, ...options };
    this.minimap.hidden = !this.options.minimap;
    if (relayout || oldLayout !== this.options.layout || oldSpacing !== this.options.spacing || oldSort !== this.options.sort) {
      this.layout();
      this.fit();
    }
    this.draw();
  }

  setData(data, options = {}) {
    const resetCamera = options.resetCamera !== false;
    const priorCamera = { ...this.camera };
    const priorSelection = new Set(this.selected);
    this.data = data || { nodes: [], edges: [] };
    const connected = new Set();
    for (const edge of this.data.edges || []) {
      connected.add(edge.source);
      connected.add(edge.target);
    }
    this.nodes = (this.data.nodes || []).filter((node) => this.options.showIsolates || connected.has(node.id));
    this.nodeById = new Map(this.nodes.map((node) => [node.id, node]));
    this.edges = (this.data.edges || []).filter((edge) => this.nodeById.has(edge.source) && this.nodeById.has(edge.target));
    this.selected = new Set([...priorSelection].filter((id) => this.nodeById.has(id)));
    this.hovered = null;
    this.positions.clear();
    this.layout(options.layout || this.options.layout);
    if (resetCamera) this.fit();
    else this.camera = priorCamera;
    this.draw();
  }

  sortedNodes() {
    const nodes = [...this.nodes];
    if (this.options.sort === "name") return nodes.sort((a, b) => a.label.localeCompare(b.label, "sv"));
    if (this.options.sort === "size") return nodes.sort((a, b) => (b.rawCount || b.size || 0) - (a.rawCount || a.size || 0));
    return nodes.sort((a, b) => (b.degree || 0) - (a.degree || 0));
  }

  layout(mode = this.options.layout) {
    if (!this.nodes.length) return;
    const spacing = this.options.spacing / 100;
    if (this.data.mode === "comparison") {
      this.layoutComparison(spacing);
      return;
    }
    if (mode === "flow") this.layoutFlow(spacing);
    else if (mode === "orbit") this.layoutOrbit(spacing);
    else if (mode === "grid") this.layoutGrid(spacing);
    else this.layoutConstellation(spacing);
  }

  layoutConstellation(spacing) {
    const groups = new Map();
    for (const node of this.nodes) {
      const key = node.cluster || node.communityName || node.kind || "Övrigt";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(node);
    }
    const orderedGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    const centerRadius = Math.max(260, orderedGroups.length * 35) * spacing;
    orderedGroups.forEach(([group, nodes], groupIndex) => {
      const angle = (Math.PI * 2 * groupIndex) / orderedGroups.length - Math.PI / 2;
      const center = orderedGroups.length === 1
        ? { x: 0, y: 0 }
        : { x: Math.cos(angle) * centerRadius, y: Math.sin(angle) * centerRadius };
      const ordered = [...nodes].sort((a, b) => (b.degree || 0) - (a.degree || 0));
      ordered.forEach((node, index) => {
        const localAngle = index * 2.3999632297 + (hash(group) % 100) / 100;
        const radius = Math.sqrt(index) * 28 * spacing;
        this.positions.set(node.id, {
          x: center.x + Math.cos(localAngle) * radius,
          y: center.y + Math.sin(localAngle) * radius,
        });
      });
    });
  }

  layoutFlow(spacing) {
    const flow = new Map(this.nodes.map((node) => [node.id, { incoming: 0, outgoing: 0 }]));
    for (const edge of this.edges) {
      flow.get(edge.source).outgoing += edge.count || edge.weight || 1;
      flow.get(edge.target).incoming += edge.count || edge.weight || 1;
    }
    const maximum = Math.max(1, ...[...flow.values()].map((item) => Math.abs(item.outgoing - item.incoming)));
    const clusters = [...new Set(this.nodes.map((node) => node.cluster || node.kind))].sort();
    const lanes = new Map(clusters.map((cluster, index) => [cluster, index - (clusters.length - 1) / 2]));
    for (const node of this.nodes) {
      const item = flow.get(node.id);
      const balance = (item.outgoing - item.incoming) / maximum;
      const jitter = ((hash(node.id) % 101) - 50) * 1.2;
      this.positions.set(node.id, {
        x: balance * 560 * spacing + jitter,
        y: (lanes.get(node.cluster || node.kind) || 0) * 90 * spacing + ((hash(`${node.id}:y`) % 61) - 30),
      });
    }
  }

  layoutOrbit(spacing) {
    const ordered = this.sortedNodes();
    if (!ordered.length) return;
    this.positions.set(ordered[0].id, { x: 0, y: 0 });
    const ringStep = 36 * spacing;
    const targetGap = 24 * spacing;
    let cursor = 1;
    let ring = 1;
    while (cursor < ordered.length) {
      const packingRadius = ring * ringStep;
      const radius = (54 + ring * 34) * spacing;
      const capacity = Math.max(8, Math.floor((Math.PI * 2 * packingRadius) / targetGap));
      const remaining = ordered.length - cursor;
      const count = remaining <= capacity * 1.18 ? remaining : capacity;
      const offset = ring % 2 ? Math.PI / count : 0;
      for (let index = 0; index < count; index += 1) {
        const node = ordered[cursor + index];
        const angle = (index / count) * Math.PI * 2 - Math.PI / 2 + offset;
        this.positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
      }
      cursor += count;
      ring += 1;
    }
  }

  layoutGrid(spacing) {
    const ordered = this.sortedNodes();
    const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length * 1.45)));
    const rows = Math.ceil(ordered.length / columns);
    ordered.forEach((node, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      this.positions.set(node.id, {
        x: (column - (columns - 1) / 2) * 58 * spacing,
        y: (row - (rows - 1) / 2) * 58 * spacing,
      });
    });
  }

  layoutComparison(spacing) {
    for (const side of ["A", "B"]) {
      const nodes = this.sortedNodes().filter((node) => node.project === side);
      const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length / 2)));
      const rows = Math.ceil(nodes.length / columns);
      nodes.forEach((node, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const direction = side === "A" ? -1 : 1;
        this.positions.set(node.id, {
          x: direction * (300 + column * 72 * spacing),
          y: (row - (rows - 1) / 2) * 72 * spacing,
        });
      });
    }
  }

  worldToScreen(position) {
    return {
      x: (position.x - this.camera.x) * this.camera.zoom + this.width / 2,
      y: (position.y - this.camera.y) * this.camera.zoom + this.height / 2,
    };
  }

  screenToWorld(position) {
    return {
      x: (position.x - this.width / 2) / this.camera.zoom + this.camera.x,
      y: (position.y - this.height / 2) / this.camera.zoom + this.camera.y,
    };
  }

  fit() {
    if (!this.positions.size || !this.width || !this.height) return;
    const values = [...this.positions.values()];
    const minX = Math.min(...values.map((item) => item.x));
    const maxX = Math.max(...values.map((item) => item.x));
    const minY = Math.min(...values.map((item) => item.y));
    const maxY = Math.max(...values.map((item) => item.y));
    this.camera.x = (minX + maxX) / 2;
    this.camera.y = (minY + maxY) / 2;
    this.camera.zoom = clamp(Math.min(
      (this.width - 100) / Math.max(160, maxX - minX),
      (this.height - 100) / Math.max(160, maxY - minY),
    ), 0.08, 1.7);
    this.draw();
  }

  zoomBy(factor, screenPoint = { x: this.width / 2, y: this.height / 2 }) {
    const before = this.screenToWorld(screenPoint);
    this.camera.zoom = clamp(this.camera.zoom * factor, 0.035, 6);
    const after = this.screenToWorld(screenPoint);
    this.camera.x += before.x - after.x;
    this.camera.y += before.y - after.y;
    this.draw();
  }

  rotate(angle = Math.PI / 14) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    for (const [id, position] of this.positions) {
      this.positions.set(id, {
        x: position.x * cosine - position.y * sine,
        y: position.x * sine + position.y * cosine,
      });
    }
    this.draw();
  }

  setTool(tool) {
    this.tool = tool;
    this.canvas.classList.toggle("lasso", tool === "lasso");
    this.canvas.classList.toggle("move", tool === "move");
  }

  setActivity(events, options = {}) {
    this.activity = events.slice(-1000);
    this.activityAsOf = Number(options.asOf) || Date.now();
    this.activityLive = options.live !== false;
    this.activityHalfLife = options.halfLife === Infinity ? Infinity : Number(options.halfLife) || 120_000;
    this.activityAgents = options.agents === undefined ? null : new Set(options.agents);
    this.draw();
  }

  setActivityFocus(enabled) {
    this.activityFocus = Boolean(enabled);
    this.canvas.classList.toggle("activity-focus", this.activityFocus);
    this.draw();
  }

  transitionDuration(transition) {
    const hops = Math.min(12, transition.path?.hops || 0);
    return (this.activityFocus ? 2600 : 700) + hops * (this.activityFocus ? 300 : 240);
  }

  targetId(target, project) {
    if (!target) return null;
    const candidates = [
      target.id,
      target.sourceFile ? `file:${target.sourceFile}` : null,
      Number.isFinite(Number(target.community)) ? `community:${target.community}` : null,
    ].filter(Boolean);
    if (this.data.mode === "comparison") {
      const prefix = project === "B" ? "B" : "A";
      if (target.id) candidates.unshift(`${prefix}:${target.id}`);
      candidates.unshift(`${prefix}:community:${target.community}`);
    }
    const direct = candidates.find((id) => this.positions.has(id));
    if (direct) return direct;
    return this.nodes.find((node) => (
      ((target.sourceFile && node.sourceFile === target.sourceFile)
        || (target.label && node.label === target.label))
      && (this.data.mode !== "comparison" || !node.project || node.project === (project === "B" ? "B" : "A"))
    ))?.id || null;
  }

  focusTarget(target, project) {
    const id = this.targetId(target, project);
    if (!id) return false;
    const position = this.positions.get(id);
    this.camera.zoom = Math.max(this.camera.zoom, 1.15);
    this.camera.x = position.x;
    this.camera.y = position.y;
    if (document.body.classList.contains("mobile-panel-agents")) {
      const panel = document.querySelector("#detail-rail")?.getBoundingClientRect();
      const canvas = this.canvas.getBoundingClientRect();
      if (panel && window.innerWidth > 720) {
        const overlap = Math.max(0, canvas.right - Math.max(canvas.left, panel.left));
        this.camera.x += Math.min(overlap, canvas.width * 0.55) / (2 * this.camera.zoom);
      } else if (panel) {
        const overlap = Math.max(0, canvas.bottom - Math.max(canvas.top, panel.top));
        this.camera.y += Math.min(overlap, canvas.height * 0.65) / (2 * this.camera.zoom);
      }
    }
    this.selected = new Set([id]);
    this.draw();
    return true;
  }

  nodeRadius(node) {
    if (this.options.size === "uniform") return 2;
    if (this.options.size === "members") return clamp(1.25 + Math.log2((node.rawCount || 1) + 1) * 0.42, 1.5, 6);
    return clamp(1.25 + Math.log2((node.degree || 0) + 2) * 0.4, 1.5, 6);
  }

  nodeColor(node) {
    if (this.data.branchLens) {
      return {
        added: "#48d28b",
        modified: "#f3c954",
        deleted: "#ff5d67",
        renamed: "#5f96e8",
        copied: "#65c0a8",
        "type-changed": "#d783ce",
        impacted: node.project === "B" ? "#ff9a7d" : "#70cbd4",
      }[node.changeStatus] || (node.project === "B" ? "#ff716b" : "#2fd0df");
    }
    if (this.options.color === "project" || this.data.mode === "comparison") {
      return node.project === "B" ? "#ff716b" : "#2fd0df";
    }
    if (this.options.color === "kind") {
      const kind = String(node.kind || "").toLowerCase();
      if (kind.includes("file")) return "#48d28b";
      if (kind.includes("table")) return "#5f96e8";
      if (kind.includes("class") || kind.includes("component")) return "#ff716b";
      if (kind.includes("function") || kind.includes("method")) return "#2fd0df";
      if (kind.includes("community")) return "#f3c954";
      return "#a9b2be";
    }
    if (this.options.color === "risk") {
      const risk = clamp((node.degree || 0) / Math.max(1, this.maxDegree), 0, 1);
      if (risk > 0.7) return "#ff5d67";
      if (risk > 0.35) return "#f3c954";
      return "#48d28b";
    }
    return COLORS[Math.abs(Number(node.community) || hash(node.cluster || node.id)) % COLORS.length];
  }

  drawShape(context, shape, x, y, radius) {
    context.beginPath();
    if (shape === "square") {
      context.rect(x - radius, y - radius, radius * 2, radius * 2);
    } else if (shape === "diamond") {
      context.moveTo(x, y - radius * 1.25);
      context.lineTo(x + radius * 1.25, y);
      context.lineTo(x, y + radius * 1.25);
      context.lineTo(x - radius * 1.25, y);
      context.closePath();
    } else if (shape === "hexagon") {
      for (let index = 0; index < 6; index += 1) {
        const angle = Math.PI / 3 * index;
        const px = x + Math.cos(angle) * radius * 1.18;
        const py = y + Math.sin(angle) * radius * 1.18;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
    } else {
      context.arc(x, y, radius, 0, Math.PI * 2);
    }
  }

  drawGrid(context) {
    if (!this.options.grid) return;
    const size = clamp(64 * this.camera.zoom, 22, 90);
    const offsetX = ((this.width / 2 - this.camera.x * this.camera.zoom) % size + size) % size;
    const offsetY = ((this.height / 2 - this.camera.y * this.camera.zoom) % size + size) % size;
    context.strokeStyle = "rgba(83, 96, 112, 0.17)";
    context.lineWidth = 1;
    context.beginPath();
    for (let x = offsetX; x < this.width; x += size) {
      context.moveTo(x, 0);
      context.lineTo(x, this.height);
    }
    for (let y = offsetY; y < this.height; y += size) {
      context.moveTo(0, y);
      context.lineTo(this.width, y);
    }
    context.stroke();
  }

  drawArrow(context, source, target, color, radius) {
    const angle = Math.atan2(target.y - source.y, target.x - source.x);
    const x = target.x - Math.cos(angle) * (radius + 3);
    const y = target.y - Math.sin(angle) * (radius + 3);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - Math.cos(angle - 0.55) * 6, y - Math.sin(angle - 0.55) * 6);
    context.lineTo(x - Math.cos(angle + 0.55) * 6, y - Math.sin(angle + 0.55) * 6);
    context.closePath();
    context.fill();
  }

  draw() {
    if (!this.context || !this.width || !this.height) return;
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    context.fillStyle = "#090c0f";
    context.fillRect(0, 0, this.width, this.height);
    this.drawGrid(context);
    this.maxDegree = Math.max(1, ...this.nodes.map((node) => node.degree || 0));
    const screenPositions = new Map();
    for (const [id, position] of this.positions) screenPositions.set(id, this.worldToScreen(position));
    const activityNow = this.activityLive ? Date.now() : this.activityAsOf || Date.now();
    const activitySnapshot = this.activityFocus && window.ZivarActivity
      ? this.activitySnapshot(activityNow)
      : null;
    const activeActivityIds = new Set(activitySnapshot?.active.map((item) => item.id) || []);
    const warmActivityIds = new Set();
    const pathActivityIds = new Set();
    const pathActivityEdges = new Set();
    if (activitySnapshot) {
      for (const [id, visits] of activitySnapshot.visits) {
        if (window.ZivarActivity.heatAt(visits, activityNow, this.activityHalfLife) >= 0.08) {
          warmActivityIds.add(id);
        }
      }
      for (const transition of activitySnapshot.transitions.slice(-64)) {
        const age = activityNow - transition.time;
        if (!transition.path || age < 0 || age > this.transitionDuration(transition)) continue;
        for (const id of transition.path.nodes) pathActivityIds.add(id);
        for (let index = 1; index < transition.path.nodes.length; index += 1) {
          const source = transition.path.nodes[index - 1];
          const target = transition.path.nodes[index];
          pathActivityEdges.add(`${source}\0${target}`);
          pathActivityEdges.add(`${target}\0${source}`);
        }
      }
    }
    const focusIds = new Set(this.selected);
    if (this.hovered) focusIds.add(this.hovered);
    const highlightedNodes = new Set(focusIds);
    for (const edge of this.edges) {
      if (focusIds.has(edge.source)) highlightedNodes.add(edge.target);
      if (focusIds.has(edge.target)) highlightedNodes.add(edge.source);
    }

    const relationColors = new Map();
    const topEdges = [...this.edges].sort((a, b) => (b.count || b.weight || 1) - (a.count || a.weight || 1));
    const maximumEdgeWeight = Math.max(1, topEdges[0]?.count || topEdges[0]?.weight || 1);
    for (const edge of topEdges) {
      const source = screenPositions.get(edge.source);
      const target = screenPositions.get(edge.target);
      if (!source || !target) continue;
      if (
        (source.x < -100 && target.x < -100)
        || (source.x > this.width + 100 && target.x > this.width + 100)
        || (source.y < -100 && target.y < -100)
        || (source.y > this.height + 100 && target.y > this.height + 100)
      ) continue;
      const relationColor = relationColors.get(edge.relation)
        || COLORS[hash(edge.relation) % COLORS.length];
      relationColors.set(edge.relation, relationColor);
      const weight = edge.count || edge.weight || 1;
      const strength = Math.log2(weight + 1) / Math.log2(maximumEdgeWeight + 1);
      const focused = this.selected.has(edge.source)
        || this.selected.has(edge.target)
        || this.hovered === edge.source
        || this.hovered === edge.target;
      const activityPath = pathActivityEdges.has(`${edge.source}\0${edge.target}`);
      let alpha = edge.confidence === "INFERRED"
        ? 0.16 + strength * 0.3
        : 0.25 + strength * 0.55;
      if (focusIds.size) alpha = 0.035;
      if (focused) alpha = 0.95;
      context.strokeStyle = this.activityFocus
        ? activityPath ? "rgba(47,208,223,0.48)" : "rgba(126,143,160,0.11)"
        : withAlpha(relationColor, alpha);
      context.lineWidth = this.activityFocus
        ? activityPath ? 1.4 : 0.35
        : focused ? 2.4 : focusIds.size ? 0.35 : 0.45 + strength * 2.25;
      context.setLineDash(this.options.inferredDash && edge.confidence === "INFERRED" ? [5, 5] : []);
      context.beginPath();
      context.moveTo(source.x, source.y);
      context.lineTo(target.x, target.y);
      context.stroke();
      context.setLineDash([]);
      if (!this.activityFocus && this.options.arrows && this.camera.zoom > 0.26 && this.edges.length < 1800 && (focused || strength > 0.3)) {
        const targetNode = this.nodeById.get(edge.target);
        this.drawArrow(context, source, target, withAlpha(relationColor, focused ? 0.95 : 0.78), this.nodeRadius(targetNode));
      }
    }

    if (!this.activityFocus && this.options.pulse && this.edges.length) {
      const pulseEdges = topEdges.slice(0, 320);
      context.shadowBlur = 8;
      for (let index = 0; index < pulseEdges.length; index += 1) {
        const edge = pulseEdges[index];
        const source = screenPositions.get(edge.source);
        const target = screenPositions.get(edge.target);
        if (!source || !target) continue;
        const phase = ((this.frame * 0.00018 * this.options.pulseSpeed) + (hash(edge.id) % 1000) / 1000) % 1;
        const x = source.x + (target.x - source.x) * phase;
        const y = source.y + (target.y - source.y) * phase;
        const color = relationColors.get(edge.relation) || "#f3c954";
        context.fillStyle = color;
        context.shadowColor = color;
        context.beginPath();
        context.arc(x, y, clamp(1.4 + Math.log2((edge.count || 1) + 1) * 0.35, 1.5, 4), 0, Math.PI * 2);
        context.fill();
      }
      context.shadowBlur = 0;
    }

    if (!this.activityFocus && this.options.edgeLabels && this.camera.zoom > 0.45) {
      context.font = "9px ui-monospace, SFMono-Regular, Consolas, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      for (const edge of topEdges.slice(0, 120)) {
        const source = screenPositions.get(edge.source);
        const target = screenPositions.get(edge.target);
        if (!source || !target) continue;
        const x = (source.x + target.x) / 2;
        const y = (source.y + target.y) / 2;
        const label = edge.label || `${edge.count || 1} ${edge.relation}`;
        const width = context.measureText(label).width + 8;
        context.fillStyle = "rgba(9, 12, 15, 0.88)";
        context.fillRect(x - width / 2, y - 8, width, 16);
        context.fillStyle = "#aab3be";
        context.fillText(label, x, y);
      }
    }

    const orderedNodes = [...this.nodes].sort((a, b) => (a.degree || 0) - (b.degree || 0));
    for (const node of orderedNodes) {
      const position = screenPositions.get(node.id);
      if (!position || position.x < -40 || position.x > this.width + 40 || position.y < -40 || position.y > this.height + 40) continue;
      const radius = this.nodeRadius(node);
      const color = this.nodeColor(node);
      const isSelected = this.selected.has(node.id);
      const isHovered = this.hovered === node.id;
      const activityAlpha = activeActivityIds.has(node.id)
        ? 1
        : pathActivityIds.has(node.id)
          ? 0.84
          : warmActivityIds.has(node.id)
            ? 0.62
            : 0.36;
      context.globalAlpha = this.activityFocus
        ? activityAlpha
        : focusIds.size && !highlightedNodes.has(node.id) ? 0.16 : 1;
      if (!this.activityFocus && this.options.showHubs && (node.degree || 0) >= this.maxDegree * 0.35) {
        context.strokeStyle = withAlpha(color, 0.23);
        context.lineWidth = 1;
        context.beginPath();
        context.arc(position.x, position.y, radius + 4 + Math.sin(this.frame * 0.003 + hash(node.id)) * 1.5, 0, Math.PI * 2);
        context.stroke();
      }
      context.shadowBlur = this.activityFocus
        ? activeActivityIds.has(node.id) ? 12 : 0
        : isSelected || isHovered ? 14 : 0;
      context.shadowColor = color;
      context.fillStyle = color;
      context.strokeStyle = this.activityFocus
        ? activeActivityIds.has(node.id) ? "#ffffff" : withAlpha("#ffffff", 0.18)
        : isSelected ? "#ffffff" : withAlpha("#ffffff", 0.55);
      context.lineWidth = this.activityFocus
        ? activeActivityIds.has(node.id) ? 1.6 : 0.35
        : isSelected ? 1.8 : 0.65;
      const activityRadius = this.activityFocus && !activeActivityIds.has(node.id)
        ? Math.max(0.85, radius * (pathActivityIds.has(node.id) ? 0.82 : 0.58))
        : radius;
      this.drawShape(context, this.options.shape, position.x, position.y, activityRadius);
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      context.globalAlpha = 1;
    }

    if (!this.activityFocus) this.drawLabels(context, screenPositions, focusIds.size ? highlightedNodes : null);
    this.drawActivity(context, activitySnapshot, activityNow);
    this.drawLasso(context);
    this.drawMinimap();
  }

  drawLabels(context, screenPositions, highlightedNodes = null) {
    if (this.options.labelDensity <= 0 || !this.nodes.length) return;
    const ordered = [...this.nodes].sort((a, b) => {
      const selectedA = this.selected.has(a.id) || this.hovered === a.id ? 1 : 0;
      const selectedB = this.selected.has(b.id) || this.hovered === b.id ? 1 : 0;
      return selectedB - selectedA || (b.degree || 0) - (a.degree || 0);
    });
    const limit = Math.max(6, Math.ceil(ordered.length * this.options.labelDensity / 100));
    const occupied = [];
    context.font = "11px Inter, system-ui, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    let drawn = 0;
    for (const node of ordered) {
      const forced = this.selected.has(node.id) || this.hovered === node.id;
      if (highlightedNodes && !highlightedNodes.has(node.id)) continue;
      if (!forced && drawn >= limit) break;
      const position = screenPositions.get(node.id);
      if (!position || position.x < 0 || position.x > this.width || position.y < 0 || position.y > this.height) continue;
      if (!forced && this.camera.zoom < 0.22) continue;
      const radius = this.nodeRadius(node);
      const label = node.label.length > 48 ? `${node.label.slice(0, 45)}…` : node.label;
      const width = context.measureText(label).width;
      const rect = { x: position.x + radius + 5, y: position.y - 8, width: width + 8, height: 16 };
      const overlaps = !forced && occupied.some((item) => (
        rect.x < item.x + item.width
        && rect.x + rect.width > item.x
        && rect.y < item.y + item.height
        && rect.y + rect.height > item.y
      ));
      if (overlaps) continue;
      occupied.push(rect);
      context.fillStyle = forced ? "rgba(9, 12, 15, 0.94)" : "rgba(9, 12, 15, 0.72)";
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.fillStyle = forced ? "#ffffff" : "#c4ccd5";
      context.fillText(label, rect.x + 4, position.y);
      drawn += 1;
    }
  }

  activitySnapshot(now) {
    const engine = window.ZivarActivity;
    const events = this.activity
      .filter((event) => {
        const time = Date.parse(event.timestamp);
        return Number.isFinite(time)
          && time <= now
          && (!this.activityAgents || this.activityAgents.has(event.agent || "Agent"));
      })
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const visits = new Map();
    const latest = new Map();
    const transitions = [];
    for (const event of events) {
      const id = this.targetId(event.target, event.project);
      if (!id) continue;
      const time = Date.parse(event.timestamp);
      const agent = event.agent || "Agent";
      const color = event.status === "error" ? "#ff5d67" : engine.agentColor(agent);
      if (["focus", "change", "error"].includes(event.kind)) {
        if (!visits.has(id)) visits.set(id, []);
        visits.get(id).push({
          time,
          weight: event.renewal ? 0.35 : event.kind === "error" ? 1.2 : event.kind === "change" ? 0.8 : 1,
          color,
        });
      }
      if (event.kind !== "focus") continue;
      const previous = latest.get(agent);
      if (
        previous
        && !event.renewal
        && previous.id !== id
        && time - previous.time <= 10 * 60_000
      ) {
        transitions.push({
          agent,
          color,
          time,
          target: id,
          path: engine.findPath(this.edges, previous.id, id, engine.MAX_HOPS),
        });
      }
      latest.set(agent, { id, time, event, color });
    }
    const active = [...latest.entries()]
      .map(([agent, item]) => ({ agent, ...item }))
      .filter((item) => engine.isLeaseActive(item.event, now));
    return { active, transitions, visits };
  }

  drawActivity(context, preparedSnapshot = null, preparedNow = null) {
    if (!window.ZivarActivity || !this.activity.length) return;
    const now = preparedNow ?? (this.activityLive ? Date.now() : this.activityAsOf || Date.now());
    const snapshot = preparedSnapshot || this.activitySnapshot(now);
    if (!snapshot.visits.size && !snapshot.active.length) return;
    const engine = window.ZivarActivity;
    const adjacency = engine.buildAdjacency(this.edges);
    const activeIds = new Set(snapshot.active.map((item) => item.id));
    const contextIds = new Set();
    for (const id of activeIds) {
      for (const neighbor of adjacency.get(id) || []) {
        if (!activeIds.has(neighbor.other)) contextIds.add(neighbor.other);
      }
    }

    context.save();
    context.lineCap = "round";
    for (const id of contextIds) {
      const world = this.positions.get(id);
      if (!world) continue;
      const point = this.worldToScreen(world);
      const radius = this.nodeRadius(this.nodeById.get(id)) + 7;
      context.setLineDash([2, 4]);
      context.strokeStyle = "rgba(143,153,167,0.2)";
      context.lineWidth = 1;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.setLineDash([]);

    const heated = [...snapshot.visits.entries()]
      .map(([id, visits]) => ({
        id,
        visits,
        heat: engine.heatAt(visits, now, this.activityHalfLife),
      }))
      .filter((item) => item.heat >= 0.025)
      .sort((a, b) => b.heat - a.heat);
    for (const item of heated.slice(0, 300).reverse()) {
      const world = this.positions.get(item.id);
      if (!world) continue;
      const point = this.worldToScreen(world);
      const node = this.nodeById.get(item.id);
      const color = item.visits.at(-1)?.color || "#2fd0df";
      const radius = this.nodeRadius(node) + 4 + Math.min(8, item.heat * 3);
      context.shadowColor = color;
      context.shadowBlur = 10 + item.heat * 8;
      context.fillStyle = withAlpha(color, Math.min(0.17, 0.035 + item.heat * 0.055));
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    }

    if (heated.length > 300) {
      const communities = new Map();
      for (const item of heated.slice(300)) {
        const node = this.nodeById.get(item.id);
        const world = this.positions.get(item.id);
        if (!node || !world) continue;
        const key = `${node.project || ""}:${node.community}`;
        const group = communities.get(key) || { x: 0, y: 0, heat: 0, count: 0 };
        group.x += world.x;
        group.y += world.y;
        group.heat += item.heat;
        group.count += 1;
        communities.set(key, group);
      }
      for (const group of [...communities.values()].sort((a, b) => b.heat - a.heat).slice(0, 24)) {
        const point = this.worldToScreen({ x: group.x / group.count, y: group.y / group.count });
        context.strokeStyle = "rgba(243,201,84,0.32)";
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(point.x, point.y, 12 + Math.log2(group.count + 1) * 4, 0, Math.PI * 2);
        context.stroke();
      }
    }

    let particles = 0;
    for (const transition of snapshot.transitions.slice(-64)) {
      const age = now - transition.time;
      const duration = this.transitionDuration(transition);
      if (age < 0 || age > duration) continue;
      const targetWorld = this.positions.get(transition.target);
      if (!transition.path) {
        if (!targetWorld) continue;
        const target = this.worldToScreen(targetWorld);
        context.strokeStyle = withAlpha(transition.color, 0.8 * (1 - age / duration));
        context.lineWidth = 2;
        context.beginPath();
        context.arc(target.x, target.y, 8 + age / 70, 0, Math.PI * 2);
        context.stroke();
        continue;
      }
      const points = transition.path.nodes
        .map((id) => this.positions.get(id))
        .filter(Boolean)
        .map((position) => this.worldToScreen(position));
      if (points.length < 2) continue;
      context.strokeStyle = withAlpha(transition.color, 0.68);
      context.lineWidth = 2;
      context.shadowColor = transition.color;
      context.shadowBlur = 9;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
      context.shadowBlur = 0;
      if (!this.reducedMotion && particles < 64) {
        const progress = clamp(age / duration, 0, 0.9999) * (points.length - 1);
        const index = Math.floor(progress);
        const local = progress - index;
        const source = points[index];
        const target = points[index + 1];
        const x = source.x + (target.x - source.x) * local;
        const y = source.y + (target.y - source.y) * local;
        context.shadowColor = transition.color;
        context.shadowBlur = 15;
        context.fillStyle = "#ffffff";
        context.beginPath();
        context.arc(x, y, 2.5, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;
        particles += 1;
      }
    }

    for (let index = 0; index < snapshot.active.length; index += 1) {
      const item = snapshot.active[index];
      const world = this.positions.get(item.id);
      if (!world) continue;
      const point = this.worldToScreen(world);
      const phase = this.reducedMotion ? 0 : Math.sin(this.frame * 0.007 + index) * 2.5;
      context.shadowColor = item.color;
      context.shadowBlur = 18;
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = item.color;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(point.x, point.y, 9 + phase, 0, Math.PI * 2);
      context.stroke();
      const nodeLabel = item.event.target?.label || this.nodeById.get(item.id)?.label || "";
      const label = `${String(item.agent).slice(0, 14)}${nodeLabel ? ` · ${nodeLabel.slice(0, 28)}` : ""}`;
      context.font = "10px Inter, system-ui, sans-serif";
      const width = context.measureText(label).width + 10;
      context.fillStyle = "rgba(9,12,15,0.9)";
      context.fillRect(point.x + 11, point.y - 9, width, 18);
      context.fillStyle = item.color;
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(label, point.x + 16, point.y);
    }
    context.restore();
  }

  needsActivityFrame(now) {
    if (this.reducedMotion || !this.activity.length) return false;
    const visible = this.activity.filter((event) => (
      !this.activityAgents || this.activityAgents.has(event.agent || "Agent")
    ));
    if (visible.some((event) => event.kind === "focus" && window.ZivarActivity.isLeaseActive(event, now))) return true;
    if (this.activityHalfLife === Infinity) return false;
    return visible.some((event) => {
      const age = now - Date.parse(event.timestamp);
      return age >= 0 && age < this.activityHalfLife * 8;
    });
  }

  drawLasso(context) {
    if (!this.lasso) return;
    const x = Math.min(this.lasso.start.x, this.lasso.end.x);
    const y = Math.min(this.lasso.start.y, this.lasso.end.y);
    const width = Math.abs(this.lasso.end.x - this.lasso.start.x);
    const height = Math.abs(this.lasso.end.y - this.lasso.start.y);
    context.fillStyle = "rgba(47, 208, 223, 0.08)";
    context.strokeStyle = "rgba(47, 208, 223, 0.8)";
    context.setLineDash([5, 4]);
    context.fillRect(x, y, width, height);
    context.strokeRect(x, y, width, height);
    context.setLineDash([]);
  }

  drawMinimap() {
    if (!this.options.minimap || !this.positions.size) return;
    const context = this.miniContext;
    const width = this.minimap.width;
    const height = this.minimap.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#0d1116";
    context.fillRect(0, 0, width, height);
    const values = [...this.positions.values()];
    const minX = Math.min(...values.map((item) => item.x));
    const maxX = Math.max(...values.map((item) => item.x));
    const minY = Math.min(...values.map((item) => item.y));
    const maxY = Math.max(...values.map((item) => item.y));
    const scale = Math.min((width - 12) / Math.max(1, maxX - minX), (height - 12) / Math.max(1, maxY - minY));
    const mapPoint = (position) => ({
      x: 6 + (position.x - minX) * scale,
      y: 6 + (position.y - minY) * scale,
    });
    context.globalAlpha = 0.2;
    context.strokeStyle = "#738093";
    context.lineWidth = 0.5;
    context.beginPath();
    for (const edge of this.edges.slice(0, 1200)) {
      const source = this.positions.get(edge.source);
      const target = this.positions.get(edge.target);
      if (!source || !target) continue;
      const a = mapPoint(source);
      const b = mapPoint(target);
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
    }
    context.stroke();
    context.globalAlpha = 0.85;
    for (const node of this.nodes) {
      const point = mapPoint(this.positions.get(node.id));
      context.fillStyle = this.nodeColor(node);
      context.fillRect(point.x - 1, point.y - 1, 2, 2);
    }
    context.globalAlpha = 1;
    const topLeft = this.screenToWorld({ x: 0, y: 0 });
    const bottomRight = this.screenToWorld({ x: this.width, y: this.height });
    const viewportA = mapPoint(topLeft);
    const viewportB = mapPoint(bottomRight);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1;
    context.strokeRect(
      viewportA.x,
      viewportA.y,
      Math.max(2, viewportB.x - viewportA.x),
      Math.max(2, viewportB.y - viewportA.y),
    );
  }

  hitTest(point) {
    let best = null;
    let bestDistance = Infinity;
    for (const node of this.nodes) {
      const position = this.worldToScreen(this.positions.get(node.id));
      const distance = Math.hypot(point.x - position.x, point.y - position.y);
      const threshold = this.nodeRadius(node) + 8;
      if (distance <= threshold && distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  }

  installEvents() {
    const pointFor = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.zoomBy(event.deltaY < 0 ? 1.13 : 0.885, pointFor(event));
    }, { passive: false });

    this.canvas.addEventListener("pointerdown", (event) => {
      const point = pointFor(event);
      const node = this.hitTest(point);
      this.canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, point);
      if (event.pointerType === "touch" && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        this.gesture = {
          distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
          angle: Math.atan2(b.y - a.y, b.x - a.x),
        };
        this.pointer = null;
        this.drag = null;
        this.lasso = null;
        this.canvas.classList.add("dragging");
        return;
      }
      this.pointer = {
        id: event.pointerId,
        pointerType: event.pointerType,
        start: point,
        current: point,
        moved: false,
      };
      if (this.tool === "lasso" && !event.ctrlKey && !event.shiftKey) {
        this.lasso = { start: point, end: point };
        this.draw();
        return;
      }
      if (node && this.tool === "move" && !event.ctrlKey && !event.shiftKey && event.button === 0) {
        this.drag = { type: "node", id: node.id };
      } else {
        this.drag = { type: "pan", camera: { ...this.camera } };
      }
      this.canvas.classList.add("dragging");
    });

    this.canvas.addEventListener("pointermove", (event) => {
      const point = pointFor(event);
      if (this.pointers.has(event.pointerId)) this.pointers.set(event.pointerId, point);
      if (this.gesture && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.zoomBy(clamp(distance / this.gesture.distance, 0.82, 1.22), center);
        this.rotate(angle - this.gesture.angle);
        this.gesture.distance = distance;
        this.gesture.angle = angle;
        return;
      }
      if (!this.pointer) {
        const node = this.hitTest(point);
        const next = node?.id || null;
        if (next !== this.hovered) {
          this.hovered = next;
          this.canvas.title = node ? `${node.label}\n${node.subtitle || ""}` : "";
          this.draw();
        }
        return;
      }
      if (event.pointerId !== this.pointer.id) return;
      this.pointer.current = point;
      const dx = point.x - this.pointer.start.x;
      const dy = point.y - this.pointer.start.y;
      this.pointer.moved ||= Math.hypot(dx, dy) > 3;
      if (this.lasso) {
        this.lasso.end = point;
      } else if (this.drag?.type === "node") {
        this.positions.set(this.drag.id, this.screenToWorld(point));
      } else if (this.drag?.type === "pan") {
        this.camera.x = this.drag.camera.x - dx / this.camera.zoom;
        this.camera.y = this.drag.camera.y - dy / this.camera.zoom;
      }
      this.draw();
    });

    const finishPointer = (event, cancelled = false) => {
      this.pointers.delete(event.pointerId);
      try {
        if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Capture may already be released by the browser.
      }
      if (this.gesture) {
        if (this.pointers.size < 2) this.gesture = null;
        this.pointer = null;
        this.drag = null;
        this.lasso = null;
        if (!this.pointers.size) this.canvas.classList.remove("dragging");
        this.draw();
        return;
      }
      if (!this.pointer) return;
      if (event.pointerId !== this.pointer.id) return;
      if (this.lasso && !cancelled) {
        const x1 = Math.min(this.lasso.start.x, this.lasso.end.x);
        const x2 = Math.max(this.lasso.start.x, this.lasso.end.x);
        const y1 = Math.min(this.lasso.start.y, this.lasso.end.y);
        const y2 = Math.max(this.lasso.start.y, this.lasso.end.y);
        this.selected = new Set(this.nodes
          .filter((node) => {
            const position = this.worldToScreen(this.positions.get(node.id));
            return position.x >= x1 && position.x <= x2 && position.y >= y1 && position.y <= y2;
          })
          .map((node) => node.id));
        this.lasso = null;
        this.onSelect?.([...this.selected], true);
      } else if (!cancelled && !this.pointer.moved) {
        const node = this.hitTest(this.pointer.current);
        this.selected = new Set(node ? [node.id] : []);
        this.onSelect?.(node ? [node.id] : [], false);
        if (this.pointer.pointerType === "touch" && node) {
          const tappedAt = Date.now();
          if (this.lastTap?.id === node.id && tappedAt - this.lastTap.time < 350) {
            this.onDoubleClick?.(node);
            this.lastTap = null;
          } else {
            this.lastTap = { id: node.id, time: tappedAt };
          }
        }
      }
      this.pointer = null;
      this.drag = null;
      this.canvas.classList.remove("dragging");
      this.draw();
    };
    this.canvas.addEventListener("pointerup", finishPointer);
    this.canvas.addEventListener("pointercancel", (event) => finishPointer(event, true));
    this.canvas.addEventListener("dblclick", (event) => {
      if (event.sourceCapabilities?.firesTouchEvents) return;
      const node = this.hitTest(pointFor(event));
      if (node) this.onDoubleClick?.(node);
    });
  }

  animate(time) {
    const delta = time - this.lastFrame;
    this.lastFrame = time;
    this.frame += delta;
    const now = this.activityLive ? Date.now() : this.activityAsOf;
    if (this.autoOrbit && this.positions.size && !this.reducedMotion) this.rotate(delta * 0.00009);
    else if (
      !this.reducedMotion
      && (this.options.pulse || this.needsActivityFrame(now))
      && time - this.lastActivityDraw >= 50
    ) {
      this.lastActivityDraw = time;
      this.draw();
    }
    requestAnimationFrame((nextTime) => this.animate(nextTime));
  }
}

const graph = new window.BrainGraph3D($("#graph-canvas"), $("#minimap"));

function projectMetaText(project) {
  if (!project) return "Välj en kodbas";
  return `${formatNumber(project.nodes)} noder · ${formatNumber(project.edges)} kopplingar`;
}

function renderProjects() {
  for (const slot of ["A", "B"]) {
    const project = state.projects[slot];
    $(`#project-${slot.toLowerCase()}-name`).textContent = project?.name || "Tom plats";
    $(`#project-${slot.toLowerCase()}-meta`).textContent = projectMetaText(project);
    $(`[data-project-button="${slot}"]`).classList.toggle("active", state.activeSlot === slot && ["A", "B"].includes(state.workspace));
    $(`[data-refresh-project="${slot}"]`).disabled = !project?.canRefresh;
    const picker = $(`[data-library-project="${slot}"]`);
    const selected = project?.libraryProjectId || "";
    const first = document.createElement("option");
    first.value = "";
    first.textContent = project && !selected ? `Egen graf: ${project.name}` : "Välj sparad graf";
    first.disabled = Boolean(selected);
    picker.replaceChildren(first, ...state.libraryProjects.map((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.name;
      return option;
    }));
    picker.value = selected;
    picker.disabled = state.libraryProjects.length === 0;

    const visible = state.workspace === slot || ["both", "diff"].includes(state.workspace);
    const other = slot === "A" ? "B" : "A";
    const otherVisible = state.workspace === other || ["both", "diff"].includes(state.workspace);
    const visibility = $(`[data-project-visible="${slot}"]`);
    visibility.checked = visible;
    visibility.disabled = !project || (visible && !otherVisible);
  }
}

function renderRelationOptions() {
  const select = $("#relation-filter");
  const current = state.filters.relation;
  const relations = new Set();
  const slots = ["both", "diff"].includes(state.workspace) ? ["A", "B"] : [state.activeSlot];
  for (const slot of slots) {
    for (const relation of Object.keys(state.projects[slot]?.relationCounts || {})) relations.add(relation);
  }
  if (["both", "diff"].includes(state.workspace)) relations.add("exact_label_match");
  select.innerHTML = `<option value="ALL">Alla relationer</option>${[...relations]
    .sort()
    .map((relation) => `<option value="${escapeHtml(relation)}">${escapeHtml(relation)}</option>`)
    .join("")}`;
  select.value = relations.has(current) ? current : "ALL";
  state.filters.relation = select.value;
}

function renderViewHeader(view) {
  $("#breadcrumb").innerHTML = (view?.breadcrumb || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  const nodeCount = view?.nodes?.length || 0;
  const edgeCount = view?.edges?.length || 0;
  $("#view-stats").textContent = `${formatNumber(nodeCount)} noder · ${formatNumber(edgeCount)} kopplingar`;
  $("#node-visible-count").textContent = formatNumber(nodeCount);
  $("#edge-visible-count").textContent = formatNumber(edgeCount);
  $("#hidden-node-count").textContent = formatNumber(Math.max(0, Number(view?.filterStats?.rawNodes || nodeCount) - nodeCount));
  $("#render-status").textContent = `${formatNumber(nodeCount)} noder · ${formatNumber(edgeCount)} kopplingar`;
  $("#back-view").disabled = ["both", "diff"].includes(state.workspace)
    || state.stacks[state.activeSlot].length <= 1;
}

function renderLegend(view) {
  const items = [];
  if (view?.branchLens || view?.diffLens) {
    items.push(
      ["#48d28b", view.diffLens ? "Bara i B" : "Tillagd"],
      ["#f3c954", "Ändrad"],
      ["#ff5d67", view.diffLens ? "Bara i A" : "Raderad"],
    );
    if (!view.diffLens) items.push(["#5f96e8", "Namnbytt"], ["#70cbd4", "Påverkad"]);
  } else if (state.options.color === "project") {
    items.push(["#2fd0df", "Projekt A"], ["#ff716b", "Projekt B"], ["#f3c954", "Matchning"]);
  } else if (state.options.color === "kind") {
    items.push(["#f3c954", "Community"], ["#48d28b", "Fil"], ["#2fd0df", "Funktion"], ["#5f96e8", "Tabell"]);
  } else if (state.options.color === "risk") {
    items.push(["#48d28b", "Låg"], ["#f3c954", "Medel"], ["#ff5d67", "Hög kopplingsyta"]);
  } else {
    const communities = [...new Set((view?.nodes || []).map((node) => node.community))].slice(0, 8);
    communities.forEach((community) => items.push([COLORS[Math.abs(Number(community) || 0) % COLORS.length], `C${community}`]));
  }
  $("#legend").innerHTML = items.map(([color, label]) => `<span><i style="background:${color}"></i>${escapeHtml(label)}</span>`).join("");
}

function viewRequest() {
  const stack = state.stacks[state.activeSlot];
  return {
    ...stack[stack.length - 1],
    filters: { ...state.filters },
  };
}

function applyViewFilters(view) {
  if (!view) return view;
  const relation = state.filters.relation;
  const confidence = state.filters.confidence;
  const minWeight = Number(state.filters.minWeight) || 0;
  const edges = (view.edges || []).filter((edge) => (
    (relation === "ALL" || edge.relation === relation)
    && (confidence === "ALL" || String(edge.confidence || "").toUpperCase() === confidence)
    && Number(edge.weight ?? edge.count ?? 1) >= minWeight
  ));
  const active = relation !== "ALL" || confidence !== "ALL" || minWeight > 0;
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const nodes = active
    ? (view.nodes || []).filter((node) => connected.has(node.id))
    : (view.nodes || []);
  return {
    ...view,
    nodes,
    edges,
    filterStats: {
      rawNodes: view.nodes?.length || 0,
      rawEdges: view.edges?.length || 0,
      hiddenNodes: Math.max(0, (view.nodes?.length || 0) - nodes.length),
      hiddenEdges: Math.max(0, (view.edges?.length || 0) - edges.length),
    },
  };
}

async function loadCurrentView(resetCamera = true) {
  const requestId = ++state.requestId;
  try {
    let view;
    if (["both", "diff"].includes(state.workspace)) {
      if (!state.projects.A || !state.projects.B) throw new Error("Ladda två projekt för jämförelse.");
      view = await invoke("comparisonGraph", state.workspace === "diff");
    } else {
      if (!state.projects[state.activeSlot]) {
        state.currentView = null;
        graph.setData({ nodes: [], edges: [] });
        $("#empty-state").hidden = false;
        renderViewHeader(null);
        return;
      }
      view = await invoke("getView", { slot: state.activeSlot, ...viewRequest() });
    }
    if (requestId !== state.requestId) return;
    view = applyViewFilters(view);
    state.currentView = view;
    $("#empty-state").hidden = true;
    graph.setOptions(state.options);
    graph.setData(view, { resetCamera });
    syncGraphActivity();
    renderViewHeader({ ...view, nodes: graph.nodes, edges: graph.edges });
    renderLegend(view);
    renderAudit();
    scheduleStatePublish();
  } catch (error) {
    $("#empty-state").hidden = !(!state.projects.A && !state.projects.B);
    toast(error.message, true);
  }
}

function syncWorkspaceControls() {
  $$("[data-workspace]").forEach((button) => button.classList.toggle("active", button.dataset.workspace === state.workspace));
  $("#brain-mode").disabled = !["both", "diff"].includes(state.workspace);
}

function setWorkspace(workspace) {
  state.workspace = workspace;
  if (workspace === "A" || workspace === "B") state.activeSlot = workspace;
  syncWorkspaceControls();
  if (workspace === "diff") {
    openDetailTab("compare");
  }
  renderProjects();
  renderRelationOptions();
  loadCurrentView();
}

function pushView(view) {
  state.stacks[state.activeSlot].push(view);
  loadCurrentView();
}

function drillNode(node = state.selectedViewNode) {
  if (!node) return;
  if (state.currentView?.mode === "comparison") {
    if (state.currentView.branchLens) {
      const branchMatch = /^(A|B):(.+)$/.exec(node.id);
      if (!branchMatch) return;
      state.activeSlot = branchMatch[1];
      state.workspace = branchMatch[1];
      state.stacks[state.activeSlot] = [
        { mode: "overview" },
        { mode: "neighborhood", key: branchMatch[2], depth: 1 },
      ];
      setWorkspace(branchMatch[1]);
      return;
    }
    const match = /^(A|B):community:(-?\d+)$/.exec(node.id);
    if (!match) return;
    state.activeSlot = match[1];
    state.workspace = match[1];
    state.stacks[state.activeSlot] = [
      { mode: "overview" },
      { mode: "community", key: Number(match[2]) },
    ];
    setWorkspace(match[1]);
    return;
  }
  if (node.kind === "community") pushView({ mode: "community", key: node.community });
  else if (node.kind === "file") pushView({ mode: "file", key: node.sourceFile });
  else pushView({ mode: "neighborhood", key: node.id, depth: 1 });
}

async function selectNode(ids, isMulti = false) {
  const countElement = $("#selection-count");
  const mobileSelection = $("#mobile-selection");
  countElement.hidden = !isMulti || ids.length < 2;
  countElement.textContent = `${ids.length} noder markerade`;
  mobileSelection.hidden = !ids.length;
  if (!ids.length) {
    state.selectedDetail = null;
    state.selectedViewNode = null;
    state.inspected = { slot: "", id: "", viewId: "" };
    renderInspector();
    scheduleStatePublish();
    return;
  }
  const id = ids[0];
  const selectedNode = state.currentView?.nodes?.find((node) => node.id === id);
  mobileSelection.textContent = isMulti && ids.length > 1
    ? `${ids.length} markerade`
    : selectedNode?.label || "Vald nod";
  let slot = state.activeSlot;
  let detailId = id;
  if (state.currentView?.mode === "comparison") {
    const match = /^(A|B):(.+)$/.exec(id);
    if (match) {
      slot = match[1];
      detailId = match[2];
    }
  }
  const viewNode = state.currentView.nodes.find((node) => node.id === id);
  state.selectedViewNode = viewNode || null;
  try {
    state.selectedDetail = await invoke("getNode", slot, detailId);
    state.selectedDetailSlot = slot;
    state.inspected = { slot, id: detailId, viewId: id };
    renderInspector();
    openDetailTab("inspector");
    scheduleStatePublish();
  } catch (error) {
    toast(error.message, true);
  }
}

async function restoreInspectedSelection() {
  const inspected = state.inspected;
  if (!inspected.id || !inspected.viewId) return;
  const viewNode = state.currentView?.nodes?.find((node) => node.id === inspected.viewId);
  if (!viewNode || !graph.selectTarget({ id: inspected.viewId }, inspected.slot)) return;
  try {
    state.selectedViewNode = viewNode;
    state.selectedDetail = await invoke("getNode", inspected.slot, inspected.id);
    state.selectedDetailSlot = inspected.slot;
    $("#mobile-selection").hidden = false;
    $("#mobile-selection").textContent = viewNode.label || "Vald nod";
    renderInspector();
  } catch {
    state.inspected = { slot: "", id: "", viewId: "" };
  }
}

function renderInspector() {
  const detail = state.selectedDetail;
  $("#node-empty").hidden = Boolean(detail);
  $("#node-inspector").hidden = !detail;
  if (!detail) return;
  $("#node-kind").textContent = detail.kind || detail.file_type || "Nod";
  $("#node-title").textContent = detail.label || detail.id;
  const sourceFile = detail.source_file || detail.sourceFile || "";
  const sourceLocation = detail.source_location || detail.sourceLocation || "";
  $("#node-path").textContent = sourceFile || detail.community_name || "";
  const metrics = [
    [detail.degree ?? detail.summary?.degree ?? detail.summary?.edges ?? 0, "Kopplingar"],
    [detail.summary?.nodes ?? detail.rawCount ?? detail.neighbors?.length ?? 1, "Noder"],
    [detail.community ?? detail.summary?.files ?? "–", detail.community == null ? "Filer" : "Community"],
  ];
  $("#node-metrics").innerHTML = metrics.map(([value, label]) => (
    `<div><strong>${escapeHtml(formatNumber(value))}</strong><span>${escapeHtml(label)}</span></div>`
  )).join("");
  const neighbors = detail.neighbors || detail.topNodes || detail.topFiles || [];
  const project = state.projects[state.selectedDetailSlot];
  const catalogProject = state.catalogProjects.find((entry) => entry.id === project?.libraryProjectId);
  const selectedSnapshot = catalogProject
    ? (state.catalogSnapshots[catalogProject.id] || []).find((entry) => (
      entry.id === (
        catalogProject.id === state.context.projectId
          ? state.context.snapshotId
          : catalogProject.currentSnapshotId
      )
    ))
    : null;
  const snapshotFresh = Boolean(
    selectedSnapshot
    && catalogProject?.currentSnapshotId
    && selectedSnapshot.id === catalogProject.currentSnapshotId,
  );
  $("#node-source").textContent = [sourceFile || project?.name || "", sourceLocation]
    .filter(Boolean)
    .join(":") || "Okänd";
  $("#node-freshness").textContent = selectedSnapshot
    ? `${snapshotFresh ? "Aktuell" : "Inaktuell"} · ${selectedSnapshot.id}`
    : project?.builtAtCommit
      ? `Commit ${String(project.builtAtCommit).slice(0, 12)}`
      : "Okänd";
  const risk = Number(project?.audit?.riskScore);
  $("#node-audit-result").textContent = Number.isFinite(risk)
    ? `${risk}/100 · ${risk >= 60 ? "hög" : risk >= 30 ? "medel" : "låg"} risk`
    : "Okänd";
  $("#node-context").textContent = [
    detail.community_name || detail.communityName,
    detail.file_type || detail.kind,
    Array.isArray(detail.relations) && detail.relations.length ? detail.relations.join(", ") : "",
  ].filter(Boolean).join(" · ") || "Ingen ytterligare grafkontext.";
  $("#node-evidence").innerHTML = neighbors.slice(0, 20).map((item) => {
    const evidence = item.evidence || {};
    const evidenceSource = [evidence.sourceFile || item.sourceFile, evidence.sourceLocation]
      .filter(Boolean)
      .join(":");
    const confidence = [
      item.confidence || "UNKNOWN",
      Number.isFinite(Number(item.confidenceScore)) && Number(item.confidenceScore) > 0
        ? formatPercent(item.confidenceScore)
        : "",
    ].filter(Boolean).join(" · ");
    return `
      <article>
        <strong>${escapeHtml(item.relation || item.kind || "relation")}</strong>
        <span>${escapeHtml(confidence)}</span>
        <small>${escapeHtml(evidenceSource || "Källa okänd")}${evidence.context ? ` · ${escapeHtml(evidence.context)}` : ""}</small>
      </article>
    `;
  }).join("") || '<p class="reader-muted">Ingen relationsbaserad evidens i vald vy.</p>';
  $("#neighbor-count").textContent = formatNumber(neighbors.length);
  $("#neighbor-list").innerHTML = neighbors.slice(0, 40).map((item) => {
    const id = item.id || "";
    const label = item.label || item.sourceFile || id;
    const subtitle = item.sourceFile || item.subtitle || "";
    const relation = item.relation || item.kind || `${item.rawCount || item.degree || ""}`;
    return `
      <button data-neighbor-id="${escapeHtml(id)}">
        <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(subtitle)}</small></span>
        <span class="relation-badge">${escapeHtml(relation)}</span>
      </button>
    `;
  }).join("");
  const rawNode = !String(detail.id).startsWith("community:") && !String(detail.id).startsWith("file:");
  $("#use-as-a").disabled = !rawNode || !state.projects.A;
  $("#use-as-b").disabled = !rawNode || !state.projects.B;
}

function renderAudit() {
  const project = state.projects[state.activeSlot];
  if (!project) return;
  const audit = project.audit || {};
  $("#audit-title").textContent = project.name;
  $("#risk-gauge strong").textContent = audit.riskScore ?? 0;
  $("#risk-gauge").style.color = (audit.riskScore || 0) >= 60 ? "#ff5d67" : (audit.riskScore || 0) >= 30 ? "#f3c954" : "#48d28b";
  const items = [
    [audit.isolates, "Isolerade noder"],
    [audit.inferred, "Infererade länkar"],
    [audit.duplicateEdges, "Dubblettkanter"],
    [audit.importCycles, "Importcykler"],
    [audit.selfLoops, "Självlänkar"],
    [project.components, "Komponenter"],
  ];
  $("#audit-metrics").innerHTML = items.map(([value, label]) => (
    `<div><strong>${escapeHtml(formatNumber(value))}</strong><span>${escapeHtml(label)}</span></div>`
  )).join("");
  $("#hub-list").innerHTML = (audit.hubs || []).slice(0, 12).map((hub) => `
    <button data-hub-id="${escapeHtml(hub.id)}">
      <span><strong>${escapeHtml(hub.label)}</strong><small>${escapeHtml(hub.sourceFile)}</small></span>
      <span class="relation-badge">${formatNumber(hub.degree)}</span>
    </button>
  `).join("");
  $("#risk-formula").textContent = audit.formula || "";
}

async function refreshComparison() {
  if (!state.projects.A || !state.projects.B) {
    state.comparison = null;
    renderComparison();
    return;
  }
  try {
    state.comparison = await invoke("compare");
    renderComparison();
  } catch (error) {
    toast(error.message, true);
  }
}

function renderComparison() {
  const comparison = state.comparison;
  if (!comparison) {
    $("#overall-score").textContent = "–";
    $("#facet-list").innerHTML = "";
    $("#match-list").innerHTML = "";
    renderBranchImpact();
    return;
  }
  $("#overall-score").textContent = formatPercent(comparison.overall, 1);
  const labels = {
    labels: "Nodnamn",
    files: "Filnamn",
    relations: "Relationer",
    nodeKinds: "Nodtyper",
    roots: "Toppmappar",
  };
  $("#facet-list").innerHTML = Object.entries(comparison.facets).map(([key, value]) => `
    <div class="facet-row">
      <span>${escapeHtml(labels[key] || key)}</span>
      <div class="facet-track"><i style="width:${clamp(value * 100, 0, 100)}%"></i></div>
      <span>${formatPercent(value, 1)}</span>
    </div>
  `).join("");
  $("#shared-labels").textContent = formatNumber(comparison.sharedLabels);
  $("#exact-matches").textContent = formatNumber(comparison.exactMatches.length);
  $("#match-count").textContent = formatNumber(comparison.exactMatches.length);
  $("#match-list").innerHTML = comparison.exactMatches.slice(0, 100).map((match, index) => `
    <button data-match-index="${index}">
      <span><strong>${escapeHtml(match.label)}</strong><small>${escapeHtml(match.aFile)} ↔ ${escapeHtml(match.bFile)}</small></span>
      <span class="relation-badge">${formatNumber(match.aDegree + match.bDegree)}</span>
    </button>
  `).join("");
  renderBranchImpact();
}

function renderBranchImpact() {
  const impact = state.branchImpact;
  const panel = $("#branch-impact-panel");
  panel.hidden = !impact;
  if (!impact) return;
  $("#branch-impact-range").textContent = `${impact.base} → ${impact.branch}`;
  const metrics = [
    [impact.changedFiles?.length, "Ändrade filer"],
    [impact.directNodes?.length, "Direkta noder"],
    [impact.affectedNodes?.length, "Påverkade noder"],
    [impact.possibleTests?.length, "Möjligen berörda tester"],
  ];
  $("#branch-impact-metrics").innerHTML = metrics.map(([value, label]) => (
    `<div><strong>${formatNumber(value)}</strong><span>${escapeHtml(label)}</span></div>`
  )).join("");
  $("#branch-file-list").innerHTML = (impact.changedFiles || []).slice(0, 80).map((file) => `
    <div class="list-row">
      <span><strong>${escapeHtml(file.path)}</strong><small>${escapeHtml(file.oldPath || "")}</small></span>
      <span class="branch-status">${escapeHtml(file.status)}</span>
    </div>
  `).join("");
}

function renderSimulationSelection() {
  $("#simulation-a").textContent = state.selectedLabels.A ? `A: ${state.selectedLabels.A}` : "A: välj nod";
  $("#simulation-b").textContent = state.selectedLabels.B ? `B: ${state.selectedLabels.B}` : "B: välj nod";
  $("#run-simulation").disabled = !(state.selected.A && state.selected.B);
}

async function runSimulation() {
  try {
    const result = await invoke("simulate", state.selected.A, state.selected.B);
    $("#simulation-result").innerHTML = `
      <div class="simulation-result">
        <strong>${escapeHtml(result.verdict)}</strong>
        <div class="simulation-score">
          <div><strong>${formatNumber(result.risk)}</strong><span>Risk / 100</span></div>
          <div><strong>${formatNumber(result.compatibility)}</strong><span>Kompatibilitet / 100</span></div>
        </div>
        ${result.findings.map((finding) => `<div class="finding ${escapeHtml(finding.level)}">${escapeHtml(finding.text)}</div>`).join("")}
        <div class="finding low">${escapeHtml(result.limitation)}</div>
      </div>
    `;
  } catch (error) {
    toast(error.message, true);
  }
}

function contextProject() {
  return state.catalogProjects.find((entry) => entry.id === state.context.projectId) || null;
}

function renderContextSelectors() {
  const options = state.catalogProjects.length
    ? state.catalogProjects.map((project) => (
      `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)} · ${escapeHtml(project.id)}</option>`
    )).join("")
    : '<option value="">Studio V1 är offline</option>';
  for (const selector of ["#reader-project", "#knowledge-project"]) {
    const select = $(selector);
    select.innerHTML = options;
    select.value = state.context.projectId;
    select.disabled = state.catalogProjects.length === 0;
  }

  const snapshots = state.catalogSnapshots[state.context.projectId] || [];
  const project = contextProject();
  $("#reader-snapshot").innerHTML = snapshots.length
    ? snapshots.map((snapshot) => `
      <option value="${escapeHtml(snapshot.id)}">
        ${escapeHtml(snapshot.id)} · ${snapshot.id === project?.currentSnapshotId ? "Current" : "Pinned"} · ${escapeHtml(snapshot.status || "unknown")}
      </option>
    `).join("")
    : '<option value="">Ingen snapshot tillgänglig</option>';
  $("#reader-snapshot").value = state.context.snapshotId;
  $("#reader-snapshot").disabled = snapshots.length === 0;
  const selected = snapshots.find((snapshot) => snapshot.id === state.context.snapshotId);
  const current = Boolean(selected && selected.id === project?.currentSnapshotId);
  $("#reader-snapshot-state").innerHTML = selected ? `
    <span class="status-badge" data-status="${current ? "fresh" : "stale"}">${current ? "Current" : "Pinned"}</span>
    <span class="status-badge" data-status="${current ? "fresh" : "stale"}">Freshness: ${current ? "Aktuell" : "Inaktuell"}</span>
    ${selected.builtAt ? `<span class="status-badge" data-status="neutral">${escapeHtml(new Date(selected.builtAt).toLocaleString("sv-SE"))}</span>` : ""}
  ` : '<span class="status-badge" data-status="unknown">Freshness: Okänd</span>';
  $("#reader-query").value = state.context.query;
}

function renderSystemState() {
  const status = state.integration.status;
  const element = $("#system-state");
  element.className = `system-state ${status}`;
  if (status === "online") {
    element.textContent = "Online · Studio V1 använder Graphify som motor";
    $("#reader-state").textContent = "Online";
    $("#reader-state").dataset.status = "fresh";
  } else if (status === "offline") {
    element.textContent = `Offline · ${state.integration.error || "Studio V1 svarar inte"}`;
    $("#reader-state").textContent = "Offline";
    $("#reader-state").dataset.status = "stale";
  } else {
    element.textContent = "Kontrollerar Studio V1…";
    $("#reader-state").textContent = "Ansluter";
    $("#reader-state").dataset.status = "unknown";
  }
}

async function loadContextSnapshots(projectId) {
  if (!projectId) return;
  const snapshots = await invokeStudioV1("snapshotCatalog", { projectId });
  state.catalogSnapshots[projectId] = Array.isArray(snapshots) ? snapshots : [];
  const project = state.catalogProjects.find((entry) => entry.id === projectId);
  const valid = state.catalogSnapshots[projectId].some((entry) => entry.id === state.context.snapshotId);
  state.context.snapshotId = valid
    ? state.context.snapshotId
    : project?.currentSnapshotId || state.catalogSnapshots[projectId][0]?.id || "";
  renderContextSelectors();
  renderInspector();
}

async function ensureStudioV1(force = false) {
  if (state.integration.loading) return state.integration.loading;
  if (!force && state.integration.status === "online") return true;
  state.integration.status = "loading";
  state.integration.error = "";
  renderSystemState();
  state.integration.loading = (async () => {
    try {
      const readiness = await invokeStudioV1("readiness");
      if (!readiness?.ready) throw new Error("Studio V1 är inte redo.");
      const projects = await invokeStudioV1("projectCatalog");
      state.catalogProjects = Array.isArray(projects) ? projects : [];
      const loadedId = state.projects[state.activeSlot]?.libraryProjectId
        || state.projects.A?.libraryProjectId
        || state.projects.B?.libraryProjectId;
      if (!state.catalogProjects.some((entry) => entry.id === state.context.projectId)) {
        state.context.projectId = state.catalogProjects.some((entry) => entry.id === loadedId)
          ? loadedId
          : state.catalogProjects[0]?.id || "";
      }
      if (state.context.projectId) await loadContextSnapshots(state.context.projectId);
      state.integration.status = "online";
      renderContextSelectors();
      renderSystemState();
      scheduleStatePublish();
      return true;
    } catch (error) {
      state.integration.status = "offline";
      state.integration.error = error.message;
      state.catalogProjects = [];
      state.catalogSnapshots = {};
      renderContextSelectors();
      renderSystemState();
      return false;
    } finally {
      state.integration.loading = null;
    }
  })();
  return state.integration.loading;
}

function evidenceLabel(item) {
  const source = item?.sourceFile || item?.sourceUri || item?.evidenceType || item?.kind || item?.id || "Okänd källa";
  const start = Number(item?.startLine);
  if (!start) return source;
  const end = Number(item?.endLine);
  return `${source}:${start}${end && end !== start ? `–${end}` : ""}`;
}

function renderReaderPacket(packet) {
  const evidence = Array.isArray(packet?.evidence) ? packet.evidence : [];
  const contradictions = Array.isArray(packet?.contradictions) ? packet.contradictions : [];
  const freshness = packet?.freshness || {};
  const limits = packet?.limits || {};
  $("#reader-output").innerHTML = `
    <article class="reader-answer">
      <div class="reader-badges">
        <span class="status-badge" data-status="${escapeHtml(packet?.answer?.status || "unknown")}">Status: ${escapeHtml(answerStatusLabel(packet?.answer?.status))}</span>
        <span class="status-badge" data-status="${escapeHtml(freshness.status || "unknown")}">Freshness: ${escapeHtml(freshnessLabel(freshness.status))}</span>
        <span class="status-badge" data-status="${contradictions.length ? "contradicted" : "fresh"}">Motsägelser: ${formatNumber(contradictions.length)}</span>
        ${limits.truncated ? `<span class="status-badge" data-status="stale">${formatNumber(limits.omittedItems)} utelämnade</span>` : ""}
      </div>
      <h3>${escapeHtml(packet?.answer?.summary || "Reader gav ingen sammanfattning.")}</h3>
      <section class="reader-section">
        <h3>Källor och evidens</h3>
        ${evidence.length ? `<ul class="reader-source-list">${evidence.map((item) => `
          <li><strong>${escapeHtml(evidenceLabel(item))}</strong><span>${escapeHtml(`${item.role || "context"} · ${item.kind || item.evidenceType || "evidence"}`)}</span></li>
        `).join("")}</ul>` : '<p class="reader-muted">Inga källor returnerades.</p>'}
      </section>
      ${Array.isArray(freshness.reasons) && freshness.reasons.length ? `
        <section class="reader-section"><h3>Freshness</h3><ul>${freshness.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul></section>
      ` : ""}
      ${contradictions.length ? `
        <section class="reader-section"><h3>Motsägelser</h3>${contradictions.map((item) => `<p><strong>${escapeHtml(item.summary)}</strong></p>`).join("")}</section>
      ` : ""}
    </article>
  `;
}

async function readContext() {
  const projectId = $("#reader-project").value;
  const snapshotId = $("#reader-snapshot").value;
  const question = $("#reader-query").value.trim();
  state.context = { projectId, snapshotId, query: question };
  scheduleStatePublish();
  if (!projectId || !question) {
    $("#reader-output").innerHTML = '<div class="reader-error" role="alert"><strong>Välj projekt och skriv en fråga.</strong></div>';
    return;
  }
  $("#reader-output").innerHTML = '<div class="panel-empty"><strong>Läser kontext…</strong><span>Reader hämtar källbelagt underlag.</span></div>';
  try {
    const project = { projectId };
    if (snapshotId) project.snapshotId = snapshotId;
    state.readerPacket = await invokeStudioV1("readerContext", {
      projects: [project],
      question,
    });
    renderReaderPacket(state.readerPacket);
  } catch (error) {
    $("#reader-output").innerHTML = `<div class="reader-error" role="alert"><strong>Reader kunde inte läsa</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

function knowledgeRecordId(record) {
  return record?.id || record?.recordId || "";
}

function renderKnowledgeList() {
  $("#knowledge-count").textContent = formatNumber(state.knowledgeRecords.length);
  $("#knowledge-list").innerHTML = state.knowledgeRecords.length
    ? state.knowledgeRecords.map((record) => `
      <button type="button" data-knowledge-record="${escapeHtml(knowledgeRecordId(record))}">
        <span><strong>${escapeHtml(record.title || knowledgeRecordId(record))}</strong><small>${escapeHtml(`${record.recordType || "record"} · ${record.status || "unknown"}`)}</small></span>
        <span class="relation-badge">${escapeHtml(freshnessLabel(record?.metadata?.knowledgeV1?.freshness?.status || "unknown"))}</span>
      </button>
    `).join("")
    : '<div class="panel-empty"><strong>Ingen länkad kunskap</strong></div>';
}

async function loadKnowledge() {
  if (!(await ensureStudioV1())) return;
  const slotProject = state.projects[state.selectedDetailSlot]?.libraryProjectId;
  const projectId = state.catalogProjects.some((entry) => entry.id === slotProject)
    ? slotProject
    : state.context.projectId;
  if (!projectId) return;
  $("#knowledge-list").innerHTML = '<div class="panel-empty"><strong>Läser Knowledge…</strong></div>';
  const detailId = state.selectedDetail?.id;
  const rawNode = detailId && !String(detailId).startsWith("community:") && !String(detailId).startsWith("file:");
  try {
    const payload = { projectId, limit: 50 };
    const targetPayload = { ...payload, nodeId: detailId };
    if (state.context.snapshotId) targetPayload.snapshotId = state.context.snapshotId;
    state.knowledgeRecords = await invokeStudioV1(
      rawNode ? "knowledgeByTarget" : "knowledgeList",
      rawNode ? targetPayload : payload,
    );
    if (!Array.isArray(state.knowledgeRecords)) state.knowledgeRecords = [];
    renderKnowledgeList();
  } catch (error) {
    $("#knowledge-list").innerHTML = `<div class="reader-error" role="alert"><strong>Knowledge kunde inte läsas</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

function renderKnowledgeDetail(record) {
  const evidence = Array.isArray(record?.evidence) ? record.evidence : [];
  $("#knowledge-detail").innerHTML = `
    <div class="reader-badges">
      <span class="status-badge" data-status="${escapeHtml(record?.status || "unknown")}">Status: ${escapeHtml(record?.status || "unknown")}</span>
      <span class="status-badge" data-status="${escapeHtml(record?.metadata?.knowledgeV1?.freshness?.status || "unknown")}">Freshness: ${escapeHtml(freshnessLabel(record?.metadata?.knowledgeV1?.freshness?.status || "unknown"))}</span>
    </div>
    <h3>${escapeHtml(record?.title || knowledgeRecordId(record))}</h3>
    <p>${escapeHtml(record?.summary || "")}</p>
    ${record?.currentRevision?.bodyMarkdown ? `<pre>${escapeHtml(record.currentRevision.bodyMarkdown)}</pre>` : ""}
    <h3>Evidens</h3>
    ${evidence.length ? `<ul>${evidence.map((item) => `<li>${escapeHtml(evidenceLabel(item))}</li>`).join("")}</ul>` : '<p class="reader-muted">Ingen evidens returnerades.</p>'}
  `;
}

async function loadKnowledgeDetail(recordId) {
  $("#knowledge-detail").innerHTML = '<div class="panel-empty"><strong>Läser post…</strong></div>';
  try {
    renderKnowledgeDetail(await invokeStudioV1("knowledgeGet", { recordId }));
  } catch (error) {
    $("#knowledge-detail").innerHTML = `<div class="reader-error" role="alert"><strong>Posten kunde inte läsas</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

function renderJobs() {
  const statusLabel = {
    queued: "Köad",
    running: "Kör",
    validating: "Validerar",
    committing: "Sparar snapshot",
    completed: "Klar",
    failed: "Fel",
    cancelled: "Avbruten",
  };
  $("#jobs-list").innerHTML = state.jobs.length ? state.jobs.map((job) => {
    const progress = clamp(Number(job.progress) || 0, 0, 1);
    const cancellable = ["queued", "running", "validating"].includes(job.status);
    const retryable = ["failed", "cancelled"].includes(job.status);
    return `
      <article class="job-card ${escapeHtml(job.status)}" data-job-id="${escapeHtml(job.id)}">
        <header><strong>${escapeHtml(job.jobType)}</strong><span class="status-badge" data-status="${escapeHtml(job.status)}">${escapeHtml(statusLabel[job.status] || job.status)}</span></header>
        <p>${escapeHtml(job.message || job.error?.code || "")}</p>
        <progress max="1" value="${progress}">${Math.round(progress * 100)}%</progress>
        <small>${Math.round(progress * 100)}% · ${escapeHtml(job.projectId || "utan projekt")}</small>
        <div class="job-actions">
          ${cancellable ? `<button type="button" data-cancel-job="${escapeHtml(job.id)}">Avbryt jobb</button>` : ""}
          ${retryable ? `<button type="button" data-retry-job="${escapeHtml(job.id)}">Försök igen</button>` : ""}
        </div>
        <details><summary>Förhandsgranskning</summary><p>${escapeHtml(`${job.jobType} · ${job.projectId || "utan projekt"} · ${job.status}`)}</p></details>
      </article>
    `;
  }).join("") : '<div class="panel-empty"><strong>Inga jobb</strong><span>Den befintliga kön är tom.</span></div>';
}

async function loadJobs() {
  if (!(await ensureStudioV1())) {
    state.jobs = [];
    renderJobs();
    return;
  }
  $("#jobs-list").innerHTML = '<div class="panel-empty"><strong>Läser jobb…</strong></div>';
  try {
    state.jobs = await invokeStudioV1("jobs");
    if (!Array.isArray(state.jobs)) state.jobs = [];
    renderJobs();
  } catch (error) {
    $("#jobs-list").innerHTML = `<div class="reader-error" role="alert"><strong>Jobben kunde inte läsas</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

function timeLabel(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function playbackAsOf() {
  if (state.playback.mode === "live" || !state.activity.length) return Date.now();
  const event = state.activity[clamp(state.playback.cursor, 0, state.activity.length - 1)];
  return Date.parse(event?.timestamp || "") + state.playback.offset;
}

function playbackEvents() {
  if (state.playback.mode === "live") return state.activity;
  return state.activity.slice(state.playback.passStart, state.playback.cursor + 1);
}

function syncGraphActivity() {
  graph.setActivity(window.ZivarActivity.expandActivityEvents(playbackEvents()), {
    asOf: playbackAsOf(),
    live: state.playback.mode === "live",
    halfLife: state.playback.halfLife,
    agents: [...state.playback.agents],
  });
}

function renderActivity() {
  for (const event of state.activity) {
    const agent = event.agent || "Agent";
    if (!state.playback.knownAgents.has(agent)) {
      state.playback.knownAgents.add(agent);
      state.playback.agents.add(agent);
    }
  }
  if (state.playback.mode === "live") state.playback.cursor = Math.max(0, state.activity.length - 1);
  else state.playback.cursor = clamp(state.playback.cursor, 0, Math.max(0, state.activity.length - 1));
  const asOf = playbackAsOf();
  const visible = playbackEvents().filter((event) => state.playback.agents.has(event.agent || "Agent"));
  const events = visible.slice(-100).reverse();
  const agents = new Map();
  for (const event of state.activity) agents.set(event.agent || "Agent", (agents.get(event.agent || "Agent") || 0) + 1);
  $("#agent-filters").innerHTML = [...agents.keys()].map((agent) => `
    <label title="${escapeHtml(agent)}">
      <input type="checkbox" data-agent-filter="${escapeHtml(agent)}" ${state.playback.agents.has(agent) ? "checked" : ""} />
      <span>${escapeHtml(agent)}</span>
    </label>
  `).join("");
  const latestTargets = new Map();
  for (const event of visible) {
    const target = window.ZivarActivity.activityTargets(event).at(-1);
    const label = target?.label || target?.sourceFile || event.label || event.file;
    const projectId = event.project || event.projectId || "";
    if (label) {
      latestTargets.set(event.agent || "Agent", {
        label,
        project: state.projects[projectId]?.name
          || state.catalogProjects.find((entry) => entry.id === projectId)?.name
          || projectId,
      });
    }
  }
  $("#agent-summary").innerHTML = [...agents.keys()]
    .map((agent) => {
      const target = latestTargets.get(agent);
      const context = target ? [target.project, target.label].filter(Boolean).map(escapeHtml).join(" · ") : "";
      return `<span>${escapeHtml(agent)}${context ? ` · ${context}` : ""}</span>`;
    })
    .join("");
  $("#agent-events").innerHTML = events.slice(0, 60).map((event) => {
    const targets = window.ZivarActivity.activityTargets(event);
    const mcpCall = event.mcp_call || event.mcpCall || event.mcp || event.tool || event.action || "";
    const relations = Array.isArray(event.relations)
      ? event.relations
      : event.relation ? [event.relation] : [];
    const projectId = event.project || event.projectId || "";
    const project = state.projects[projectId]?.name
      || state.catalogProjects.find((entry) => entry.id === projectId)?.name
      || projectId;
    const graphName = event.graph || event.snapshot || event.snapshotId || "";
    const source = event.source || event.file || event.target?.sourceFile || event.target?.source_file || "";
    const metadata = [
      mcpCall ? `MCP: ${mcpCall}` : "",
      project ? `Projekt: ${project}` : "",
      graphName ? `Graf: ${graphName}` : "",
      targets.length ? `Noder: ${targets.map((target) => target.label || target.id || target.sourceFile).filter(Boolean).join(", ")}` : "",
      relations.length ? `Relationer: ${relations.join(", ")}` : "",
      source ? `Källa: ${source}` : "",
      event.duration_ms ? `${formatNumber(event.duration_ms)} ms` : "",
      event.tokens_in || event.tokens_out ? `${formatNumber((event.tokens_in || 0) + (event.tokens_out || 0))} tokens` : "",
    ].filter(Boolean).join(" · ");
    return `
      <article class="timeline-event ${event.status === "error" ? "error" : ""}">
        <header><strong>${escapeHtml(event.agent || "Agent")}</strong><time>${escapeHtml(timeLabel(event.timestamp))}</time></header>
        <p>${escapeHtml(event.summary || event.action || event.kind)}</p>
        <small>${escapeHtml(metadata)}</small>
      </article>
    `;
  }).join("");
  const latestFocus = new Map();
  for (const event of visible) {
    if (event.kind === "focus") latestFocus.set(event.agent || "Agent", event);
  }
  const active = [...latestFocus.values()].some((event) => window.ZivarActivity.isLeaseActive(event, asOf));
  $("#agent-live").textContent = state.playback.mode === "live" ? active ? "Aktiv" : "Väntar" : "Uppspelning";
  $("#agent-live").classList.toggle("active", active || state.playback.mode === "playing");
  $("#activity-live").classList.toggle("active", state.playback.mode === "live");
  $("#activity-play").classList.toggle("active", state.playback.mode === "playing");
  $("#activity-pause").classList.toggle("active", state.playback.mode === "paused");
  const passStart = state.playback.mode === "live" ? 0 : state.playback.passStart;
  const passLength = Math.max(0, state.activity.length - passStart);
  $("#activity-timeline").min = String(passStart);
  $("#activity-timeline").max = String(Math.max(0, state.activity.length - 1));
  $("#activity-timeline").value = String(state.playback.cursor);
  $("#activity-time").value = state.playback.mode === "live"
    ? "Live"
    : `${timeLabel(state.activity[state.playback.cursor]?.timestamp)} · ${state.playback.cursor - passStart + 1}/${passLength}`;
  syncGraphActivity();
}

function setPlaybackMode(mode) {
  if (mode === "playing") {
    const pass = window.ZivarActivity.latestActivityPass(state.activity);
    state.playback.passStart = pass.start;
    state.playback.cursor = pass.start;
    state.playback.agents = new Set(pass.events.map((event) => event.agent || "Agent"));
    state.playback.mode = "playing";
  } else {
    state.playback.mode = mode;
  }
  state.playback.lastTick = performance.now();
  state.playback.accumulator = 0;
  if (mode === "live") {
    state.playback.cursor = Math.max(0, state.activity.length - 1);
    state.playback.offset = 0;
  } else if (mode === "playing") {
    state.playback.offset = 0;
  }
  renderActivity();
}

function advancePlayback(now = performance.now()) {
  const delta = now - state.playback.lastTick;
  state.playback.lastTick = now;
  if (state.playback.mode !== "playing" || !state.activity.length) return;
  state.playback.accumulator += delta * state.playback.speed;
  state.playback.offset += delta * state.playback.speed;
  let changed = false;
  while (state.playback.accumulator >= 1800 && state.playback.cursor < state.activity.length - 1) {
    state.playback.accumulator -= 1800;
    state.playback.offset = 0;
    state.playback.cursor += 1;
    changed = true;
  }
  if (state.playback.cursor >= state.activity.length - 1 && state.playback.accumulator >= 1800) {
    state.playback.mode = "paused";
    changed = true;
  }
  if (changed) renderActivity();
  else syncGraphActivity();
}

async function pollActivity() {
  if (state.activityPolling) return;
  state.activityPolling = true;
  try {
    let changed = false;
    let localAvailable = true;
    try {
      const events = await invoke("getActivity", state.lastActivityId);
      if (events.length) {
        state.lastActivityId = String(events.at(-1).id);
        state.activity.push(...events);
        changed = true;
      }
    } catch {
      localAvailable = false;
    }
    const pollV1 = state.integration.status !== "loading" && Date.now() >= state.nextV1ActivityPoll;
    if (pollV1) {
      try {
        const events = await invokeStudioV1("activity", { after: state.lastV1ActivityId });
        if (Array.isArray(events) && events.length) {
          state.lastV1ActivityId = String(events.at(-1).id);
          const existing = new Set(state.activity.map((event) => String(event.id)));
          const additions = events.filter((event) => !existing.has(String(event.id)));
          if (additions.length) {
            state.activity.push(...additions);
            changed = true;
          }
        }
      } catch {
        if (!localAvailable) {
          $("#agent-live").textContent = "Frånkopplad";
          $("#agent-live").classList.remove("active");
        }
      } finally {
        state.nextV1ActivityPoll = Date.now() + (state.integration.status === "online" ? 900 : 5000);
      }
    } else if (!localAvailable) {
      $("#agent-live").textContent = "Frånkopplad";
      $("#agent-live").classList.remove("active");
    }
    if (changed) {
      state.activity.sort((left, right) => Date.parse(left.timestamp || "") - Date.parse(right.timestamp || ""));
      state.activity = state.activity.slice(-1000);
      renderActivity();
    }
  } finally {
    state.activityPolling = false;
  }
}

function openDetailTab(name) {
  if (!["inspector", "reader", "knowledge", "audit", "compare", "agents", "jobs"].includes(name)) return;
  state.activeDetailTab = name;
  $$("[data-detail-tab]").forEach((button) => {
    const active = button.dataset.detailTab === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $$(".detail-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${name}`));
  if (name === "reader") void ensureStudioV1();
  if (name === "knowledge") void loadKnowledge();
  if (name === "jobs") void loadJobs();
  scheduleStatePublish();
}

function scheduleStatePublish() {
  if (!state.bootstrapped) return;
  clearTimeout(state.stateTimer);
  state.stateTimer = setTimeout(() => {
    invoke("updateState", {
      view: {
        workspace: state.workspace,
        activeSlot: state.activeSlot,
        stacks: state.stacks,
      },
      filters: state.filters,
      options: state.options,
      selection: { ...state.selected, labels: state.selectedLabels },
      ui: {
        detailTab: state.activeDetailTab,
        searchQuery: state.searchQuery,
        mobilePanel: state.mobilePanel,
        focusMode: document.body.classList.contains("focus-mode"),
        inspected: state.inspected,
      },
      context: state.context,
      playback: {
        mode: state.playback.mode,
        cursor: state.playback.cursor,
        speed: state.playback.speed,
        halfLife: state.playback.halfLife === Infinity ? "session" : state.playback.halfLife,
        agents: [...state.playback.agents],
      },
      camera: graph.cameraState(),
    }).catch(() => {});
  }, 350);
}

async function projectAction(action, slot, ...args) {
  try {
    const previousWorkspace = state.workspace;
    setRuntime("Arbetar", false);
    const project = await invoke(action, slot, ...args);
    if (!project) {
      setRuntime("Klar", true);
      return;
    }
    state.projects[slot] = project;
    state.branchImpact = null;
    state.stacks[slot] = [{ mode: "overview" }];
    state.activeSlot = slot;
    state.workspace = slot;
    renderProjects();
    renderRelationOptions();
    await refreshComparison();
    setWorkspace(
      ["both", "diff"].includes(previousWorkspace) && state.projects[slot === "A" ? "B" : "A"]
        ? "both"
        : slot,
    );
    setRuntime("Klar", true);
  } catch (error) {
    renderProjects();
    setRuntime(error.message, false, true);
    toast(error.message, true);
  }
}

function setProjectVisible(slot, visible) {
  const other = slot === "A" ? "B" : "A";
  const otherVisible = state.workspace === other || ["both", "diff"].includes(state.workspace);
  if (visible) {
    setWorkspace(otherVisible && state.projects[other] ? "both" : slot);
  } else if (otherVisible && state.projects[other]) {
    setWorkspace(other);
  } else {
    renderProjects();
  }
}

function setRuntime(message, ready = false, error = false) {
  $("#runtime-text").textContent = message;
  $("#status-dot").classList.toggle("ready", ready);
  $("#status-dot").classList.toggle("error", error);
}

async function performSearch(query, autoOpen = false) {
  const trimmed = String(query || "").trim();
  const results = $("#search-results");
  if (!trimmed || !state.projects[state.activeSlot]) {
    results.hidden = true;
    return;
  }
  try {
    const comparisonMode = ["both", "diff"].includes(state.workspace);
    const matches = comparisonMode
      ? (await Promise.all(["A", "B"]
        .filter((slot) => state.projects[slot])
        .map(async (slot) => (await invoke("search", slot, trimmed)).map((match) => ({
          ...match,
          searchSlot: slot,
        }))))).flat().sort((left, right) => (right.score || 0) - (left.score || 0)).slice(0, 40)
      : await invoke("search", state.activeSlot, trimmed);
    if (autoOpen && matches[0]) {
      await openSearchMatch(matches[0]);
      results.hidden = true;
      return;
    }
    results.innerHTML = matches.map((match) => `
      <button data-search-id="${escapeHtml(match.id)}" ${match.searchSlot ? `data-search-slot="${match.searchSlot}"` : ""}>
        <strong>${escapeHtml(match.label)}</strong>
        <small>${match.searchSlot ? `${match.searchSlot} · ` : ""}${escapeHtml(match.sourceFile || match.communityName || match.kind)}</small>
      </button>
    `).join("");
    results.hidden = !matches.length;
  } catch (error) {
    toast(error.message, true);
  }
}

async function openSearchMatch(match) {
  const slot = match.searchSlot === "B" ? "B" : match.searchSlot === "A" ? "A" : state.activeSlot;
  if (["both", "diff"].includes(state.workspace)) {
    state.workspace = slot;
    state.activeSlot = slot;
    syncWorkspaceControls();
    renderProjects();
    renderRelationOptions();
  }
  state.stacks[slot].push({ mode: "neighborhood", key: match.id, depth: 1 });
  await loadCurrentView();
  graph.focusTarget({
    id: match.id,
    sourceFile: match.sourceFile,
    community: match.community,
  }, slot);
  await selectNode([match.id]);
}

function setMobilePanel(panel = "", returnFocus = null) {
  const closing = !panel && state.mobilePanel;
  if (panel && returnFocus) panelReturnFocus = returnFocus;
  state.mobilePanel = panel;
  for (const name of ["filters", "search", "info", "agents"]) {
    document.body.classList.toggle(`mobile-panel-${name}`, panel === name);
  }
  if (panel === "info") openDetailTab("inspector");
  if (panel === "agents") openDetailTab("agents");
  const overlay = window.innerWidth <= 1179;
  $("#control-rail").inert = overlay && panel !== "filters";
  $("#detail-rail").inert = overlay && !["info", "agents"].includes(panel);
  $("#mobile-scrim").hidden = !panel || panel === "agents";
  $$("[data-mobile-panel]").forEach((button) => button.classList.toggle("active", button.dataset.mobilePanel === panel));
  if (panel === "search") setTimeout(() => $("#global-search").focus(), 30);
  if (closing && panelReturnFocus) {
    const target = panelReturnFocus;
    panelReturnFocus = null;
    requestAnimationFrame(() => target.focus());
  }
  scheduleStatePublish();
  setTimeout(() => graph.resize(), 180);
}

function syncResponsive() {
  if (window.innerWidth > 1179) {
    setMobilePanel("", null);
    $("#control-rail").inert = false;
    $("#detail-rail").inert = false;
  } else {
    setMobilePanel(state.mobilePanel);
  }
  if (window.innerWidth <= 720 && !state.mobileInitialized) {
    state.mobileInitialized = true;
    state.options.minimap = false;
    graph.setOptions(state.options);
  }
  document.body.classList.toggle("mobile-minimap-on", window.innerWidth <= 720 && state.options.minimap);
}

function bindControls() {
  graph.onSelect = selectNode;
  graph.onDoubleClick = drillNode;
  graph.onCameraChange = scheduleStatePublish;

  $$("[data-workspace]").forEach((button) => button.addEventListener("click", () => setWorkspace(button.dataset.workspace)));
  $$("[data-project-button]").forEach((button) => button.addEventListener("click", () => setWorkspace(button.dataset.projectButton)));
  $$("[data-library-project]").forEach((select) => select.addEventListener("change", () => {
    if (select.value) projectAction("loadLibraryProject", select.dataset.libraryProject, select.value);
  }));
  $$("[data-project-visible]").forEach((checkbox) => checkbox.addEventListener("change", () => {
    setProjectVisible(checkbox.dataset.projectVisible, checkbox.checked);
  }));
  $$("[data-pick-project]").forEach((button) => button.addEventListener("click", () => projectAction("pickProject", button.dataset.pickProject)));
  $$("[data-pick-data]").forEach((button) => button.addEventListener("click", () => projectAction("pickDataFile", button.dataset.pickData)));
  $$("[data-refresh-project]").forEach((button) => button.addEventListener("click", () => projectAction("refreshProject", button.dataset.refreshProject)));

  $("#relation-filter").addEventListener("change", (event) => {
    state.filters.relation = event.target.value;
    loadCurrentView(false);
  });
  $("#confidence-filter").addEventListener("change", (event) => {
    state.filters.confidence = event.target.value;
    loadCurrentView(false);
  });
  $("#weight-filter").addEventListener("change", (event) => {
    state.filters.minWeight = Number(event.target.value);
    $("#weight-filter-value").textContent = state.filters.minWeight ? String(state.filters.minWeight) : "Alla";
    loadCurrentView(false);
  });

  for (const [selector, key, property, relayout, numeric] of OPTION_BINDINGS) {
    $(selector).addEventListener("change", (event) => {
      state.options[key] = numeric ? Number(event.target[property]) : event.target[property];
      if (key === "showIsolates" || key === "hubsOnly") {
        graph.setOptions(state.options);
        graph.setData(state.currentView || { nodes: [], edges: [] }, { resetCamera: false });
        renderViewHeader({ ...(state.currentView || {}), nodes: graph.nodes, edges: graph.edges });
      }
      else graph.setOptions(state.options, relayout);
      syncOptionOutputs();
      renderLegend(state.currentView);
      scheduleStatePublish();
    });
  }

  $("#back-view").addEventListener("click", () => {
    const stack = state.stacks[state.activeSlot];
    if (stack.length > 1) stack.pop();
    loadCurrentView();
  });
  $("#zoom-in").addEventListener("click", () => graph.zoomBy(1.25));
  $("#zoom-out").addEventListener("click", () => graph.zoomBy(0.8));
  $("#fit-map").addEventListener("click", () => graph.fit());
  $("#rotate-map").addEventListener("click", () => graph.rotate());
  $("#orbit-map").addEventListener("click", (event) => {
    graph.autoOrbit = !graph.autoOrbit;
    event.currentTarget.classList.toggle("active", graph.autoOrbit);
    if (!graph.autoOrbit) scheduleStatePublish();
  });
  $("#mobile-tools-toggle").addEventListener("click", (event) => {
    document.body.classList.toggle("mobile-tools-open");
    event.currentTarget.classList.toggle("active", document.body.classList.contains("mobile-tools-open"));
  });
  $("#focus-toggle").addEventListener("click", (event) => {
    document.body.classList.toggle("focus-mode");
    event.currentTarget.classList.toggle("active", document.body.classList.contains("focus-mode"));
    state.focusMode = document.body.classList.contains("focus-mode");
    setTimeout(() => graph.resize(), 60);
    scheduleStatePublish();
  });
  $("#export-image").addEventListener("click", async () => {
    try {
      const path = await invoke("saveImage", graph.canvas.toDataURL("image/png"));
      if (path) toast(`Sparad: ${path}`);
    } catch (error) {
      toast(error.message, true);
    }
  });
  $("#reset-filters").addEventListener("click", () => {
    state.filters = { relation: "ALL", confidence: "ALL", minWeight: 0 };
    state.options.showIsolates = DEFAULT_OPTIONS.showIsolates;
    state.options.hubsOnly = DEFAULT_OPTIONS.hubsOnly;
    $("#relation-filter").value = "ALL";
    $("#confidence-filter").value = "ALL";
    $("#weight-filter").value = "0";
    $("#weight-filter-value").textContent = "Alla";
    $("#toggle-isolates").checked = state.options.showIsolates;
    $("#toggle-hubs-only").checked = state.options.hubsOnly;
    graph.setOptions(state.options);
    loadCurrentView();
  });
  $("#reset-settings").addEventListener("click", () => {
    state.options = { ...DEFAULT_OPTIONS };
    for (const [selector, key, property] of OPTION_BINDINGS) $(selector)[property] = state.options[key];
    graph.setOptions(state.options);
    graph.setData(state.currentView || { nodes: [], edges: [] }, { resetCamera: false });
    renderViewHeader({ ...(state.currentView || {}), nodes: graph.nodes, edges: graph.edges });
    syncOptionOutputs();
    renderLegend(state.currentView);
    scheduleStatePublish();
  });
  syncOptionOutputs();

  $$("[data-detail-tab]").forEach((button) => {
    button.addEventListener("click", () => openDetailTab(button.dataset.detailTab));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = $$("[data-detail-tab]");
      const current = tabs.indexOf(event.currentTarget);
      const next = event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[next].focus();
      openDetailTab(tabs[next].dataset.detailTab);
    });
  });
  $$("[data-mobile-panel]").forEach((button) => button.addEventListener("click", () => {
    setMobilePanel(
      state.mobilePanel === button.dataset.mobilePanel ? "" : button.dataset.mobilePanel,
      button,
    );
  }));
  $$("[data-close-panel]").forEach((button) => button.addEventListener("click", () => setMobilePanel("")));
  $("#mobile-scrim").addEventListener("click", () => setMobilePanel(""));
  $("#mobile-selection").addEventListener("click", () => setMobilePanel("info"));
  $("#drill-node").addEventListener("click", () => drillNode());
  $("#use-as-a").addEventListener("click", () => {
    if (!state.selectedDetail) return;
    state.selected.A = state.selectedDetail.id;
    state.selectedLabels.A = state.selectedDetail.label;
    renderSimulationSelection();
    openDetailTab("compare");
  });
  $("#use-as-b").addEventListener("click", () => {
    if (!state.selectedDetail) return;
    state.selected.B = state.selectedDetail.id;
    state.selectedLabels.B = state.selectedDetail.label;
    renderSimulationSelection();
    openDetailTab("compare");
  });
  $("#run-simulation").addEventListener("click", runSimulation);

  $("#neighbor-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-neighbor-id]");
    if (!button?.dataset.neighborId) return;
    pushView({ mode: "neighborhood", key: button.dataset.neighborId, depth: 1 });
  });
  $("#hub-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-hub-id]");
    if (!button) return;
    if (["both", "diff"].includes(state.workspace)) setWorkspace(state.activeSlot);
    pushView({ mode: "neighborhood", key: button.dataset.hubId, depth: 1 });
  });
  $("#match-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-match-index]");
    if (!button || !state.comparison) return;
    const match = state.comparison.exactMatches[Number(button.dataset.matchIndex)];
    if (!match) return;
    state.selected.A = match.aId;
    state.selected.B = match.bId;
    state.selectedLabels.A = `${match.label} · ${match.aFile}`;
    state.selectedLabels.B = `${match.label} · ${match.bFile}`;
    renderSimulationSelection();
  });

  $("#global-search").addEventListener("input", (event) => {
    state.searchQuery = event.target.value;
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => performSearch(event.target.value), 160);
    scheduleStatePublish();
  });
  $("#global-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      performSearch(event.currentTarget.value, true);
      $("#search-results").hidden = true;
    }
  });
  $("#search-results").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-search-id]");
    if (!button) return;
    $("#search-results").hidden = true;
    await openSearchMatch({
      id: button.dataset.searchId,
      searchSlot: button.dataset.searchSlot || state.activeSlot,
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".global-search")) $("#search-results").hidden = true;
  });
  document.addEventListener("keydown", (event) => {
    if (
      (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName))
      || (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey))
    ) {
      event.preventDefault();
      if (window.innerWidth <= 720) setMobilePanel("search");
      $("#global-search").focus();
    }
    if (event.key === "Escape" && !$("#search-results").hidden) {
      $("#search-results").hidden = true;
      return;
    }
    if (event.key === "Escape" && state.mobilePanel) {
      setMobilePanel("");
      return;
    }
    if (event.key === "Escape" && document.body.classList.contains("focus-mode")) {
      document.body.classList.remove("focus-mode");
      $("#focus-toggle").classList.remove("active");
      state.focusMode = false;
      setTimeout(() => graph.resize(), 60);
      scheduleStatePublish();
      return;
    }
    if (event.key === "Escape" && state.selectedDetail) {
      graph.clearSelection();
      void selectNode([]);
    }
  });
  window.addEventListener("resize", syncResponsive);

  $("#activity-live").addEventListener("click", () => {
    setPlaybackMode("live");
    scheduleStatePublish();
  });
  $("#activity-play").addEventListener("click", () => {
    setPlaybackMode("playing");
    scheduleStatePublish();
  });
  $("#activity-pause").addEventListener("click", () => {
    setPlaybackMode("paused");
    scheduleStatePublish();
  });
  $("#activity-speed").addEventListener("change", (event) => {
    state.playback.speed = Number(event.target.value) || 1;
    scheduleStatePublish();
  });
  $("#activity-timeline").addEventListener("input", (event) => {
    state.playback.mode = "paused";
    state.playback.cursor = Number(event.target.value) || 0;
    state.playback.offset = 0;
    renderActivity();
    scheduleStatePublish();
  });
  $("#heat-decay").addEventListener("change", (event) => {
    state.playback.halfLife = event.target.value === "session" ? Infinity : Number(event.target.value);
    renderActivity();
    scheduleStatePublish();
  });
  $("#agent-filters").addEventListener("change", (event) => {
    const input = event.target.closest("[data-agent-filter]");
    if (!input) return;
    if (input.checked) state.playback.agents.add(input.dataset.agentFilter);
    else state.playback.agents.delete(input.dataset.agentFilter);
    renderActivity();
    scheduleStatePublish();
  });

  $("#reader-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void readContext();
  });
  $("#reader-project").addEventListener("change", async (event) => {
    state.context.projectId = event.target.value;
    state.context.snapshotId = "";
    await loadContextSnapshots(state.context.projectId);
    scheduleStatePublish();
  });
  $("#reader-snapshot").addEventListener("change", (event) => {
    state.context.snapshotId = event.target.value;
    renderContextSelectors();
    renderInspector();
    scheduleStatePublish();
  });
  $("#reader-query").addEventListener("input", (event) => {
    state.context.query = event.target.value;
    scheduleStatePublish();
  });
  $("#knowledge-project").addEventListener("change", async (event) => {
    state.context.projectId = event.target.value;
    state.context.snapshotId = "";
    await loadContextSnapshots(state.context.projectId);
    await loadKnowledge();
    scheduleStatePublish();
  });
  $("#knowledge-refresh").addEventListener("click", () => loadKnowledge());
  $("#knowledge-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-knowledge-record]");
    if (button) void loadKnowledgeDetail(button.dataset.knowledgeRecord);
  });
  $("#jobs-refresh").addEventListener("click", () => loadJobs());
  $("#jobs-list").addEventListener("click", async (event) => {
    const cancel = event.target.closest("[data-cancel-job]");
    const retry = event.target.closest("[data-retry-job]");
    if (!cancel && !retry) return;
    const button = cancel || retry;
    button.disabled = true;
    try {
      await invokeStudioV1(cancel ? "cancelJob" : "retryJob", {
        jobId: cancel ? cancel.dataset.cancelJob : retry.dataset.retryJob,
      });
      await loadJobs();
    } catch (error) {
      toast(error.message, true);
      button.disabled = false;
    }
  });

  const githubDialog = $("#github-dialog");
  $("#github-open").addEventListener("click", () => githubDialog.showModal());
  githubDialog.addEventListener("close", () => $("#github-open").focus());
  $("#github-load").addEventListener("click", async (event) => {
    event.preventDefault();
    const url = $("#github-url").value;
    const slot = githubDialog.querySelector('[name="github-slot"]:checked').value;
    if (!url) return;
    githubDialog.close();
    try {
      setRuntime("Hämtar GitHub", false);
      const project = await invoke("loadGithub", slot, url);
      state.projects[slot] = project;
      state.branchImpact = null;
      state.stacks[slot] = [{ mode: "overview" }];
      await refreshComparison();
      setWorkspace(slot);
      setRuntime("Klar", true);
    } catch (error) {
      setRuntime(error.message, false, true);
      toast(error.message, true);
    }
  });
  const loadBranchResult = async (loader) => {
    try {
      setRuntime("Bygger Branch Lens", false);
      const result = await loader();
      if (!result) {
        setRuntime("Klar", true);
        return;
      }
      state.projects = result.projects;
      state.branchImpact = result.impact;
      state.stacks = { A: [{ mode: "overview" }], B: [{ mode: "overview" }] };
      state.activeSlot = "B";
      state.workspace = "diff";
      renderProjects();
      renderRelationOptions();
      await refreshComparison();
      renderBranchImpact();
      setWorkspace("diff");
      openDetailTab("compare");
      setRuntime("Branch Lens klar", true);
    } catch (error) {
      setRuntime(error.message, false, true);
      toast(error.message, true);
    }
  };
  $("#github-branch-load").addEventListener("click", async (event) => {
    event.preventDefault();
    const url = $("#github-url").value;
    if (!url) return;
    const branch = $("#github-branch").value;
    const base = $("#github-base").value;
    githubDialog.close();
    await loadBranchResult(() => invoke("loadGithubBranch", url, branch, base));
  });
  $("#branch-local").addEventListener("click", async () => {
    const branch = $("#github-branch").value;
    const base = $("#github-base").value;
    githubDialog.close();
    await loadBranchResult(() => invoke("pickBranchRepo", branch, base));
  });

  api.onProgress((payload) => {
    setRuntime(payload.message || payload.phase, payload.phase === "ready", payload.phase === "error");
  });
}

async function bootstrap() {
  bindControls();
  setRuntime("Läser grafer", false);
  try {
    const data = await invoke("bootstrap");
    document.body.dataset.runtime = data.runtime || runtime;
    state.projects = data.projects || { A: null, B: null };
    state.libraryProjects = data.libraryProjects || [];
    state.branchImpact = data.branchImpact || null;
    state.activity = data.activity || [];
    state.lastActivityId = String(state.activity.at(-1)?.id || "");
    restoreSavedState(data.savedState);
    document.body.classList.toggle("focus-mode", state.focusMode);
    $("#focus-toggle").classList.toggle("active", state.focusMode);
    renderProjects();
    renderRelationOptions();
    syncControlsFromState();
    syncWorkspaceControls();
    renderActivity();
    renderSimulationSelection();
    await refreshComparison();
    await loadCurrentView();
    await restoreInspectedSelection();
    graph.restoreCamera(data.savedState?.camera);
    state.bootstrapped = true;
    openDetailTab(state.activeDetailTab);
    scheduleStatePublish();
    setRuntime("Klar", true);
    setInterval(pollActivity, 900);
    setInterval(() => advancePlayback(), 100);
    syncResponsive();
    void ensureStudioV1();
  } catch (error) {
    setRuntime(error.message, false, true);
    $("#empty-state").hidden = false;
    toast(error.message, true);
  }
}

bootstrap();
