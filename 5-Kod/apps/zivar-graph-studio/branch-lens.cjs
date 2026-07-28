const { createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { GraphProject } = require("./graph-engine.cjs");

const TEST_FILE = /(^|\/)(?:__tests__|tests?|spec)(?:\/|$)|\.(?:test|spec)\.[^/]+$/i;
const EMPTY_HOOKS = path.join(os.tmpdir(), "zivar-studio-empty-git-hooks");
fs.mkdirSync(EMPTY_HOOKS, { recursive: true });

function run(command, args, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GRAPHIFY_VIZ_NODE_LIMIT: "0",
        ...extraEnv,
      },
      windowsHide: true,
      shell: false,
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      if (output.length < 4_000_000) output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      if (output.length < 4_000_000) output += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error((output || `${command} avslutades med kod ${code}`).trim().slice(-1800)));
    });
  });
}

function parseGithubUrl(input) {
  let url;
  try {
    url = new URL(String(input || "").trim());
  } catch {
    throw new Error("Använd en publik GitHub-länk i formatet https://github.com/ägare/repo.");
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.search || url.hash) {
    throw new Error("Endast publika https://github.com-länkar stöds.");
  }
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length < 2 || !/^[A-Za-z0-9_.-]+$/.test(parts[0])) {
    throw new Error("GitHub-länken saknar ägare eller repository.");
  }
  const repository = parts[1].replace(/\.git$/i, "");
  if (!/^[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("Repository-namnet är ogiltigt.");
  if (parts.length > 2 && parts[2] !== "tree") throw new Error("GitHub-länken får bara innehålla repository eller /tree/branch.");
  return {
    owner: parts[0],
    repository,
    branch: parts[2] === "tree" ? parts.slice(3).join("/") : "",
    cloneUrl: `https://github.com/${parts[0]}/${repository}.git`,
  };
}

function validateRef(value, optional = false) {
  const ref = String(value || "").trim();
  if (!ref && optional) return "";
  if (
    !ref
    || ref.length > 240
    || ref.startsWith("-")
    || ref.endsWith(".")
    || ref.endsWith("/")
    || ref.includes("..")
    || ref.includes("@{")
    || /[\x00-\x20~^:?*[\]\\]/.test(ref)
  ) throw new Error(`Ogiltig Git-referens: ${ref || "(tom)"}`);
  return ref;
}

function normalizeFile(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\.?\//, "").toLowerCase();
}

function parseNameStatus(text) {
  const entries = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line) continue;
    const fields = line.split("\t");
    const code = fields[0];
    const type = code[0];
    if (type === "R" || type === "C") {
      if (fields.length >= 3) entries.push({
        status: type === "R" ? "renamed" : "copied",
        score: Number(code.slice(1)) || 0,
        oldPath: fields[1],
        path: fields[2],
      });
    } else if (fields[1]) {
      entries.push({
        status: { A: "added", M: "modified", D: "deleted", T: "type-changed" }[type] || "changed",
        path: fields[1],
      });
    }
  }
  return entries;
}

async function git(repoRoot, args) {
  return run("git", [
    "-c", "core.longpaths=true",
    "-c", `core.hooksPath=${EMPTY_HOOKS}`,
    "-C", repoRoot,
    ...args,
  ], repoRoot);
}

async function publicGit(repoRoot, args) {
  return run("git", [
    "-c", `core.hooksPath=${EMPTY_HOOKS}`,
    "-c", "core.longpaths=true",
    "-c", "credential.helper=",
    "-c", "http.https://github.com/.extraheader=",
    "-C", repoRoot,
    ...args,
  ], repoRoot);
}

async function resolveFirst(repoRoot, candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      const sha = await git(repoRoot, ["rev-parse", "--verify", "--end-of-options", `${candidate}^{commit}`]);
      if (/^[0-9a-f]{40}$/i.test(sha)) return { ref: candidate, sha: sha.toLowerCase() };
    } catch {
      // Try the next explicit, validated ref.
    }
  }
  return null;
}

async function remoteDefault(repoRoot) {
  try {
    return await git(repoRoot, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"]);
  } catch {
    return "";
  }
}

function refCandidates(ref, remoteFirst = false) {
  if (!ref) return [];
  if (ref.startsWith("refs/")) return [ref];
  const clean = ref.startsWith("origin/") ? ref.slice("origin/".length) : ref;
  const local = [`refs/heads/${clean}`, clean];
  const remote = [`refs/remotes/origin/${clean}`, `origin/${clean}`];
  return remoteFirst ? [...remote, ...local] : [...local, ...remote];
}

async function inspectRepository(repoRoot, branchInput = "", baseInput = "", remoteFirst = false) {
  const root = path.resolve(await git(repoRoot, ["rev-parse", "--show-toplevel"]));
  const defaultRef = await remoteDefault(root);
  const branch = validateRef(branchInput, true);
  const base = validateRef(baseInput, true);
  const head = await resolveFirst(root, branch ? refCandidates(branch, remoteFirst) : remoteFirst
    ? [defaultRef, "refs/remotes/origin/main", "origin/main", "HEAD"]
    : ["HEAD"]);
  if (!head) throw new Error(`Branchen hittades inte: ${branch || "HEAD"}.`);
  const basePlan = await resolveFirst(root, base
    ? refCandidates(base, remoteFirst)
    : ["refs/remotes/origin/main", "origin/main", "refs/heads/main", "main", defaultRef]);
  if (!basePlan) throw new Error("Ingen bas hittades. Ange en base-branch uttryckligen.");
  let mergeBase = basePlan.sha;
  try {
    const candidate = await git(root, ["merge-base", basePlan.sha, head.sha]);
    if (/^[0-9a-f]{40}$/i.test(candidate)) mergeBase = candidate.toLowerCase();
  } catch {
    // Unrelated histories compare from the selected base commit.
  }
  const diff = parseNameStatus(await git(root, [
    "diff", "--name-status", "-M", "--find-renames", mergeBase, head.sha, "--",
  ]));
  return {
    repoRoot: root,
    base: basePlan.ref,
    branch: head.ref,
    baseSha: basePlan.sha,
    branchSha: head.sha,
    mergeBase,
    files: diff,
  };
}

async function ensureGithubRepository(cacheRoot, input) {
  const parsed = parseGithubUrl(input);
  const repositoryRoot = path.join(cacheRoot, "repos", parsed.owner, parsed.repository);
  fs.mkdirSync(path.dirname(repositoryRoot), { recursive: true });
  if (!fs.existsSync(path.join(repositoryRoot, ".git"))) {
    await run("git", [
      "-c", `core.hooksPath=${EMPTY_HOOKS}`,
      "-c", "core.longpaths=true",
      "-c", "credential.helper=",
      "-c", "http.https://github.com/.extraheader=",
      "clone", "--no-checkout", parsed.cloneUrl, repositoryRoot,
    ], cacheRoot);
  } else {
    await publicGit(repositoryRoot, ["remote", "set-url", "origin", parsed.cloneUrl]);
  }
  await publicGit(repositoryRoot, [
    "fetch", "--prune", "origin",
    "+refs/heads/*:refs/remotes/origin/*",
  ]);
  return { ...parsed, repositoryRoot };
}

function repositoryKey(repoRoot) {
  return createHash("sha256").update(path.resolve(repoRoot).toLowerCase()).digest("hex").slice(0, 18);
}

async function ensureRevisionCopy(repoRoot, cacheRoot, key, sha) {
  const revisionRoot = path.join(cacheRoot, "revisions", key, sha);
  if (!fs.existsSync(path.join(revisionRoot, ".git"))) {
    fs.mkdirSync(path.dirname(revisionRoot), { recursive: true });
    await run("git", [
      "-c", `core.hooksPath=${EMPTY_HOOKS}`,
      "-c", "core.longpaths=true",
      "clone", "--shared", "--no-checkout", repoRoot, revisionRoot,
    ], cacheRoot);
  }
  await git(revisionRoot, ["checkout", "--detach", "--force", sha]);
  const actual = await git(revisionRoot, ["rev-parse", "HEAD"]);
  if (actual.toLowerCase() !== sha.toLowerCase()) throw new Error("Den cachade Git-kopian pekar på fel commit.");
  return revisionRoot;
}

async function ensureGraph(sourceRoot, cacheRoot, key, sha, python) {
  const outputRoot = path.join(cacheRoot, "graphs", key, sha);
  const graphPath = path.join(outputRoot, "graphify-out", "graph.json");
  if (fs.existsSync(graphPath)) return graphPath;
  fs.mkdirSync(outputRoot, { recursive: true });
  await run(python, [
    "-u", "-m", "graphify", "extract", sourceRoot,
    "--code-only", "--no-cluster", "--out", outputRoot, "--force",
  ], outputRoot);
  await run(python, [
    "-u", "-m", "graphify", "cluster-only", outputRoot,
    "--graph", graphPath, "--no-viz", "--no-label",
  ], outputRoot);
  return graphPath;
}

function viewNode(project, side, id, changeStatus, distance) {
  const node = project.byId.get(id);
  return {
    id: `${side}:${id}`,
    originalId: id,
    label: node.label,
    subtitle: node.source_file || node.file_type,
    kind: node.file_type,
    community: node.community,
    communityName: node.community_name,
    sourceFile: node.source_file,
    degree: project.degree.get(id) || 0,
    size: 1 + Math.log2((project.degree.get(id) || 0) + 1),
    cluster: node.source_file?.split(/[\\/]/)[0] || node.file_type,
    project: side,
    changeStatus,
    impactDistance: distance,
  };
}

function buildBranchImpact(baseProject, branchProject, metadata, maxNodes = 240) {
  const changedFiles = metadata.files || [];
  const direct = [];
  const seeds = { A: new Map(), B: new Map() };
  const addFileNodes = (project, side, filePath, status) => {
    const wanted = normalizeFile(filePath);
    for (const [sourceFile, ids] of project.byFile) {
      if (normalizeFile(sourceFile) !== wanted) continue;
      for (const id of ids) {
        const key = `${side}:${id}`;
        if (!seeds[side].has(id)) {
          seeds[side].set(id, { status, path: filePath });
          direct.push({
            id: key,
            side,
            nodeId: id,
            label: project.byId.get(id).label,
            sourceFile,
            status,
          });
        }
      }
    }
  };
  for (const file of changedFiles) {
    if (file.status === "deleted" || file.status === "renamed" || file.status === "copied") {
      addFileNodes(baseProject, "A", file.oldPath || file.path, file.status);
    }
    if (file.status !== "deleted") addFileNodes(branchProject, "B", file.path, file.status);
  }

  const affected = [];
  const selected = new Map();
  const walk = (project, side) => {
    const seen = new Map();
    let frontier = [...seeds[side].keys()].map((id) => ({ id, distance: 0, relation: "changed", from: id }));
    for (const item of frontier) seen.set(item.id, item);
    for (let depth = 0; depth <= 2 && frontier.length; depth += 1) {
      const next = [];
      for (const item of frontier) {
        const seed = seeds[side].get(item.id);
        const status = seed?.status || "impacted";
        selected.set(`${side}:${item.id}`, { side, ...item, status });
        if (item.distance > 0) {
          const node = project.byId.get(item.id);
          affected.push({
            id: `${side}:${item.id}`,
            side,
            nodeId: item.id,
            label: node.label,
            sourceFile: node.source_file,
            distance: item.distance,
            relation: item.relation,
            from: item.from,
          });
        }
        if (item.distance >= 2) continue;
        for (const adjacent of project.adjacency.get(item.id) || []) {
          const prior = seen.get(adjacent.other);
          if (prior && prior.distance <= item.distance + 1) continue;
          const edge = project.links[adjacent.edge];
          const candidate = {
            id: adjacent.other,
            distance: item.distance + 1,
            relation: edge.relation,
            from: item.id,
          };
          seen.set(adjacent.other, candidate);
          next.push(candidate);
        }
      }
      frontier = next;
    }
  };
  walk(baseProject, "A");
  walk(branchProject, "B");

  const ordered = [...selected.values()]
    .sort((a, b) => a.distance - b.distance
      || ((b.side === "A" ? baseProject : branchProject).degree.get(b.id) || 0)
        - ((a.side === "A" ? baseProject : branchProject).degree.get(a.id) || 0))
    .slice(0, Math.max(1, Number(maxNodes) || 240));
  const included = new Set(ordered.map((item) => `${item.side}:${item.id}`));
  const nodes = ordered.map((item) => viewNode(
    item.side === "A" ? baseProject : branchProject,
    item.side,
    item.id,
    item.status,
    item.distance,
  ));
  const edges = [];
  for (const [side, project] of [["A", baseProject], ["B", branchProject]]) {
    for (let index = 0; index < project.links.length; index += 1) {
      const edge = project.links[index];
      if (!included.has(`${side}:${edge.source}`) || !included.has(`${side}:${edge.target}`)) continue;
      edges.push({
        id: `${side}:edge:${index}`,
        source: `${side}:${edge.source}`,
        target: `${side}:${edge.target}`,
        relation: edge.relation,
        confidence: edge.confidence,
        weight: edge.weight,
        count: 1,
        label: edge.relation,
      });
    }
  }
  const allImpact = [...direct, ...affected];
  const tests = [...new Map(allImpact
    .filter((item) => TEST_FILE.test(String(item.sourceFile || "")))
    .map((item) => [normalizeFile(item.sourceFile), {
      side: item.side,
      sourceFile: item.sourceFile,
      distance: item.distance || 0,
      reason: "möjligen berörd via verklig grafrelation",
    }])).values()];
  const communities = new Set();
  const hubs = [];
  for (const item of ordered) {
    const project = item.side === "A" ? baseProject : branchProject;
    const node = project.byId.get(item.id);
    communities.add(`${item.side}:${node.community}`);
    if ((project.degree.get(item.id) || 0) >= project.summary.p95Degree) hubs.push({
      side: item.side,
      id: item.id,
      label: node.label,
      sourceFile: node.source_file,
      degree: project.degree.get(item.id) || 0,
    });
  }
  return {
    base: metadata.base,
    branch: metadata.branch,
    mergeBase: metadata.mergeBase,
    baseSha: metadata.baseSha,
    branchSha: metadata.branchSha,
    changedFiles,
    directNodes: direct,
    affectedNodes: affected,
    possibleTests: tests,
    communityCount: communities.size,
    hubs,
    graph: {
      mode: "comparison",
      branchLens: true,
      title: `${metadata.base} ↔ ${metadata.branch}`,
      breadcrumb: ["Branch Lens", metadata.base, metadata.branch],
      nodes,
      edges,
      summary: {
        nodes: nodes.length,
        edges: edges.length,
        changedFiles: changedFiles.length,
        directNodes: direct.length,
        affectedNodes: affected.length,
      },
    },
  };
}

function compactImpact(impact) {
  const { graph: _graph, ...compact } = impact;
  return compact;
}

async function analyzeBranch({
  repoRoot,
  cacheRoot,
  branch,
  base,
  graphifyPython,
  remoteFirst = false,
  name = "",
}) {
  const metadata = await inspectRepository(repoRoot, branch, base, remoteFirst);
  const key = repositoryKey(metadata.repoRoot);
  const baseCopy = await ensureRevisionCopy(metadata.repoRoot, cacheRoot, key, metadata.baseSha);
  const branchCopy = metadata.branchSha === metadata.baseSha
    ? baseCopy
    : await ensureRevisionCopy(metadata.repoRoot, cacheRoot, key, metadata.branchSha);
  const baseGraphPath = await ensureGraph(baseCopy, cacheRoot, key, metadata.baseSha, graphifyPython);
  const branchGraphPath = metadata.branchSha === metadata.baseSha
    ? baseGraphPath
    : await ensureGraph(branchCopy, cacheRoot, key, metadata.branchSha, graphifyPython);
  const baseProject = GraphProject.fromFile(baseGraphPath, {
    name: `${name || path.basename(metadata.repoRoot)} · ${metadata.base}`,
    sourceRoot: baseCopy,
  });
  const branchProject = GraphProject.fromFile(branchGraphPath, {
    name: `${name || path.basename(metadata.repoRoot)} · ${metadata.branch}`,
    sourceRoot: branchCopy,
  });
  const impact = buildBranchImpact(baseProject, branchProject, metadata);
  return {
    metadata,
    baseCopy,
    branchCopy,
    baseGraphPath,
    branchGraphPath,
    baseProject,
    branchProject,
    impact,
  };
}

module.exports = {
  analyzeBranch,
  buildBranchImpact,
  compactImpact,
  ensureGithubRepository,
  inspectRepository,
  parseGithubUrl,
  parseNameStatus,
  validateRef,
};
