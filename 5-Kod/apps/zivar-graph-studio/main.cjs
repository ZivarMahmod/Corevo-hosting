const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  GraphProject,
  compareProjects,
  comparisonGraph,
  differenceGraph,
  simulateIntegration,
} = require("./graph-engine.cjs");
const {
  analyzeBranch,
  compactImpact,
  ensureGithubRepository,
} = require("./branch-lens.cjs");

let mainWindow = null;
let bootstrapPromise = null;
const projects = new Map();
const projectMeta = new Map();
let branchImpact = null;
const graphLibraryRegistry = path.join(os.homedir(), ".codex", "graphify-library", "registry.json");

function graphLibraryEntries() {
  if (!fs.existsSync(graphLibraryRegistry)) return [];
  try {
    const registry = JSON.parse(fs.readFileSync(graphLibraryRegistry, "utf8"));
    return Object.values(registry.projects || {}).filter((project) => (
      project?.id
      && project?.name
      && project?.graph_path
      && fs.existsSync(project.graph_path)
    ));
  } catch {
    return [];
  }
}

function graphLibraryProjects() {
  return graphLibraryEntries().map((project) => ({
    id: project.id,
    name: project.name,
    tags: Array.isArray(project.tags) ? project.tags : [],
  }));
}

function findWorkspaceRoot() {
  const configured = process.env.ZIVAR_STUDIO_WORKSPACE;
  const starts = [configured, process.cwd(), __dirname].filter(Boolean);
  for (const start of starts) {
    let current = path.resolve(start);
    for (let depth = 0; depth < 10; depth += 1) {
      if (fs.existsSync(path.join(current, "5-Kod", "package.json"))) return current;
      if (path.basename(current) === "5-Kod" && fs.existsSync(path.join(current, "package.json"))) {
        return path.dirname(current);
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

function runtimePaths() {
  const workspaceRoot = findWorkspaceRoot();
  const codeRoot = workspaceRoot ? path.join(workspaceRoot, "5-Kod") : null;
  const localGraphify = codeRoot ? path.join(codeRoot, "graphify-out") : null;
  const stateRoot = localGraphify && fs.existsSync(localGraphify)
    ? localGraphify
    : path.join(app.getPath("userData"), "runtime");
  fs.mkdirSync(stateRoot, { recursive: true });
  return {
    workspaceRoot,
    codeRoot,
    stateRoot,
    eventFile: path.join(stateRoot, "studio-events.jsonl"),
    stateFile: path.join(stateRoot, "studio-state.json"),
    branchImpactFile: path.join(stateRoot, "studio-branch-impact.json"),
    cacheRoot: path.join(app.getPath("userData"), "graphs"),
    repoRoot: path.join(app.getPath("userData"), "repos"),
    branchCacheRoot: path.join(app.getPath("userData"), "branch-lens"),
  };
}

function readState() {
  const { stateFile } = runtimePaths();
  if (!fs.existsSync(stateFile) || fs.statSync(stateFile).size > 256 * 1024) return null;
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return null;
  }
}

function progress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("studio:progress", payload);
}

function appendEvent(kind, payload = {}) {
  const { eventFile } = runtimePaths();
  const event = {
    id: `${Date.now()}.${Math.floor(Math.random() * 100000)}`,
    timestamp: new Date().toISOString(),
    kind,
    ...payload,
  };
  fs.appendFileSync(eventFile, `${JSON.stringify(event)}\n`, "utf8");
  return event;
}

function projectInfo(slot) {
  const model = projects.get(slot);
  const meta = projectMeta.get(slot);
  if (!model) return null;
  return {
    slot,
    ...model.summary,
    graphPath: model.graphPath,
    sourceRoot: model.sourceRoot,
    kind: model.kind,
    audit: model.audit(),
    canRefresh: Boolean(meta?.folder || meta?.graphPath),
    libraryProjectId: meta?.libraryProjectId || null,
  };
}

function loadGraph(slot, graphPath, options = {}) {
  progress({ slot, phase: "loading", message: `Läser ${options.name || path.basename(graphPath)}` });
  const startedAt = Date.now();
  const model = GraphProject.fromFile(graphPath, options);
  projects.set(slot, model);
  projectMeta.set(slot, { ...options, graphPath });
  appendEvent("load", {
    agent: "Zivar Studio",
    project: slot,
    action: "load_graph",
    summary: `${model.name}: ${model.summary.nodes} noder och ${model.summary.edges} kopplingar`,
    duration_ms: Date.now() - startedAt,
    status: "ok",
  });
  progress({ slot, phase: "ready", message: `${model.name} är klar` });
  return projectInfo(slot);
}

async function loadDefaults() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    clearBranchImpact();
    const runtime = runtimePaths();
    if (!runtime.codeRoot) return;
    const savedProjects = readState()?.projects || {};
    const defaults = [
      {
        slot: "A",
        graphPath: path.join(runtime.codeRoot, "graphify-out", "graph.json"),
        name: "Corevo",
        sourceRoot: runtime.codeRoot,
        libraryProjectId: "corevo",
      },
      {
        slot: "B",
        graphPath: path.join(runtime.codeRoot, "graphify-references", "open-design", "graphify-out", "graph.json"),
        name: "Open Design",
        sourceRoot: path.join(runtime.workspaceRoot, "4-Dokument-Underlag", "08-externa-verktyg", "open-design"),
        libraryProjectId: "open-design",
      },
    ];
    for (const item of defaults) {
      const saved = savedProjects[item.slot];
      const library = graphLibraryEntries().find((entry) => (
        entry.id === saved?.libraryProjectId
        || (saved?.graphPath && path.resolve(entry.graph_path) === path.resolve(saved.graphPath))
      ));
      const restored = library ? {
        ...item,
        graphPath: path.resolve(library.graph_path),
        sourceRoot: library.source_path ? path.resolve(library.source_path) : path.dirname(library.graph_path),
        name: library.name,
        libraryProjectId: library.id,
      } : saved?.graphPath && fs.existsSync(saved.graphPath) ? {
        ...item,
        graphPath: saved.graphPath,
        sourceRoot: saved.sourceRoot || path.dirname(saved.graphPath),
        name: saved.name || item.name,
        kind: saved.kind || item.kind,
        libraryProjectId: saved.libraryProjectId || null,
      } : item;
      if (!fs.existsSync(restored.graphPath)) continue;
      try {
        loadGraph(restored.slot, restored.graphPath, restored);
      } catch (error) {
        progress({ slot: restored.slot, phase: "error", message: error.message });
      }
    }
  })();
  return bootstrapPromise;
}

function loadLibraryProject(slot, projectId) {
  const entry = graphLibraryEntries().find((project) => project.id === projectId);
  if (!entry) throw new Error("Den sparade grafen finns inte längre.");
  clearBranchImpact();
  return loadGraph(slot, path.resolve(entry.graph_path), {
    name: entry.name,
    sourceRoot: path.resolve(entry.source_path),
    kind: "graphify",
    libraryProjectId: entry.id,
  });
}

function graphifyInterpreter() {
  const { codeRoot } = runtimePaths();
  if (codeRoot) {
    const pointer = path.join(codeRoot, "graphify-out", ".graphify_python");
    if (fs.existsSync(pointer)) {
      const executable = fs.readFileSync(pointer, "utf8").trim();
      if (executable && fs.existsSync(executable)) return executable;
    }
  }
  return process.platform === "win32" ? "python" : "python3";
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      windowsHide: true,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    const consume = (chunk, type) => {
      const text = chunk.toString();
      if (type === "stdout") stdout += text;
      else stderr += text;
      const line = text.trim().split(/\r?\n/).filter(Boolean).at(-1);
      if (line) progress({ slot: options.slot, phase: options.phase || "working", message: line.slice(0, 240) });
    };
    child.stdout.on("data", (chunk) => consume(chunk, "stdout"));
    child.stderr.on("data", (chunk) => consume(chunk, "stderr"));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || `${command} avslutades med kod ${code}`).trim().slice(-1500)));
    });
  });
}

async function analyzeFolder(slot, folder, force = false) {
  clearBranchImpact();
  const directGraph = path.join(folder, "graphify-out", "graph.json");
  if (fs.existsSync(directGraph) && !force) {
    return loadGraph(slot, directGraph, {
      name: path.basename(folder),
      sourceRoot: folder,
      folder,
      managedGraph: false,
    });
  }
  const runtime = runtimePaths();
  fs.mkdirSync(runtime.cacheRoot, { recursive: true });
  const cacheKey = createHash("sha256").update(path.resolve(folder)).digest("hex").slice(0, 18);
  const outputRoot = path.join(runtime.cacheRoot, cacheKey);
  const graphPath = path.join(outputRoot, "graphify-out", "graph.json");
  if (!force && fs.existsSync(graphPath)) {
    return loadGraph(slot, graphPath, {
      name: path.basename(folder),
      sourceRoot: folder,
      folder,
      managedGraph: true,
    });
  }

  const startedAt = Date.now();
  progress({ slot, phase: "extracting", message: "Graphify läser projektets kod" });
  const python = graphifyInterpreter();
  await runCommand(python, [
    "-u", "-m", "graphify", "extract", folder,
    "--code-only", "--no-cluster", "--out", outputRoot,
    ...(force ? ["--force"] : []),
  ], {
    cwd: runtime.codeRoot || folder,
    slot,
    phase: "extracting",
    env: { GRAPHIFY_VIZ_NODE_LIMIT: "0" },
  });
  await runCommand(python, [
    "-u", "-m", "graphify", "cluster-only", outputRoot,
    "--graph", graphPath, "--no-viz", "--no-label",
  ], {
    cwd: runtime.codeRoot || folder,
    slot,
    phase: "clustering",
  });
  appendEvent("analysis", {
    agent: "Graphify",
    project: slot,
    action: "extract_and_cluster",
    summary: `Analyserade ${path.basename(folder)}`,
    duration_ms: Date.now() - startedAt,
    status: "ok",
  });
  return loadGraph(slot, graphPath, {
    name: path.basename(folder),
    sourceRoot: folder,
    folder,
    managedGraph: true,
  });
}

async function loadGithub(slot, input) {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(String(input || "").trim());
  if (!match) throw new Error("Använd en publik GitHub-länk i formatet https://github.com/ägare/repo.");
  const [, owner, repository] = match;
  const runtime = runtimePaths();
  const repoPath = path.join(runtime.repoRoot, owner, repository);
  fs.mkdirSync(path.dirname(repoPath), { recursive: true });
  if (fs.existsSync(path.join(repoPath, ".git"))) {
    progress({ slot, phase: "cloning", message: `Uppdaterar ${owner}/${repository}` });
    try {
      await runCommand("git", ["-C", repoPath, "pull", "--ff-only"], { slot, phase: "cloning" });
    } catch {
      progress({ slot, phase: "cloning", message: "Kunde inte uppdatera; använder den lokala kopian" });
    }
  } else {
    progress({ slot, phase: "cloning", message: `Hämtar ${owner}/${repository}` });
    await runCommand("git", ["clone", "--depth", "1", `https://github.com/${owner}/${repository}.git`, repoPath], {
      slot,
      phase: "cloning",
    });
  }
  return analyzeFolder(slot, repoPath, true);
}

function clearBranchImpact() {
  branchImpact = null;
  const { branchImpactFile } = runtimePaths();
  try {
    fs.unlinkSync(branchImpactFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function saveBranchImpact(impact) {
  branchImpact = impact;
  const { branchImpactFile } = runtimePaths();
  const temporary = `${branchImpactFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(compactImpact(impact), null, 2), "utf8");
  fs.renameSync(temporary, branchImpactFile);
}

async function loadBranchFromRepo(repoRoot, branch, base, options = {}) {
  const runtime = runtimePaths();
  progress({ phase: "branch", message: "Läser Git-referenser och bygger separata grafkopior" });
  const result = await analyzeBranch({
    repoRoot,
    cacheRoot: runtime.branchCacheRoot,
    branch: String(branch || ""),
    base: String(base || ""),
    graphifyPython: graphifyInterpreter(),
    remoteFirst: Boolean(options.remoteFirst),
    name: options.name || path.basename(repoRoot),
  });
  loadGraph("A", result.baseGraphPath, {
    name: `${options.name || path.basename(repoRoot)} · ${result.metadata.base}`,
    sourceRoot: result.baseCopy,
    branchLens: true,
  });
  loadGraph("B", result.branchGraphPath, {
    name: `${options.name || path.basename(repoRoot)} · ${result.metadata.branch}`,
    sourceRoot: result.branchCopy,
    branchLens: true,
  });
  saveBranchImpact(result.impact);
  appendEvent("branch", {
    agent: "System",
    project: "B",
    action: "branch_impact",
    summary: `${result.impact.changedFiles.length} ändrade filer · ${result.impact.affectedNodes.length} påverkade noder`,
    status: "ok",
  });
  return {
    projects: { A: projectInfo("A"), B: projectInfo("B") },
    impact: compactImpact(result.impact),
  };
}

async function loadGithubBranch(input, branch, base) {
  const runtime = runtimePaths();
  const remote = await ensureGithubRepository(runtime.branchCacheRoot, input);
  return loadBranchFromRepo(
    remote.repositoryRoot,
    branch || remote.branch,
    base,
    { remoteFirst: true, name: remote.repository },
  );
}

function readRecentEvents(after = "") {
  const { eventFile } = runtimePaths();
  if (!fs.existsSync(eventFile)) return [];
  const stat = fs.statSync(eventFile);
  const size = Math.min(stat.size, 2 * 1024 * 1024);
  const buffer = Buffer.alloc(size);
  const handle = fs.openSync(eventFile, "r");
  fs.readSync(handle, buffer, 0, size, stat.size - size);
  fs.closeSync(handle);
  const text = buffer.toString("utf8");
  const lines = (stat.size > size ? text.slice(text.indexOf("\n") + 1) : text).trim().split(/\r?\n/);
  return lines
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((event) => event && (!after || String(event.id) > String(after)))
    .slice(-250)
    .map(enrichActivity);
}

function enrichActivity(event) {
  const slot = event.project === "B" ? "B" : "A";
  const model = projects.get(slot);
  if (!model) return event;
  let node = event.label && model.byId.get(event.label);
  if (!node && event.label) node = model.search(event.label, 1)[0];
  if (node && !model.byId.has(node.id)) node = model.byId.get(node.id);
  const file = event.file || event.files?.[0] || node?.source_file || node?.sourceFile;
  if (!node && file) {
    const id = model.byFile.get(file)?.[0];
    node = id ? model.byId.get(id) : null;
  }
  return {
    ...event,
    target: node ? {
      id: node.id,
      label: node.label,
      sourceFile: node.source_file,
      community: node.community,
    } : file ? { sourceFile: file } : null,
  };
}

function writeState(input) {
  const { stateFile } = runtimePaths();
  const compactProject = (slot) => {
    const project = projectInfo(slot);
    if (!project) return null;
    return {
      name: project.name,
      kind: project.kind,
      nodes: project.nodes,
      edges: project.edges,
      communities: project.communities,
      files: project.files,
      relations: project.relations,
      components: project.components,
      isolates: project.isolates,
      graphPath: project.graphPath,
      sourceRoot: project.sourceRoot,
      libraryProjectId: project.libraryProjectId,
    };
  };
  const comparison = projects.size === 2 ? compareProjects(projects.get("A"), projects.get("B")) : null;
  const state = {
    updatedAt: new Date().toISOString(),
    projects: { A: compactProject("A"), B: compactProject("B") },
    view: input && typeof input === "object" ? input.view : null,
    filters: input && typeof input === "object" ? input.filters : null,
    options: input && typeof input === "object" ? input.options : null,
    selection: input && typeof input === "object" ? input.selection : null,
    camera: input && typeof input === "object" ? input.camera : null,
    comparison: comparison ? {
      overall: comparison.overall,
      facets: comparison.facets,
      sharedLabels: comparison.sharedLabels,
      exactMatches: comparison.exactMatches.length,
      ambiguousMatches: comparison.ambiguousMatches,
    } : null,
    branchImpact: branchImpact ? {
      base: branchImpact.base,
      branch: branchImpact.branch,
      baseSha: branchImpact.baseSha,
      branchSha: branchImpact.branchSha,
      changedFiles: branchImpact.changedFiles.length,
      directNodes: branchImpact.directNodes.length,
      affectedNodes: branchImpact.affectedNodes.length,
    } : null,
  };
  const serialized = JSON.stringify(state, null, 2);
  if (Buffer.byteLength(serialized) > 256 * 1024) throw new Error("Studio-state blev oväntat stor.");
  const temporary = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, serialized, "utf8");
  fs.renameSync(temporary, stateFile);
  return { ok: true };
}

function safeHandle(channel, handler) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return { ok: true, value: await handler(payload || {}) };
    } catch (error) {
      appendEvent("error", {
        agent: "Zivar Studio",
        action: channel,
        summary: error instanceof Error ? error.message : String(error),
        status: "error",
      });
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function registerIpc() {
  safeHandle("studio:bootstrap", async () => {
    await loadDefaults();
    const runtime = runtimePaths();
    return {
      version: app.getVersion(),
      runtime: "desktop",
      workspaceRoot: runtime.workspaceRoot,
      projects: { A: projectInfo("A"), B: projectInfo("B") },
      libraryProjects: graphLibraryProjects(),
      mcp: { name: "zivar-graph-studio", url: "http://127.0.0.1:8767/mcp" },
      activity: readRecentEvents(),
      branchImpact: branchImpact ? compactImpact(branchImpact) : null,
      savedState: readState(),
    };
  });

  safeHandle("studio:pick-project", async ({ slot }) => {
    const normalizedSlot = slot === "B" ? "B" : "A";
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `Välj projekt ${normalizedSlot}`,
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return analyzeFolder(normalizedSlot, result.filePaths[0]);
  });

  safeHandle(
    "studio:load-library-project",
    ({ slot, projectId }) => loadLibraryProject(slot === "B" ? "B" : "A", String(projectId || "")),
  );

  safeHandle("studio:pick-data-file", async ({ slot }) => {
    const normalizedSlot = slot === "B" ? "B" : "A";
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `Importera data till projekt ${normalizedSlot}`,
      properties: ["openFile"],
      filters: [
        { name: "Graf eller schema", extensions: ["json", "csv", "sql"] },
        { name: "Alla filer", extensions: ["*"] },
      ],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    clearBranchImpact();
    const filePath = result.filePaths[0];
    return loadGraph(normalizedSlot, filePath, {
      name: path.basename(filePath, path.extname(filePath)),
      sourceRoot: path.dirname(filePath),
      kind: path.extname(filePath).slice(1).toLowerCase(),
    });
  });

  safeHandle("studio:load-github", ({ slot, url }) => loadGithub(slot === "B" ? "B" : "A", url));
  safeHandle("studio:load-github-branch", ({ url, branch, base }) => loadGithubBranch(url, branch, base));
  safeHandle("studio:pick-branch-repo", async ({ branch, base }) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Välj ett betrott lokalt Git-repository",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return loadBranchFromRepo(result.filePaths[0], branch, base);
  });

  safeHandle("studio:refresh-project", async ({ slot }) => {
    const normalizedSlot = slot === "B" ? "B" : "A";
    const meta = projectMeta.get(normalizedSlot);
    if (!meta) throw new Error(`Projekt ${normalizedSlot} är inte laddat.`);
    if (meta.folder) return analyzeFolder(normalizedSlot, meta.folder, true);
    return loadGraph(normalizedSlot, meta.graphPath, meta);
  });

  safeHandle("studio:get-view", ({ slot, ...request }) => {
    const model = projects.get(slot === "B" ? "B" : "A");
    if (!model) throw new Error(`Projekt ${slot} är inte laddat.`);
    return model.view(request);
  });

  safeHandle("studio:get-node", ({ slot, id }) => projects.get(slot === "B" ? "B" : "A")?.nodeDetails(String(id)) || null);
  safeHandle("studio:search", ({ slot, query }) => projects.get(slot === "B" ? "B" : "A")?.search(String(query), 40) || []);
  safeHandle("studio:compare", () => compareProjects(projects.get("A"), projects.get("B")));
  safeHandle("studio:comparison-graph", ({ diffOnly }) => {
    if (branchImpact?.graph) return branchImpact.graph;
    return diffOnly
      ? differenceGraph(projects.get("A"), projects.get("B"))
      : comparisonGraph(projects.get("A"), projects.get("B"));
  });
  safeHandle("studio:branch-impact", () => branchImpact ? compactImpact(branchImpact) : null);
  safeHandle("studio:simulate", ({ aId, bId }) => simulateIntegration(projects.get("A"), projects.get("B"), aId, bId));
  safeHandle("studio:get-activity", ({ after }) => readRecentEvents(after));
  safeHandle("studio:update-state", (state) => writeState(state));

  safeHandle("studio:save-image", async ({ dataUrl }) => {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")) {
      throw new Error("Bilden hade fel format.");
    }
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Exportera grafbild",
      defaultPath: `zivar-graph-${new Date().toISOString().slice(0, 10)}.png`,
      filters: [{ name: "PNG-bild", extensions: ["png"] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
    return result.filePath;
  });

  safeHandle("studio:export-report", async () => {
    const report = {
      exportedAt: new Date().toISOString(),
      projects: { A: projectInfo("A"), B: projectInfo("B") },
      comparison: projects.size === 2 ? compareProjects(projects.get("A"), projects.get("B")) : null,
    };
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "Exportera analys",
      defaultPath: `zivar-graph-analysis-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.writeFileSync(result.filePath, JSON.stringify(report, null, 2), "utf8");
    return result.filePath;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    title: "Zivar Graph Studio",
    backgroundColor: "#0b0d10",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  mainWindow.on("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, "studio.html"));
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    registerIpc();
    createWindow();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
