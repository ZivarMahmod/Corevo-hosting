const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
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
  LEASE_MS,
  activityTargets,
  expandActivityEvents,
  findPath,
  heatAt,
  isLeaseActive,
  latestActivityPass,
} = require("./activity-engine.js");
const {
  buildBranchImpact,
  inspectRepository,
  parseNameStatus,
} = require("./branch-lens.cjs");
const { brainBounds, brainLayout } = require("./brain-layout.js");
const { operationRequest } = require("./studio-v1-client.cjs");

const left = new GraphProject({
  nodes: [
    { id: "a", label: "App", source_file: "src/app.ts", community: 1, community_name: "App" },
    { id: "b", label: "Store", source_file: "src/store.ts", community: 1, community_name: "App" },
    { id: "c", label: "Unused", source_file: "src/unused.ts", community: 2, community_name: "Unused" },
  ],
  links: [{
    source: "a",
    target: "b",
    relation: "calls",
    confidence: "EXTRACTED",
    confidence_score: 0.98,
    source_file: "src/app.ts",
    source_location: "L12",
    context: "App calls Store",
  }],
}, { name: "Left" });
const right = new GraphProject({
  nodes: [
    { id: "x", label: "App", source_file: "web/app.ts", community: 5, community_name: "Web" },
    { id: "y", label: "Database", source_file: "web/db.ts", community: 6, community_name: "Data" },
  ],
  links: [{ source: "x", target: "y", relation: "calls", confidence: "EXTRACTED" }],
}, { name: "Right" });
const weighted = new GraphProject({
  nodes: [
    { id: "w1", label: "A", community: 1 },
    { id: "w2", label: "B", community: 1 },
    { id: "w3", label: "C", community: 2 },
  ],
  links: [
    { source: "w1", target: "w3", relation: "calls", confidence: "EXTRACTED" },
    { source: "w2", target: "w3", relation: "calls", confidence: "EXTRACTED" },
  ],
}, { name: "Weighted" });

assert.equal(left.summary.nodes, 3);
assert.equal(left.summary.isolates, 1);
assert.equal(left.overview().nodes.length, 2);
assert.equal(left.neighborhood("a").nodes.length, 2);
assert.deepEqual(
  left.nodeDetails("a").neighbors[0],
  {
    id: "b",
    label: "Store",
    sourceFile: "src/store.ts",
    relation: "calls",
    confidence: "EXTRACTED",
    confidenceScore: 0.98,
    direction: "out",
    degree: 1,
    evidence: {
      sourceFile: "src/app.ts",
      sourceLocation: "L12",
      context: "App calls Store",
    },
  },
);
assert.equal(left.neighborhood("a", { minWeight: 3 }).nodes.length, 2);
assert.equal(weighted.overview({ minWeight: 2 }).edges.length, 1);
assert.equal(weighted.overview({ minWeight: 3 }).edges.length, 0);
assert.equal(compareProjects(left, right).exactMatches[0].label, "App");
const fullComparison = comparisonGraph(left, right);
assert.equal(fullComparison.nodes.length, 4);
assert.equal(fullComparison.nodes.some((node) => node.id === "A:community:2"), true);
assert.equal(fullComparison.edges.some((edge) => edge.id.startsWith("B:") && edge.relation === "calls"), true);
assert.equal(fullComparison.edges.some((edge) => edge.relation === "exact_label_match"), true);
const differences = differenceGraph(left, right);
assert.equal(differences.diffLens, true);
assert.equal(differences.nodes.some((node) => node.label === "Unused" && node.changeStatus === "deleted"), true);
assert.equal(differences.nodes.some((node) => node.label === "Database" && node.changeStatus === "added"), true);
assert.equal(differences.nodes.some((node) => node.label === "App"), false);
assert.equal(simulateIntegration(left, right, "a", "x").risk >= 35, true);
assert.equal(graphFromCsv("source,target,relation\na,b,calls\n").links.length, 1);
assert.equal(graphFromSql("CREATE TABLE a (id int); CREATE TABLE b (a_id int REFERENCES a(id));").nodes.length, 2);
assert.deepEqual(
  operationRequest("snapshotCatalog", { projectId: "corevo/main" }),
  {
    method: "GET",
    path: "/api/v1/snapshots?projectId=corevo%2Fmain&limit=100",
    timeout: 2500,
  },
);
assert.deepEqual(
  operationRequest("activity", { after: "1785408889093.27789" }),
  {
    method: "GET",
    path: "/api/v1/activity?after=1785408889093.27789",
    timeout: 2500,
  },
);
assert.throws(() => operationRequest("restore", {}), /inte tillåten/);

const preferred = findPath([
  { source: "a", target: "b", confidence: "EXTRACTED", weight: 2 },
  { source: "b", target: "c", confidence: "EXTRACTED", weight: 2 },
  { source: "a", target: "d", confidence: "INFERRED", weight: 20 },
  { source: "d", target: "c", confidence: "INFERRED", weight: 20 },
], "a", "c");
assert.deepEqual(preferred.nodes, ["a", "b", "c"]);
const longChain = Array.from({ length: 13 }, (_, index) => ({
  source: `n${index}`,
  target: `n${index + 1}`,
  confidence: "EXTRACTED",
}));
assert.equal(findPath(longChain, "n0", "n13", 12), null);
assert.equal(findPath([{ source: "a", target: "b" }], "a", "z"), null);
assert.equal(heatAt([{ time: 0 }], 120_000, 120_000), 0.5);
assert.equal(heatAt([{ time: 0 }, { time: 60_000 }], 120_000, 120_000) > 1, true);
assert.equal(isLeaseActive({ timestamp: new Date(0).toISOString() }, LEASE_MS - 1), true);
assert.equal(isLeaseActive({ timestamp: new Date(0).toISOString() }, LEASE_MS + 1), false);
assert.deepEqual(
  activityTargets({ label: "renderActivity()", file: "renderer.js", files: ["renderer.js", "styles.css"] }),
  [
    { label: "renderActivity()", sourceFile: "renderer.js" },
    { sourceFile: "styles.css" },
  ],
);
assert.deepEqual(
  activityTargets({
    nodes: [
      { id: "a", label: "App", source_file: "src/app.ts" },
      { id: "b", label: "Store", sourceFile: "src/store.ts" },
    ],
  }),
  [
    { id: "a", label: "App", sourceFile: "src/app.ts" },
    { id: "b", label: "Store", sourceFile: "src/store.ts" },
  ],
);
assert.equal(expandActivityEvents([{ kind: "change", files: ["a.js", "b.js"] }]).length, 2);
const pass = latestActivityPass([
  { timestamp: "2026-07-27T08:00:00.000Z" },
  { timestamp: "2026-07-27T08:05:00.000Z" },
  { timestamp: "2026-07-27T08:35:00.000Z" },
]);
assert.deepEqual([pass.start, pass.end, pass.events.length], [2, 2, 1]);

const brainNodes = [
  { id: "a1", community: 1, project: "A" },
  { id: "a2", community: 2, project: "A" },
  { id: "b1", community: 3, project: "B" },
  { id: "b2", community: 4, project: "B" },
];
const integratedBrain = brainLayout(brainNodes, { mode: "comparison" });
assert.deepEqual(
  [...brainLayout(brainNodes, { mode: "comparison" })],
  [...integratedBrain],
);
assert.equal(["a1", "a2"].every((id) => integratedBrain.get(id).x < 0), true);
assert.equal(["b1", "b2"].every((id) => integratedBrain.get(id).x > 0), true);
assert.equal(
  [...integratedBrain.values()].every((point) => [point.x, point.y, point.z].every(Number.isFinite)),
  true,
);
const splitBrain = brainLayout(brainNodes, { mode: "comparison", split: true });
assert.equal(Math.max(splitBrain.get("a1").x, splitBrain.get("a2").x) < 0, true);
assert.equal(Math.min(splitBrain.get("b1").x, splitBrain.get("b2").x) > 0, true);
assert.equal(brainBounds(splitBrain).radius > brainBounds(integratedBrain).radius, true);

const baseBranchProject = new GraphProject({
  nodes: [
    { id: "base-a", label: "A", source_file: "src/a.ts", community: 1 },
    { id: "base-old", label: "Old", source_file: "src/old.ts", community: 1 },
    { id: "base-delete", label: "Delete", source_file: "src/delete.ts", community: 2 },
    { id: "base-test", label: "ATest", source_file: "tests/a.test.ts", community: 1 },
  ],
  links: [{ source: "base-a", target: "base-test", relation: "tested_by", confidence: "EXTRACTED" }],
}, { name: "Base" });
const headBranchProject = new GraphProject({
  nodes: [
    { id: "head-a", label: "A", source_file: "src/a.ts", community: 1 },
    { id: "head-new", label: "New", source_file: "src/new.ts", community: 2 },
    { id: "head-renamed", label: "Old", source_file: "src/new-name.ts", community: 1 },
    { id: "head-test", label: "ATest", source_file: "tests/a.test.ts", community: 1 },
  ],
  links: [{ source: "head-a", target: "head-test", relation: "tested_by", confidence: "EXTRACTED" }],
}, { name: "Head" });
const branchMetadata = {
  base: "main",
  branch: "feature",
  baseSha: "a".repeat(40),
  branchSha: "b".repeat(40),
  mergeBase: "a".repeat(40),
  files: [
    { status: "modified", path: "src/a.ts" },
    { status: "added", path: "src/new.ts" },
    { status: "deleted", path: "src/delete.ts" },
    { status: "renamed", oldPath: "src/old.ts", path: "src/new-name.ts" },
  ],
};
const branchImpact = buildBranchImpact(baseBranchProject, headBranchProject, branchMetadata);
assert.equal(branchImpact.changedFiles.length, 4);
assert.equal(branchImpact.directNodes.some((node) => node.status === "deleted" && node.side === "A"), true);
assert.equal(branchImpact.directNodes.some((node) => node.status === "added" && node.side === "B"), true);
assert.equal(branchImpact.affectedNodes.every((node) => node.distance <= 2), true);
assert.equal(branchImpact.possibleTests.some((test) => test.sourceFile === "tests/a.test.ts"), true);
assert.deepEqual(parseNameStatus("M\tsrc/a.ts\nA\tsrc/new.ts\nD\tsrc/delete.ts\nR100\tsrc/old.ts\tsrc/new-name.ts\n")
  .map((item) => item.status), ["modified", "added", "deleted", "renamed"]);

function git(repo, args) {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout).trim());
  return result.stdout.trim();
}

async function checkGitInspection() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "zivar-branch-lens-"));
  try {
    git(temporary, ["init", "-b", "main"]);
    git(temporary, ["config", "user.email", "studio@example.invalid"]);
    git(temporary, ["config", "user.name", "Studio Self Check"]);
    fs.mkdirSync(path.join(temporary, "src"));
    fs.writeFileSync(path.join(temporary, "src", "a.ts"), "export const a = 1;\n");
    fs.writeFileSync(path.join(temporary, "src", "old.ts"), "export const oldName = true;\n");
    fs.writeFileSync(path.join(temporary, "src", "delete.ts"), "export const removeMe = true;\n");
    git(temporary, ["add", "."]);
    git(temporary, ["commit", "-m", "base"]);
    git(temporary, ["checkout", "-b", "feature"]);
    fs.writeFileSync(path.join(temporary, "src", "a.ts"), "export const a = 2;\n");
    fs.writeFileSync(path.join(temporary, "src", "new.ts"), "export const added = true;\n");
    git(temporary, ["mv", "src/old.ts", "src/new-name.ts"]);
    git(temporary, ["rm", "src/delete.ts"]);
    git(temporary, ["add", "."]);
    git(temporary, ["commit", "-m", "feature"]);
    const before = git(temporary, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const inspected = await inspectRepository(temporary, "feature", "main");
    const after = git(temporary, ["rev-parse", "--abbrev-ref", "HEAD"]);
    assert.equal(before, "feature");
    assert.equal(after, before);
    assert.deepEqual(
      [...new Set(inspected.files.map((item) => item.status))].sort(),
      ["added", "deleted", "modified", "renamed"],
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

checkGitInspection()
  .then(() => console.log("Zivar Graph Studio engine self-check: OK"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
