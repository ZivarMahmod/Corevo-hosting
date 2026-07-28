const { createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const {
  GraphProject,
  compareProjects,
  comparisonGraph,
  differenceGraph,
  graphFromCsv,
  graphFromSql,
  simulateIntegration,
} = require("./graph-engine.cjs");
const {
  analyzeBranch,
  compactImpact,
  ensureGithubRepository,
} = require("./branch-lens.cjs");

const argv = process.argv.slice(2);
const argument = (name, fallback) => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};
const port = Number(argument("--port", "8768"));
const workspaceRoot = path.resolve(argument("--workspace", path.join(__dirname, "..", "..", "..")));
const codeRoot = path.join(workspaceRoot, "5-Kod");
const graphifyRoot = path.join(codeRoot, "graphify-out");
const eventFile = path.join(graphifyRoot, "studio-events.jsonl");
const stateFile = path.resolve(argument("--state-file", path.join(graphifyRoot, "studio-state.json")));
const branchImpactFile = path.join(graphifyRoot, "studio-branch-impact.json");
const cacheRoot = path.join(graphifyRoot, "studio-web-cache");
const graphLibraryRegistry = path.join(os.homedir(), ".codex", "graphify-library", "registry.json");
const staticFiles = new Map([
  ["/", ["studio.html", "text/html; charset=utf-8"]],
  ["/studio.html", ["studio.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/activity-engine.js", ["activity-engine.js", "text/javascript; charset=utf-8"]],
  ["/brain-layout.js", ["brain-layout.js", "text/javascript; charset=utf-8"]],
  ["/brain-bootstrap.mjs", ["brain-bootstrap.mjs", "text/javascript; charset=utf-8"]],
  ["/brain-graph-3d.mjs", ["brain-graph-3d.mjs", "text/javascript; charset=utf-8"]],
  ["/renderer.js", ["renderer.js", "text/javascript; charset=utf-8"]],
  ["/vendor/three.core.min.js", ["vendor/three.core.min.js", "text/javascript; charset=utf-8"]],
  ["/vendor/three.module.min.js", ["vendor/three.module.min.js", "text/javascript; charset=utf-8"]],
  ["/vendor/OrbitControls.js", ["vendor/OrbitControls.js", "text/javascript; charset=utf-8"]],
]);
const projects = new Map();
const metadata = new Map();
const watchedGraphs = new Map();
let branchImpact = null;

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

function loadGraph(slot, graphPath, options = {}) {
  const project = GraphProject.fromFile(graphPath, options);
  projects.set(slot, project);
  metadata.set(slot, { ...options, graphPath });
  watchedGraphs.set(slot, {
    graphPath,
    modified: fs.statSync(graphPath).mtimeMs,
  });
  appendEvent("load", {
    agent: "Zivar Localhost",
    project: slot,
    action: "load_graph",
    summary: `${project.name}: ${project.summary.nodes} noder och ${project.summary.edges} kopplingar`,
    status: "ok",
  });
  return projectInfo(slot);
}

function readState() {
  if (!fs.existsSync(stateFile) || fs.statSync(stateFile).size > 256 * 1024) return null;
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return null;
  }
}

function loadDefaults() {
  const savedProjects = readState()?.projects || {};
  const defaults = [
    {
      slot: "A",
      graphPath: path.join(graphifyRoot, "graph.json"),
      name: "Corevo",
      sourceRoot: codeRoot,
      libraryProjectId: "corevo",
    },
    {
      slot: "B",
      graphPath: path.join(codeRoot, "graphify-references", "open-design", "graphify-out", "graph.json"),
      name: "Open Design",
      sourceRoot: path.join(workspaceRoot, "4-Dokument-Underlag", "08-externa-verktyg", "open-design"),
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
    if (fs.existsSync(restored.graphPath)) loadGraph(restored.slot, restored.graphPath, restored);
  }
}

function appendEvent(kind, payload = {}) {
  fs.mkdirSync(graphifyRoot, { recursive: true });
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
  const project = projects.get(slot);
  const meta = metadata.get(slot);
  if (!project) return null;
  return {
    slot,
    ...project.summary,
    graphPath: project.graphPath,
    sourceRoot: project.sourceRoot,
    kind: project.kind,
    audit: project.audit(),
    canRefresh: Boolean(meta?.graphPath),
    libraryProjectId: meta?.libraryProjectId || null,
  };
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

function compactState(input = {}) {
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
  return {
    updatedAt: new Date().toISOString(),
    source: "localhost",
    projects: { A: compactProject("A"), B: compactProject("B") },
    view: input.view || null,
    filters: input.filters || null,
    options: input.options || null,
    selection: input.selection || null,
    camera: input.camera || null,
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
}

function writeState(input) {
  const serialized = JSON.stringify(compactState(input), null, 2);
  if (Buffer.byteLength(serialized) > 256 * 1024) throw new Error("Studio-state blev oväntat stor.");
  const temporary = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, serialized, "utf8");
  fs.renameSync(temporary, stateFile);
  return { ok: true };
}

function readRecentEvents(after = "") {
  if (!fs.existsSync(eventFile)) return [];
  const stat = fs.statSync(eventFile);
  const size = Math.min(stat.size, 2 * 1024 * 1024);
  const buffer = Buffer.alloc(size);
  const handle = fs.openSync(eventFile, "r");
  fs.readSync(handle, buffer, 0, size, stat.size - size);
  fs.closeSync(handle);
  const raw = buffer.toString("utf8");
  const text = stat.size > size ? raw.slice(raw.indexOf("\n") + 1) : raw;
  return text.trim().split(/\r?\n/)
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
  const project = projects.get(slot);
  if (!project) return event;
  const sourceFile = event.file
    || event.files?.[0]
    || (event.label && project.byFile.has(event.label) ? event.label : "");
  const fileId = sourceFile ? project.byFile.get(sourceFile)?.[0] : null;
  let node = fileId ? project.byId.get(fileId) : null;
  if (!node && event.label) node = project.byId.get(event.label);
  if (!node && event.label) {
    const result = project.search(event.label, 1)[0];
    node = result ? project.byId.get(result.id) : null;
  }
  const resolvedFile = sourceFile || node?.source_file;
  return {
    ...event,
    target: node ? {
      id: node.id,
      label: node.label,
      sourceFile: node.source_file,
      community: node.community,
    } : resolvedFile ? { sourceFile: resolvedFile } : null,
  };
}

function graphifyInterpreter() {
  const pointer = path.join(graphifyRoot, ".graphify_python");
  if (fs.existsSync(pointer)) {
    const executable = fs.readFileSync(pointer, "utf8").trim();
    if (executable && fs.existsSync(executable)) return executable;
  }
  return process.platform === "win32" ? "python" : "python3";
}

function run(command, args, cwd = codeRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, GRAPHIFY_VIZ_NODE_LIMIT: "0" },
      windowsHide: true,
      shell: false,
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error((output || `${command} avslutades med kod ${code}`).trim().slice(-1500)));
    });
  });
}

function clearBranchImpact() {
  branchImpact = null;
  try {
    fs.unlinkSync(branchImpactFile);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function saveBranchImpact(impact) {
  branchImpact = impact;
  const temporary = `${branchImpactFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(compactImpact(impact), null, 2), "utf8");
  fs.renameSync(temporary, branchImpactFile);
}

async function loadGithub(slot, input) {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(String(input || "").trim());
  if (!match) throw new Error("Använd en publik GitHub-länk i formatet https://github.com/ägare/repo.");
  const [, owner, repository] = match;
  const repositoryRoot = path.join(cacheRoot, "repos", owner, repository);
  fs.mkdirSync(path.dirname(repositoryRoot), { recursive: true });
  if (fs.existsSync(path.join(repositoryRoot, ".git"))) {
    try {
      await run("git", ["-C", repositoryRoot, "pull", "--ff-only"]);
    } catch {
      // The existing clone remains usable when the network is unavailable.
    }
  } else {
    await run("git", ["clone", "--depth", "1", `https://github.com/${owner}/${repository}.git`, repositoryRoot]);
  }
  const key = createHash("sha256").update(repositoryRoot).digest("hex").slice(0, 18);
  const outputRoot = path.join(cacheRoot, "graphs", key);
  const graphPath = path.join(outputRoot, "graphify-out", "graph.json");
  const python = graphifyInterpreter();
  await run(python, [
    "-u", "-m", "graphify", "extract", repositoryRoot,
    "--code-only", "--no-cluster", "--out", outputRoot, "--force",
  ]);
  await run(python, [
    "-u", "-m", "graphify", "cluster-only", outputRoot,
    "--graph", graphPath, "--no-viz", "--no-label",
  ]);
  clearBranchImpact();
  return loadGraph(slot, graphPath, {
    name: repository,
    sourceRoot: repositoryRoot,
    graphPath,
  });
}

async function loadGithubBranch(input, branch, base) {
  const remote = await ensureGithubRepository(cacheRoot, input);
  const result = await analyzeBranch({
    repoRoot: remote.repositoryRoot,
    cacheRoot,
    branch: String(branch || remote.branch || ""),
    base: String(base || ""),
    graphifyPython: graphifyInterpreter(),
    remoteFirst: true,
    name: remote.repository,
  });
  loadGraph("A", result.baseGraphPath, {
    name: `${remote.repository} · ${result.metadata.base}`,
    sourceRoot: result.baseCopy,
    branchLens: true,
  });
  loadGraph("B", result.branchGraphPath, {
    name: `${remote.repository} · ${result.metadata.branch}`,
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

function loadData(slot, fileName, text) {
  const extension = path.extname(fileName).toLowerCase();
  let data;
  if (extension === ".csv") data = graphFromCsv(text, fileName);
  else if (extension === ".sql") data = graphFromSql(text, fileName);
  else data = JSON.parse(text);
  const project = new GraphProject(data, {
    name: path.basename(fileName, extension),
    kind: extension.slice(1) || "json",
  });
  projects.set(slot, project);
  clearBranchImpact();
  metadata.set(slot, { name: project.name, uploaded: true });
  watchedGraphs.delete(slot);
  appendEvent("load", {
    agent: "Zivar Localhost",
    project: slot,
    action: "load_data",
    summary: `${project.name}: ${project.summary.nodes} noder och ${project.summary.edges} kopplingar`,
    status: "ok",
  });
  return projectInfo(slot);
}

function reloadChangedGraphs() {
  for (const [slot, watched] of watchedGraphs) {
    if (!fs.existsSync(watched.graphPath)) continue;
    const modified = fs.statSync(watched.graphPath).mtimeMs;
    if (modified <= watched.modified) continue;
    try {
      loadGraph(slot, watched.graphPath, metadata.get(slot));
      appendEvent("refresh", {
        agent: "Graphify watcher",
        project: slot,
        action: "reload_graph",
        summary: `${projects.get(slot).name} uppdaterades i localhost`,
        status: "ok",
      });
    } catch (error) {
      appendEvent("error", {
        agent: "Zivar Localhost",
        project: slot,
        action: "reload_graph",
        summary: error.message,
        status: "error",
      });
    }
  }
}

function allowedRequest(request) {
  const host = String(request.headers.host || "").toLowerCase();
  const origin = String(request.headers.origin || "").toLowerCase();
  const localHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  if (localHosts.has(host)) return !origin || origin === `http://${host}`;

  const accessAssertion = String(request.headers["cf-access-jwt-assertion"] || "");
  return host === "graph.corevo.se" && Boolean(accessAssertion) && (!origin || origin === "https://graph.corevo.se");
}

function send(response, status, payload, contentType = "application/json; charset=utf-8") {
  const body = Buffer.isBuffer(payload)
    ? payload
    : contentType.startsWith("application/json")
      ? Buffer.from(JSON.stringify(payload))
      : Buffer.from(String(payload));
  response.writeHead(status, {
    "Content-Type": contentType,
    "Content-Length": body.length,
    "Cache-Control": contentType.startsWith("text/") ? "no-cache" : "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 50 * 1024 * 1024) {
        reject(new Error("Anropet är större än 50 MB."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new Error("Anropet innehåller ogiltig JSON."));
      }
    });
    request.on("error", reject);
  });
}

async function apiCall(route, body) {
  const slot = body.slot === "B" ? "B" : "A";
  const project = projects.get(slot);
  if (route === "/api/bootstrap") {
    return {
      version: "0.1.0",
      runtime: "web",
      workspaceRoot,
      projects: { A: projectInfo("A"), B: projectInfo("B") },
      libraryProjects: graphLibraryProjects(),
      mcp: { name: "zivar-graph-studio", url: "http://127.0.0.1:8767/mcp" },
      activity: readRecentEvents(),
      branchImpact: branchImpact ? compactImpact(branchImpact) : null,
      savedState: readState(),
    };
  }
  if (route === "/api/get-view") {
    if (!project) throw new Error(`Projekt ${slot} är inte laddat.`);
    const { slot: _slot, ...request } = body;
    return project.view(request);
  }
  if (route === "/api/get-node") return project?.nodeDetails(String(body.id)) || null;
  if (route === "/api/search") return project?.search(String(body.query), 40) || [];
  if (route === "/api/compare") return compareProjects(projects.get("A"), projects.get("B"));
  if (route === "/api/comparison-graph") {
    if (branchImpact?.graph) return branchImpact.graph;
    return body.diffOnly
      ? differenceGraph(projects.get("A"), projects.get("B"))
      : comparisonGraph(projects.get("A"), projects.get("B"));
  }
  if (route === "/api/simulate") return simulateIntegration(projects.get("A"), projects.get("B"), body.aId, body.bId);
  if (route === "/api/get-activity") return readRecentEvents(body.after);
  if (route === "/api/update-state") return writeState(body);
  if (route === "/api/load-data") return loadData(slot, String(body.fileName || "data.json"), String(body.text || ""));
  if (route === "/api/load-library-project") return loadLibraryProject(slot, String(body.projectId || ""));
  if (route === "/api/load-github") return loadGithub(slot, body.url);
  if (route === "/api/load-github-branch") return loadGithubBranch(body.url, body.branch, body.base);
  if (route === "/api/branch-impact") return branchImpact ? compactImpact(branchImpact) : null;
  if (route === "/api/refresh-project") {
    const meta = metadata.get(slot);
    if (!meta?.graphPath) throw new Error(`Projekt ${slot} saknar en omladdningsbar graf.`);
    return loadGraph(slot, meta.graphPath, meta);
  }
  if (route === "/api/export-report") {
    return {
      exportedAt: new Date().toISOString(),
      projects: { A: projectInfo("A"), B: projectInfo("B") },
      comparison: compareProjects(projects.get("A"), projects.get("B")),
    };
  }
  throw new Error("Okänd API-väg.");
}

clearBranchImpact();
loadDefaults();
setInterval(reloadChangedGraphs, 3500).unref();

const server = http.createServer(async (request, response) => {
  if (!allowedRequest(request)) {
    send(response, 403, { ok: false, error: "Endast lokal loopback är tillåten." });
    return;
  }
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/health") {
    send(response, 200, {
      ok: true,
      service: "zivar-graph-studio",
      projects: { A: projects.get("A")?.summary || null, B: projects.get("B")?.summary || null },
      mcp: "http://127.0.0.1:8767/mcp",
    });
    return;
  }
  if (request.method === "GET" && staticFiles.has(url.pathname)) {
    const [file, contentType] = staticFiles.get(url.pathname);
    send(response, 200, fs.readFileSync(path.join(__dirname, file)), contentType);
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    try {
      const body = request.method === "POST" ? await readBody(request) : {};
      send(response, 200, { ok: true, value: await apiCall(url.pathname, body) });
    } catch (error) {
      send(response, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  send(response, 404, { ok: false, error: "Sidan finns inte." });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Zivar Graph Studio: http://127.0.0.1:${port}/`);
});
