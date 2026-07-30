import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

const COLORS = [
  "#5f96e8",
  "#ff9c42",
  "#ff6b70",
  "#79c7c5",
  "#69b45b",
  "#f2cf4a",
  "#b984b7",
  "#ff9bad",
  "#ad8b73",
  "#c4c0bc",
];

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function hash(value) {
  let result = 2166136261;
  for (const character of String(value)) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function colorForNode(node, data, options = {}, maxDegree = 1) {
  if (data.branchLens || data.diffLens) {
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
  if (options.color === "project") {
    const base = new THREE.Color(node.project === "B" ? "#ff716b" : "#2fd0df");
    const variation = ((hash(node.community ?? node.id) % 17) - 8) / 100;
    base.offsetHSL(variation * 0.2, 0, variation);
    return `#${base.getHexString()}`;
  }
  if (options.color === "risk") {
    const ratio = Number(node.degree || node.rawCount || 0) / Math.max(1, maxDegree);
    return ratio >= 0.35 ? "#ff6b70" : ratio >= 0.12 ? "#f2cf4a" : "#48d28b";
  }
  if (options.color === "kind") {
    const kind = String(node.kind || node.type || "").toLowerCase();
    if (kind.includes("community")) return "#f2cf4a";
    if (kind.includes("file")) return "#48d28b";
    if (kind.includes("function") || kind.includes("method")) return "#2fd0df";
    if (kind.includes("table") || kind.includes("model")) return "#5f96e8";
    return COLORS[hash(kind || node.id) % COLORS.length];
  }
  return COLORS[Math.abs(Number(node.community) || hash(node.cluster || node.kind || node.id)) % COLORS.length];
}

function geometryForShape(shape) {
  if (shape === "diamond") return new THREE.OctahedronGeometry(1, 0);
  if (shape === "square") return new THREE.BoxGeometry(1.55, 1.55, 1.55);
  if (shape === "hexagon") return new THREE.CylinderGeometry(1, 1, 1.35, 6);
  return new THREE.SphereGeometry(1, 10, 8);
}

function makeTextSprite(text, color = "#dce6ee") {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = "500 24px system-ui";
  const width = Math.min(520, Math.ceil(context.measureText(text).width) + 24);
  canvas.width = width;
  canvas.height = 42;
  context.font = "500 24px system-ui";
  context.fillStyle = "rgba(7,11,16,0.82)";
  context.fillRect(0, 0, width, 42);
  context.fillStyle = color;
  context.fillText(text, 12, 29);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }));
  sprite.scale.set(width / 520, 0.08, 1);
  return sprite;
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(48, 48, 2, 48, 48, 46);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.2, "rgba(255,255,255,0.72)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.18)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function disposeObject(object, keepGeometry = null, keepMaterial = null) {
  const keptMaterials = new Set(Array.isArray(keepMaterial) ? keepMaterial : [keepMaterial]);
  object.traverse((child) => {
    if (child.geometry && child.geometry !== keepGeometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (keptMaterials.has(material)) continue;
        material.map?.dispose();
        material.dispose();
      }
    }
  });
}

export class BrainGraph3D {
  constructor(canvas, minimap) {
    this.canvas = canvas;
    this.minimap = minimap;
    this.miniContext = minimap.getContext("2d");
    this.data = { nodes: [], edges: [] };
    this.nodes = [];
    this.edges = [];
    this.nodeById = new Map();
    this.nodeMeshes = [];
    this.nodeSizes = new Map();
    this.positions = new Map();
    this.selected = new Set();
    this.hovered = null;
    this.options = {
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
    this.maxDegree = 1;
    this.hubThreshold = Infinity;
    this.activity = [];
    this.activityAsOf = Date.now();
    this.activityLive = true;
    this.activityHalfLife = 120_000;
    this.activityAgents = null;
    this.activityFocus = false;
    this.activityCache = null;
    this.autoOrbit = false;
    this.tool = "select";
    this.onSelect = null;
    this.onDoubleClick = null;
    this.onCameraChange = null;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.lastPointer = null;
    this.lastActivityFrame = 0;
    this.lastFlowFrame = 0;
    this.lastFrame = performance.now();
    this.width = 1;
    this.height = 1;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x070b10, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070b10, 0.035);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
    this.camera.position.set(0, 0.15, 6);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 18;
    this.controls.rotateSpeed = 0.62;
    this.controls.zoomSpeed = 0.75;
    this.controls.target.set(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xd8f7ff, 0x17121c, 1.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(2.5, 3.2, 4);
    this.scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xff9b7c, 1.2);
    fillLight.position.set(-3, -1.5, -2);
    this.scene.add(fillLight);
    this.gridHelper = new THREE.GridHelper(8, 32, 0x31515b, 0x17242b);
    this.gridHelper.position.y = -1.35;
    this.gridHelper.material.transparent = true;
    this.gridHelper.material.opacity = 0.25;
    this.scene.add(this.gridHelper);

    this.root = new THREE.Group();
    this.graphGroup = new THREE.Group();
    this.activityGroup = new THREE.Group();
    this.pathGroup = new THREE.Group();
    this.root.add(this.graphGroup, this.activityGroup, this.pathGroup);
    this.scene.add(this.root);

    this.nodeGeometry = geometryForShape(this.options.shape);
    this.activityGeometry = new THREE.SphereGeometry(1, 8, 6);
    this.heatMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.coreMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.edgeMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.12,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    this.inferredEdgeMaterial = new THREE.LineDashedMaterial({
      vertexColors: true,
      dashSize: 0.035,
      gapSize: 0.025,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });
    this.glowTexture = makeGlowTexture();
    this.glowMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.heatMesh = this.makeActivityMesh(300, this.heatMaterial);
    this.coreMesh = this.makeActivityMesh(24, this.coreMaterial);
    this.electronMesh = this.makeActivityMesh(96, this.coreMaterial);
    this.particleMesh = this.makeActivityMesh(64, this.coreMaterial);
    this.flowMesh = this.makeActivityMesh(64, this.coreMaterial);
    this.activityGroup.add(this.heatMesh, this.coreMesh, this.electronMesh, this.particleMesh, this.flowMesh);
    this.selection = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.72,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.selection.visible = false;
    this.selectionLinks = null;
    this.selectionPoints = null;
    this.activityGroup.add(this.selection);
    this.activeGlow = new THREE.Sprite(this.glowMaterial);
    this.activeGlow.visible = false;
    this.activityGroup.add(this.activeGlow);

    this.label = document.createElement("div");
    this.label.className = "graph-3d-label";
    this.label.hidden = true;
    this.canvas.parentElement.append(this.label);

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.installEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
    this.resize();
    this.setOptions(this.options);
    requestAnimationFrame((time) => this.animate(time));
  }

  makeActivityMesh(capacity, material) {
    const mesh = new THREE.InstancedMesh(this.activityGeometry, material, capacity);
    mesh.count = 0;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    return mesh;
  }

  resize() {
    const rectangle = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rectangle.width);
    this.height = Math.max(1, rectangle.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.draw();
  }

  setOptions(options, relayout = false) {
    const prior = { ...this.options };
    this.options = { ...this.options, ...options };
    this.minimap.hidden = !this.options.minimap;
    this.gridHelper.visible = this.options.grid;
    const layoutChanged = ["brainMode", "layout", "spacing", "sort"]
      .some((key) => prior[key] !== this.options[key]);
    const graphChanged = ["color", "shape", "size", "showHubs", "arrows", "edgeLabels", "inferredDash", "labelDensity"]
      .some((key) => prior[key] !== this.options[key]);
    if (prior.shape !== this.options.shape) this.nodeGeometry = geometryForShape(this.options.shape);
    if (relayout || layoutChanged) {
      this.layout();
      this.rebuildGraph();
      if (prior.brainMode !== this.options.brainMode) this.fit();
    } else if (graphChanged) {
      this.rebuildGraph();
    }
    if (!this.options.pulse) this.flowMesh.count = 0;
    this.applyFocusStyle();
    this.draw();
  }

  setData(data, options = {}) {
    const resetCamera = options.resetCamera !== false;
    const previousSelection = new Set(this.selected);
    this.data = data || { nodes: [], edges: [] };
    const connected = new Set();
    for (const edge of this.data.edges || []) {
      connected.add(edge.source);
      connected.add(edge.target);
    }
    const allNodes = this.data.nodes || [];
    const degrees = allNodes.map((node) => Number(node.degree || node.rawCount || 0)).sort((a, b) => a - b);
    this.maxDegree = degrees.at(-1) || 1;
    this.hubThreshold = degrees[Math.floor(Math.max(0, degrees.length - 1) * 0.9)] || 0;
    this.nodes = allNodes.filter((node) => (
      (this.options.showIsolates || connected.has(node.id))
      && (!this.options.hubsOnly || Number(node.degree || node.rawCount || 0) >= this.hubThreshold)
    ));
    this.nodeById = new Map(this.nodes.map((node) => [node.id, node]));
    this.edges = (this.data.edges || []).filter((edge) => this.nodeById.has(edge.source) && this.nodeById.has(edge.target));
    this.selected = new Set([...previousSelection].filter((id) => this.nodeById.has(id)));
    this.hovered = null;
    this.layout();
    this.rebuildGraph();
    this.activityCache = null;
    if (resetCamera) this.fit();
    this.updateSelection();
    this.draw();
  }

  layout() {
    const layout = window.ZivarBrainLayout;
    this.positions = layout.brainLayout(this.nodes, {
      mode: this.data.mode,
      split: this.options.brainMode === "split",
      layout: this.options.layout,
      sort: this.options.sort,
      spacing: this.options.spacing,
      edges: this.edges,
    });
  }

  clearGraph() {
    for (const object of [...this.graphGroup.children]) {
      this.graphGroup.remove(object);
      if (this.nodeMeshes.includes(object)) disposeObject(object, this.nodeGeometry);
      else if (object === this.edgeLines) disposeObject(object, null, [this.edgeMaterial, this.inferredEdgeMaterial]);
      else disposeObject(object);
    }
    this.nodeMeshes = [];
    this.edgeLines = null;
    this.flowEdges = [];
    this.nodeSizes.clear();
  }

  rebuildGraph() {
    this.clearGraph();
    if (!this.nodes.length) {
      this.updateSelection();
      return;
    }

    const groups = new Map();
    for (const node of this.nodes) {
      const color = colorForNode(node, this.data, this.options, this.maxDegree);
      if (!groups.has(color)) groups.set(color, []);
      groups.get(color).push(node);
    }
    for (const [color, nodes] of groups) {
      const matrix = new THREE.Matrix4();
      const scale = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: this.activityFocus ? 0.28 : 0.9,
        fog: false,
        toneMapped: false,
      });
      const mesh = new THREE.InstancedMesh(this.nodeGeometry, material, nodes.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.userData.nodes = nodes;
      nodes.forEach((node, index) => {
        const position = this.positions.get(node.id);
        const metric = this.options.size === "members"
          ? Number(node.rawCount || node.members || 0)
          : Number(node.degree || node.rawCount || 0);
        let size = this.options.size === "uniform"
          ? 0.019
          : clamp(0.013 + Math.log2(metric + 2) * 0.004, 0.014, 0.044);
        if (this.options.showHubs && Number(node.degree || node.rawCount || 0) >= this.hubThreshold) size *= 1.28;
        this.nodeSizes.set(node.id, size);
        scale.setScalar(size);
        matrix.compose(new THREE.Vector3(position.x, position.y, position.z), quaternion, scale);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.nodeMeshes.push(mesh);
      this.graphGroup.add(mesh);
    }

    const edgeParts = {
      solid: { positions: [], colors: [] },
      inferred: { positions: [], colors: [] },
    };
    this.flowEdges = [...this.edges]
      .sort((a, b) => Number(b.weight || b.count || 1) - Number(a.weight || a.count || 1))
      .slice(0, 64);
    for (const edge of this.edges) {
      const source = this.positions.get(edge.source);
      const target = this.positions.get(edge.target);
      if (!source || !target) continue;
      const part = this.options.inferredDash && edge.confidence === "INFERRED"
        ? edgeParts.inferred
        : edgeParts.solid;
      part.positions.push(source.x, source.y, source.z, target.x, target.y, target.z);
      const exactMatch = edge.relation === "exact_label_match";
      const sourceColor = new THREE.Color(exactMatch
        ? "#f3c954"
        : colorForNode(this.nodeById.get(edge.source), this.data, this.options, this.maxDegree));
      const targetColor = new THREE.Color(exactMatch
        ? "#f3c954"
        : colorForNode(this.nodeById.get(edge.target), this.data, this.options, this.maxDegree));
      part.colors.push(sourceColor.r, sourceColor.g, sourceColor.b, targetColor.r, targetColor.g, targetColor.b);
    }
    this.edgeLines = new THREE.Group();
    for (const [name, part] of Object.entries(edgeParts)) {
      if (!part.positions.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(part.colors, 3));
      const lines = new THREE.LineSegments(
        geometry,
        name === "inferred" ? this.inferredEdgeMaterial : this.edgeMaterial,
      );
      if (name === "inferred") lines.computeLineDistances();
      lines.frustumCulled = false;
      this.edgeLines.add(lines);
    }
    this.edgeLines.frustumCulled = false;
    this.graphGroup.add(this.edgeLines);

    if (this.options.arrows && this.edges.length) {
      const visibleEdges = [...this.edges]
        .sort((a, b) => Number(b.weight || b.count || 1) - Number(a.weight || a.count || 1))
        .slice(0, 400);
      const geometry = new THREE.ConeGeometry(1, 2.2, 6);
      const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.72 });
      const arrows = new THREE.InstancedMesh(geometry, material, visibleEdges.length);
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      visibleEdges.forEach((edge, index) => {
        const source = this.positions.get(edge.source);
        const target = this.positions.get(edge.target);
        const start = new THREE.Vector3(source.x, source.y, source.z);
        const end = new THREE.Vector3(target.x, target.y, target.z);
        const direction = end.clone().sub(start).normalize();
        quaternion.setFromUnitVectors(up, direction);
        matrix.compose(start.lerp(end, 0.78), quaternion, new THREE.Vector3(0.005, 0.008, 0.005));
        arrows.setMatrixAt(index, matrix);
        arrows.setColorAt(index, new THREE.Color(colorForNode(
          this.nodeById.get(edge.target),
          this.data,
          this.options,
          this.maxDegree,
        )));
      });
      arrows.instanceMatrix.needsUpdate = true;
      if (arrows.instanceColor) arrows.instanceColor.needsUpdate = true;
      arrows.frustumCulled = false;
      this.graphGroup.add(arrows);
    }

    const labelCount = Math.min(80, Math.ceil(this.nodes.length * Number(this.options.labelDensity || 0) / 100));
    [...this.nodes]
      .sort((a, b) => Number(b.degree || 0) - Number(a.degree || 0))
      .slice(0, labelCount)
      .forEach((node) => {
        const position = this.positions.get(node.id);
        const sprite = makeTextSprite(String(node.label || node.id).slice(0, 44));
        sprite.userData.graphLabel = true;
        sprite.position.set(position.x + 0.025, position.y + 0.025, position.z);
        this.graphGroup.add(sprite);
      });

    if (this.options.edgeLabels) {
      [...this.edges]
        .sort((a, b) => Number(b.weight || b.count || 1) - Number(a.weight || a.count || 1))
        .slice(0, 24)
        .forEach((edge) => {
          const source = this.positions.get(edge.source);
          const target = this.positions.get(edge.target);
          const sprite = makeTextSprite(String(edge.label || edge.relation || "koppling").slice(0, 36), "#f3c954");
          sprite.userData.graphLabel = true;
          sprite.position.set(
            (source.x + target.x) / 2,
            (source.y + target.y) / 2,
            (source.z + target.z) / 2,
          );
          this.graphGroup.add(sprite);
        });
    }
    this.applyFocusStyle();
    this.updateSelection();
  }

  cameraState() {
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      rotation: this.root.rotation.toArray().slice(0, 3),
    };
  }

  restoreCamera(snapshot) {
    const validVector = (value) => Array.isArray(value)
      && value.length === 3
      && value.every((part) => Number.isFinite(Number(part)));
    if (!validVector(snapshot?.position) || !validVector(snapshot?.target)) return false;
    this.camera.position.fromArray(snapshot.position.map(Number));
    this.controls.target.fromArray(snapshot.target.map(Number));
    if (validVector(snapshot.rotation)) this.root.rotation.set(...snapshot.rotation.map(Number));
    this.controls.update();
    this.draw();
    return true;
  }

  fit() {
    if (!this.positions.size) return;
    const bounds = window.ZivarBrainLayout.brainBounds(this.positions);
    const center = new THREE.Vector3(bounds.center.x, bounds.center.y, bounds.center.z);
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = Math.max(2.2, bounds.radius / Math.sin(verticalFov / 2) * 1.08);
    this.controls.target.copy(center);
    this.camera.position.set(center.x, center.y + bounds.radius * 0.08, center.z + distance);
    this.camera.near = Math.max(0.01, distance / 1000);
    this.camera.far = Math.max(100, distance * 12);
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.draw();
    this.onCameraChange?.();
  }

  zoomBy(factor) {
    const direction = this.camera.position.clone().sub(this.controls.target);
    const distance = clamp(direction.length() / factor, this.controls.minDistance, this.controls.maxDistance);
    direction.setLength(distance);
    this.camera.position.copy(this.controls.target).add(direction);
    this.controls.update();
    this.draw();
    this.onCameraChange?.();
  }

  rotate(angle = Math.PI / 12) {
    this.root.rotateY(angle);
    this.draw();
    this.onCameraChange?.();
  }

  setTool(tool) {
    this.tool = tool === "select" ? "select" : "select";
  }

  setActivity(events, options = {}) {
    this.activity = events.slice(-1000);
    this.activityAsOf = Number(options.asOf) || Date.now();
    this.activityLive = options.live !== false;
    this.activityHalfLife = options.halfLife === Infinity ? Infinity : Number(options.halfLife) || 120_000;
    this.activityAgents = options.agents === undefined ? null : new Set(options.agents);
    this.activityCache = null;
    this.updateActivity(this.activityLive ? Date.now() : this.activityAsOf);
    this.draw();
  }

  setActivityFocus(enabled) {
    this.activityFocus = Boolean(enabled);
    this.canvas.classList.toggle("activity-focus", this.activityFocus);
    this.applyFocusStyle();
    this.draw();
  }

  applyFocusStyle() {
    const hasSelection = this.selected.size > 0;
    for (const mesh of this.nodeMeshes) {
      mesh.material.opacity = this.activityFocus ? 0.2 : hasSelection ? 0.18 : 0.9;
      mesh.material.needsUpdate = true;
    }
    for (const object of this.graphGroup.children) {
      if (object.userData.graphLabel) object.visible = !this.activityFocus;
    }
    for (const material of [this.edgeMaterial, this.inferredEdgeMaterial]) {
      material.opacity = this.activityFocus ? 0.025 : hasSelection ? 0.02 : material === this.edgeMaterial ? 0.12 : 0.1;
      material.needsUpdate = true;
    }
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
      if (Number.isFinite(Number(target.community))) candidates.unshift(`${prefix}:community:${target.community}`);
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
    const targetVector = new THREE.Vector3(position.x, position.y, position.z);
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    const distance = clamp(this.camera.position.distanceTo(this.controls.target) * 0.58, 1.25, 4.2);
    this.controls.target.copy(targetVector);
    this.camera.position.copy(targetVector).add(direction.multiplyScalar(distance));
    this.controls.update();
    this.selectTarget({ id }, project);
    this.onCameraChange?.();
    return true;
  }

  selectTarget(target, project) {
    const id = this.targetId(target, project);
    if (!id) return false;
    this.selected = new Set([id]);
    this.updateSelection();
    this.draw();
    return true;
  }

  clearSelection() {
    this.selected.clear();
    this.updateSelection();
    this.draw();
  }

  clearSelectionHighlights() {
    for (const object of [this.selectionLinks, this.selectionPoints]) {
      if (!object) continue;
      this.activityGroup.remove(object);
      disposeObject(object);
    }
    this.selectionLinks = null;
    this.selectionPoints = null;
  }

  updateSelection() {
    this.clearSelectionHighlights();
    const id = this.selected.values().next().value;
    const position = id ? this.positions.get(id) : null;
    if (!position) {
      this.selection.visible = false;
      this.applyFocusStyle();
      return;
    }
    const size = (this.nodeSizes.get(id) || 0.04) * 1.75;
    this.selection.position.set(position.x, position.y, position.z);
    this.selection.scale.setScalar(size);
    this.selection.visible = true;

    const linePositions = [];
    const neighbors = new Set();
    for (const edge of this.edges) {
      if (edge.source !== id && edge.target !== id) continue;
      const other = edge.source === id ? edge.target : edge.source;
      const target = this.positions.get(other);
      if (!target) continue;
      neighbors.add(other);
      linePositions.push(position.x, position.y, position.z, target.x, target.y, target.z);
    }
    if (linePositions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
      const material = new THREE.LineBasicMaterial({
        color: 0xf3c954,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });
      this.selectionLinks = new THREE.LineSegments(geometry, material);
      this.selectionLinks.frustumCulled = false;
      this.activityGroup.add(this.selectionLinks);
    }
    if (neighbors.size) {
      const geometry = new THREE.BufferGeometry().setFromPoints(
        [...neighbors].map((neighbor) => {
          const point = this.positions.get(neighbor);
          return new THREE.Vector3(point.x, point.y, point.z);
        }),
      );
      const material = new THREE.PointsMaterial({
        color: 0xf3c954,
        size: 6,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
      });
      this.selectionPoints = new THREE.Points(geometry, material);
      this.selectionPoints.frustumCulled = false;
      this.activityGroup.add(this.selectionPoints);
    }
    this.applyFocusStyle();
  }

  activitySnapshot(now) {
    const engine = window.ZivarActivity;
    if (!engine) return { active: [], transitions: [], visits: new Map() };
    const cacheKey = [
      this.activity.length,
      Math.floor(now / 1000),
      this.activityAgents ? [...this.activityAgents].sort().join(",") : "*",
    ].join(":");
    if (this.activityCache?.key === cacheKey) return this.activityCache.value;
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
      if (previous && !event.renewal && previous.id !== id && time - previous.time <= 10 * 60_000) {
        transitions.push({
          agent,
          color,
          time,
          target: id,
          event,
          path: engine.findPath(this.edges, previous.id, id, engine.MAX_HOPS),
        });
      }
      latest.set(agent, { id, time, event, color });
    }
    const active = [...latest.entries()]
      .map(([agent, item]) => ({ agent, ...item }))
      .filter((item) => engine.isLeaseActive(item.event, now));
    const value = { active, transitions, visits };
    this.activityCache = { key: cacheKey, value };
    return value;
  }

  updateInstances(mesh, items) {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mesh.count = Math.min(items.length, mesh.instanceMatrix.count);
    items.slice(0, mesh.count).forEach((item, index) => {
      scale.setScalar(item.size);
      matrix.compose(item.position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, new THREE.Color(item.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  clearPaths() {
    for (const object of [...this.pathGroup.children]) {
      this.pathGroup.remove(object);
      disposeObject(object);
    }
  }

  updateActivity(now) {
    if (!window.ZivarActivity || !this.positions.size) {
      this.heatMesh.count = 0;
      this.coreMesh.count = 0;
      this.electronMesh.count = 0;
      this.particleMesh.count = 0;
      this.activeGlow.visible = false;
      this.clearPaths();
      return;
    }
    const engine = window.ZivarActivity;
    const snapshot = this.activitySnapshot(now);
    const heated = [...snapshot.visits.entries()]
      .map(([id, visits]) => ({
        id,
        visits,
        heat: engine.heatAt(visits, now, this.activityHalfLife),
      }))
      .filter((item) => item.heat >= 0.025)
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 300);
    this.updateInstances(this.heatMesh, heated.map((item) => {
      const position = this.positions.get(item.id);
      return {
        position: new THREE.Vector3(position.x, position.y, position.z),
        size: (this.nodeSizes.get(item.id) || 0.04) * (1.1 + Math.min(0.75, item.heat * 0.35)),
        color: item.visits.at(-1)?.color || "#2fd0df",
      };
    }));

    const cores = snapshot.active.slice(0, 24).map((item) => {
      const position = this.positions.get(item.id);
      return {
        position: new THREE.Vector3(position.x, position.y, position.z),
        size: (this.nodeSizes.get(item.id) || 0.04) * 0.9,
        color: "#ffffff",
      };
    });
    this.updateInstances(this.coreMesh, cores);

    const adjacency = engine.buildAdjacency(this.edges);
    const electrons = [];
    if (!this.reducedMotion) {
      snapshot.active.slice(0, 8).forEach((item, activeIndex) => {
        const source = this.positions.get(item.id);
        const neighbors = (adjacency.get(item.id) || []).slice(0, 10);
        neighbors.forEach((neighbor, index) => {
          const target = this.positions.get(neighbor.other);
          if (!target) return;
          const progress = (now * 0.00022 + index / Math.max(1, neighbors.length) + activeIndex * 0.13) % 1;
          electrons.push({
            position: new THREE.Vector3(
              source.x + (target.x - source.x) * progress,
              source.y + (target.y - source.y) * progress,
              source.z + (target.z - source.z) * progress,
            ),
            size: 0.015,
            color: item.color,
          });
        });
      });
    }
    this.updateInstances(this.electronMesh, electrons.slice(0, 96));

    this.clearPaths();
    const particles = [];
    for (const transition of snapshot.transitions.slice(-64)) {
      const age = now - transition.time;
      const duration = 2600 + Math.min(12, transition.path?.hops || 0) * 300;
      if (age < 0 || age > duration || !transition.path) continue;
      const points = transition.path.nodes
        .map((id) => this.positions.get(id))
        .filter(Boolean)
        .map((point) => new THREE.Vector3(point.x, point.y, point.z));
      if (points.length < 2) continue;
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const pathMaterial = new THREE.LineBasicMaterial({
        color: transition.color,
        transparent: true,
        opacity: 0.76,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.pathGroup.add(new THREE.Line(pathGeometry, pathMaterial));
      if (this.reducedMotion) continue;
      const progress = clamp(age / duration, 0, 0.9999) * (points.length - 1);
      const segment = Math.floor(progress);
      const local = progress - segment;
      particles.push({
        position: points[segment].clone().lerp(points[segment + 1], local),
        size: 0.027,
        color: "#ffffff",
      });
    }
    this.updateInstances(this.particleMesh, particles.slice(0, 64));

    const latestActive = snapshot.active.at(-1);
    if (latestActive) {
      const position = this.positions.get(latestActive.id);
      const pulse = this.reducedMotion ? 1 : 1 + Math.sin(now * 0.006) * 0.12;
      this.activeGlow.position.set(position.x, position.y, position.z);
      this.activeGlow.scale.setScalar((this.nodeSizes.get(latestActive.id) || 0.04) * 3.4 * pulse);
      this.activeGlow.material.color.set(latestActive.color);
      this.activeGlow.visible = true;
    } else {
      this.activeGlow.visible = false;
    }
  }

  needsActivityFrame(now) {
    if (this.reducedMotion || !this.activity.length || !window.ZivarActivity) return false;
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

  updateFlow(now) {
    if (!this.options.pulse || this.activityFocus || this.reducedMotion) {
      this.flowMesh.count = 0;
      return;
    }
    const speed = Math.max(0.01, Number(this.options.pulseSpeed || 1) / 100);
    const items = this.flowEdges.map((edge) => {
      const source = this.positions.get(edge.source);
      const target = this.positions.get(edge.target);
      const progress = (now * 0.00012 * speed + (hash(edge.id || `${edge.source}:${edge.target}:${edge.relation}`) % 1000) / 1000) % 1;
      return {
        position: new THREE.Vector3(
          source.x + (target.x - source.x) * progress,
          source.y + (target.y - source.y) * progress,
          source.z + (target.z - source.z) * progress,
        ),
        size: 0.012,
        color: colorForNode(this.nodeById.get(edge.target), this.data, this.options, this.maxDegree),
      };
    });
    this.updateInstances(this.flowMesh, items);
  }

  drawMinimap() {
    if (this.minimap.hidden || !this.positions.size) return;
    const context = this.miniContext;
    const width = this.minimap.width;
    const height = this.minimap.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#0b1015";
    context.fillRect(0, 0, width, height);
    for (const node of this.nodes) {
      const point = this.positions.get(node.id);
      const projected = new THREE.Vector3(point.x, point.y, point.z);
      this.root.localToWorld(projected);
      projected.project(this.camera);
      if (projected.z < -1 || projected.z > 1) continue;
      context.beginPath();
      context.arc(
        (projected.x * 0.5 + 0.5) * width,
        (-projected.y * 0.5 + 0.5) * height,
        this.selected.has(node.id) ? 3 : 1.2,
        0,
        Math.PI * 2,
      );
      context.fillStyle = this.selected.has(node.id)
        ? "#ffffff"
        : colorForNode(node, this.data, this.options, this.maxDegree);
      context.fill();
    }
  }

  pick(event) {
    if (!this.nodeMeshes.length) return null;
    const rectangle = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rectangle.left) / rectangle.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rectangle.top) / rectangle.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const match = this.raycaster.intersectObjects(this.nodeMeshes, false)[0];
    return Number.isInteger(match?.instanceId) ? match.object.userData.nodes[match.instanceId] : null;
  }

  installEvents() {
    this.canvas.addEventListener("pointerdown", (event) => {
      this.lastPointer = { x: event.clientX, y: event.clientY, time: performance.now() };
    });
    this.canvas.addEventListener("pointerup", (event) => {
      if (!this.lastPointer) return;
      const distance = Math.hypot(event.clientX - this.lastPointer.x, event.clientY - this.lastPointer.y);
      this.lastPointer = null;
      if (distance > 7) return;
      const node = this.pick(event);
      if (!node) {
        this.selected.clear();
        this.updateSelection();
        this.onSelect?.([], false);
        return;
      }
      this.selected = new Set([node.id]);
      this.updateSelection();
      this.onSelect?.([node.id], false);
    });
    this.canvas.addEventListener("dblclick", (event) => {
      const node = this.pick(event);
      if (node) this.onDoubleClick?.(node);
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (event.buttons) return;
      this.hovered = this.pick(event);
      this.canvas.style.cursor = this.hovered ? "pointer" : "grab";
    });
    this.canvas.addEventListener("pointerleave", () => {
      this.hovered = null;
      this.canvas.style.cursor = "grab";
    });
    this.controls.addEventListener("start", () => {
      this.canvas.style.cursor = "grabbing";
    });
    this.controls.addEventListener("end", () => {
      this.canvas.style.cursor = this.hovered ? "pointer" : "grab";
      this.onCameraChange?.();
    });
  }

  updateLabel(now) {
    const snapshot = this.activitySnapshot(now);
    const active = snapshot.active.at(-1);
    const selectedId = this.selected.values().next().value;
    const id = active?.id || this.hovered?.id || selectedId;
    const position = id ? this.positions.get(id) : null;
    if (!position) {
      this.label.hidden = true;
      return;
    }
    const node = this.nodeById.get(id);
    const label = active
      ? `${String(active.agent).slice(0, 16)} · ${(active.event.target?.label || node?.label || "").slice(0, 48)}`
      : (node?.label || "");
    const world = new THREE.Vector3(position.x, position.y, position.z);
    this.root.localToWorld(world);
    world.project(this.camera);
    if (world.z < -1 || world.z > 1 || Math.abs(world.x) > 1.2 || Math.abs(world.y) > 1.2) {
      this.label.hidden = true;
      return;
    }
    this.label.textContent = label;
    this.label.classList.toggle("active", Boolean(active));
    this.label.style.left = `${(world.x * 0.5 + 0.5) * this.width}px`;
    this.label.style.top = `${(-world.y * 0.5 + 0.5) * this.height}px`;
    this.label.hidden = false;
  }

  draw() {
    if (!this.renderer) return;
    const now = this.activityLive ? Date.now() : this.activityAsOf;
    this.updateLabel(now);
    this.renderer.render(this.scene, this.camera);
    this.drawMinimap();
  }

  animate(time) {
    const delta = time - this.lastFrame;
    this.lastFrame = time;
    this.controls.autoRotate = this.autoOrbit && !this.reducedMotion;
    this.controls.autoRotateSpeed = 0.65;
    this.controls.update();
    const now = this.activityLive ? Date.now() : this.activityAsOf;
    if (time - this.lastActivityFrame >= 50 && this.needsActivityFrame(now)) {
      this.lastActivityFrame = time;
      this.updateActivity(now);
    }
    if (time - this.lastFlowFrame >= 50 && this.options.pulse) {
      this.lastFlowFrame = time;
      this.updateFlow(now);
    }
    if (this.autoOrbit && !this.reducedMotion && delta > 0) this.root.rotation.z = Math.sin(time * 0.00018) * 0.025;
    this.draw();
    requestAnimationFrame((nextTime) => this.animate(nextTime));
  }
}
