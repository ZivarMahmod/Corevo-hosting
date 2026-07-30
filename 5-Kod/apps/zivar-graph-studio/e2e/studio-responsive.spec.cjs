const { expect, test } = require("@playwright/test");

async function layoutMetrics(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#graph-canvas");
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const width = context.drawingBufferWidth;
    const height = context.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
    let visiblePixels = 0;
    let yellowPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 65) visiblePixels += 1;
      if (pixels[index] > 150 && pixels[index + 1] > 115 && pixels[index + 2] < 125) yellowPixels += 1;
    }
    return {
      bodyWidth: document.body.clientWidth,
      scrollWidth: document.body.scrollWidth,
      canvas: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      visiblePixels,
      yellowPixels,
    };
  });
}

async function waitForVisibleGraph(page) {
  await expect.poll(async () => (await layoutMetrics(page)).visiblePixels).toBeGreaterThan(500);
}

async function canvasSignature(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#graph-canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    const width = context.drawingBufferWidth;
    const height = context.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    context.readPixels(0, 0, width, height, context.RGBA, context.UNSIGNED_BYTE, pixels);
    let signature = 0;
    const stride = Math.max(4, Math.floor(pixels.length / 6000 / 4) * 4);
    for (let index = 0; index < pixels.length; index += stride) {
      signature = (signature + pixels[index] * 3 + pixels[index + 1] * 5 + pixels[index + 2] * 7) >>> 0;
    }
    return signature;
  });
}

const catalogProject = {
  id: "firs-r-sas",
  name: "Corevo",
  description: "Corevo source graph",
  projectType: "code_graph",
  visibility: "local_private",
  lifecycleStatus: "active",
  currentSnapshotId: "corevo-current",
  metadata: {},
};

const catalogSnapshot = {
  id: "corevo-current",
  projectId: "firs-r-sas",
  status: "ready",
  sourceBranch: "main",
  sourceCommit: "a".repeat(40),
  sourceDirty: false,
  sourceFingerprint: "corevo-fixture",
  adapterVersion: "1.0.0",
  adapterConfigHash: "fixture",
  graphSchemaVersion: "1",
  builtAt: "2026-07-30T08:00:00.000Z",
  importedAt: "2026-07-30T08:00:00.000Z",
  nodeCount: 5711,
  edgeCount: 16118,
  groupCount: 20,
  fileCount: 1000,
  statistics: {},
  warnings: [],
};

const readerPacket = {
  schemaVersion: "1.0",
  requestId: "reader-ui",
  packetId: "packet-1",
  question: "Var används currentTenant?",
  intents: ["context"],
  scope: {
    projects: [{ id: "firs-r-sas", name: "Corevo", visibility: "local_private" }],
    snapshots: [{ id: "corevo-current", projectId: "firs-r-sas", current: true }],
    concepts: [],
  },
  answer: {
    summary: "currentTenant används av portalens autentiserade flöden.",
    status: "answered",
    confidenceKind: "extracted",
    confidenceScore: 0.91,
  },
  claims: [],
  areas: [],
  flows: [],
  decisions: [],
  findings: [],
  risks: [],
  graphContext: { projects: [], totalNodes: 71, totalEdges: 70 },
  evidence: [{
    id: "ev-current-tenant",
    kind: "stored",
    projectId: "firs-r-sas",
    snapshotId: "corevo-current",
    evidenceType: "file_range",
    role: "supports",
    sourceFile: "apps/web/lib/tenant-data.ts",
    startLine: 423,
    endLine: 423,
  }],
  comparisons: [],
  freshness: {
    status: "fresh",
    reasons: ["Vald snapshot är current."],
    snapshots: [{
      projectId: "firs-r-sas",
      selectedSnapshotId: "corevo-current",
      currentSnapshotId: "corevo-current",
      current: true,
    }],
  },
  contradictions: [],
  nextChecks: [],
  limits: { truncated: false, omittedItems: 0, maxChars: 8000 },
};

const knowledgeRecord = {
  id: "finding-current-tenant",
  recordId: "finding-current-tenant",
  projectId: "firs-r-sas",
  title: "Tenant-kontext",
  recordType: "finding",
  status: "verified",
  summary: "Tenant hämtas från verifierad sessionskontext.",
  evidence: [{
    id: "ev-current-tenant",
    kind: "stored",
    evidenceType: "file_range",
    role: "supports",
    sourceFile: "apps/web/lib/tenant-data.ts",
    startLine: 423,
    endLine: 423,
  }],
  currentRevision: {
    revisionNumber: 1,
    bodyMarkdown: "Verifierad tenant-kontext.",
  },
  metadata: { knowledgeV1: { freshness: { status: "fresh" } } },
};

async function mockStudioV1(page, options = {}) {
  const calls = [];
  const jobs = [{
    id: "job-running",
    jobType: "refresh",
    projectId: "firs-r-sas",
    adapterInstanceId: "graphify",
    status: "running",
    progress: 0.45,
    message: "Bygger graf",
    input: { sourceId: "corevo-source" },
    result: null,
    error: null,
    createdAt: "2026-07-30T08:00:00.000Z",
    startedAt: "2026-07-30T08:00:01.000Z",
    finishedAt: null,
  }, {
    id: "job-failed",
    jobType: "refresh",
    projectId: "firs-r-sas",
    adapterInstanceId: "graphify",
    status: "failed",
    progress: 0.7,
    message: "Valideringen misslyckades",
    input: { sourceId: "corevo-source" },
    result: null,
    error: { code: "VALIDATION_FAILED" },
    createdAt: "2026-07-30T07:00:00.000Z",
    startedAt: "2026-07-30T07:00:01.000Z",
    finishedAt: "2026-07-30T07:01:00.000Z",
  }];

  await page.route("**/api/studio-v1", async (route) => {
    const request = route.request().postDataJSON();
    calls.push(request);
    let value;
    if (request.operation === "readiness") value = { ready: true };
    else if (request.operation === "projectCatalog") value = [catalogProject];
    else if (request.operation === "snapshotCatalog") value = [catalogSnapshot];
    else if (request.operation === "readerContext") value = readerPacket;
    else if (request.operation === "knowledgeList" || request.operation === "knowledgeByTarget") value = [knowledgeRecord];
    else if (request.operation === "knowledgeGet") value = knowledgeRecord;
    else if (request.operation === "jobs") value = jobs;
    else if (request.operation === "activity") value = options.activity?.(request.payload) || [];
    else if (request.operation === "cancelJob") {
      jobs[0] = { ...jobs[0], status: "cancelled", finishedAt: "2026-07-30T08:01:00.000Z" };
      value = jobs[0];
    } else if (request.operation === "retryJob") {
      value = { jobId: "job-retry", sourceJobId: request.payload.jobId };
    } else {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: `Unexpected operation: ${request.operation}` }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, value }),
    });
  });
  return calls;
}

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`${viewport.name} keeps a visible, bounded graph`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#runtime-text")).toHaveText("Klar");
    await waitForVisibleGraph(page);
    const metrics = await layoutMetrics(page);
    expect(metrics.scrollWidth).toBe(metrics.bodyWidth);
    expect(metrics.canvas.width).toBeGreaterThan(viewport.width * 0.45);
    expect(metrics.canvas.height).toBeGreaterThan(viewport.height * 0.45);
  });
}

test("mobile panels and activity controls remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.locator("#control-rail")).toBeInViewport();
  await page.getByRole("button", { name: "Stäng filter", exact: true }).click();
  const searchTrigger = page.getByRole("button", { name: "Sök", exact: true });
  await searchTrigger.focus();
  await page.keyboard.press("Control+K");
  await expect(page.getByRole("searchbox", { name: "Sök i grafen", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(searchTrigger).toBeFocused();
  await page.getByRole("button", { name: "AI", exact: true }).click();
  await expect(page.locator("#activity-timeline")).toBeVisible();
  await expect(page.locator("#activity-play")).toBeVisible();
  await expect(page.locator("#graph-canvas")).not.toHaveClass(/activity-focus/);
  await expect(page.locator("#mobile-scrim")).toBeHidden();
});

test("agent activity never changes user view", async ({ page }) => {
  await page.route("**/api/get-activity", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        value: [{
          id: "test-view-1",
          timestamp: new Date().toISOString(),
          kind: "view",
          agent: "Testagent",
          project: "B",
          view: "overview",
          search: "currentTenant",
          confidence: "INFERRED",
          layout: "orbit",
          summary: "Försöker byta användarens vy",
        }, {
          id: "test-focus-1",
          timestamp: new Date().toISOString(),
          kind: "focus",
          agent: "Testagent",
          project: "B",
          label: "currentTenant",
        }],
      }),
    });
  });

  await page.goto("/");
  await expect(page.locator("#runtime-text")).toHaveText("Klar");
  await page.locator('[data-workspace="both"]').click();
  await page.locator("#brain-mode").selectOption("split");
  await page.locator("#confidence-filter").selectOption("EXTRACTED");
  await page.locator("#layout-mode").selectOption("flow");
  await page.locator('[data-detail-tab="agents"]').click();
  await expect(page.locator("#agent-events")).toContainText("Försöker byta användarens vy");

  await expect(page.locator('[data-workspace="both"]')).toHaveClass(/active/);
  await expect(page.locator("#brain-mode")).toHaveValue("split");
  await expect(page.locator("#confidence-filter")).toHaveValue("EXTRACTED");
  await expect(page.locator("#layout-mode")).toHaveValue("flow");
  const brainName = await page.locator("#project-b-name").textContent();
  await expect(page.locator("#agent-summary")).toContainText(`Testagent · ${brainName} · currentTenant`);
  await expect(page.locator("#graph-canvas")).not.toHaveClass(/activity-focus/);
});

test("reduced motion keeps activity static and visible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#runtime-text")).toHaveText("Klar");
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  expect((await layoutMetrics(page)).visiblePixels).toBeGreaterThan(500);
});

test("comparison search selects a node and highlights its real neighbors", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-text")).toHaveText("Klar");
  await page.locator('[data-workspace="A"]').click();
  await page.getByRole("searchbox").fill("currentTenant");
  await page.locator("[data-search-id]").first().click();
  await expect(page.locator("#node-title")).toHaveText("currentTenant");
  await expect.poll(async () => Number(await page.locator("#neighbor-count").textContent())).toBeGreaterThan(0);
  const after = await layoutMetrics(page);
  expect(after.yellowPixels).toBeGreaterThan(0);
});

test("saved graphs can replace either visible project", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-text")).toHaveText("Klar", { timeout: 15_000 });
  const projectLayout = await page.locator('[data-slot="A"]').evaluate((slot) => ({
    slot: slot.getBoundingClientRect().width,
    card: slot.querySelector(".project-main").getBoundingClientRect().width,
    picker: slot.querySelector(".project-picker").getBoundingClientRect().width,
  }));
  expect(projectLayout.card).toBeGreaterThan(projectLayout.slot * 0.9);
  expect(projectLayout.picker).toBeGreaterThan(projectLayout.slot * 0.9);
  const options = await page.locator('[data-library-project="B"] option').evaluateAll((items) => (
    items.map((item) => ({ value: item.value, text: item.textContent }))
  ));
  expect(options.map((item) => item.value)).toContain("corevo-database");

  await page.locator('[data-library-project="B"]').selectOption("corevo-database");
  const selectedName = options.find((item) => item.value === "corevo-database").text;
  await expect(page.locator("#project-b-name")).toHaveText(selectedName);
  await expect(page.locator("#runtime-text")).toHaveText("Klar");

  await page.locator('[data-project-visible="A"]').check();
  await expect(page.locator('[data-workspace="both"]')).toHaveClass(/active/);
  await page.locator('[data-project-visible="B"]').uncheck();
  await expect(page.locator('[data-workspace="A"]')).toHaveClass(/active/);
  await page.locator("#color-mode").selectOption("risk");
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.locator("#runtime-text")).toHaveText("Klar", { timeout: 15_000 });
  await expect(page.locator("#project-b-name")).toHaveText(selectedName);
  await expect(page.locator('[data-workspace="A"]')).toHaveClass(/active/);
  await expect(page.locator("#color-mode")).toHaveValue("risk");
});

test("filters report hidden nodes and reset the graph", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-text")).toHaveText("Klar");
  await page.locator('[data-workspace="A"]').click();
  await page.locator("#reset-filters").click();
  await expect(page.locator("#hidden-node-count")).toHaveText("0");
  const baseline = Number(await page.locator("#node-visible-count").textContent());
  await page.locator("#toggle-hubs-only").check();
  await expect.poll(async () => Number(await page.locator("#hidden-node-count").textContent())).toBeGreaterThan(0);
  expect(Number(await page.locator("#node-visible-count").textContent())).toBeLessThan(baseline);
  await page.locator("#reset-filters").click();
  await expect(page.locator("#toggle-hubs-only")).not.toBeChecked();
  await expect(page.locator("#toggle-isolates")).toBeChecked();
  await expect(page.locator("#hidden-node-count")).toHaveText("0");
  await expect(page.locator("#node-visible-count")).toHaveText(new Intl.NumberFormat("sv-SE").format(baseline));
});

test("selection, search, context snapshot and open tab survive reload", async ({ page }) => {
  await mockStudioV1(page);
  await page.goto("/");
  await expect(page.locator("#runtime-text")).toHaveText("Klar");
  await page.locator('[data-workspace="A"]').click();
  await page.getByRole("searchbox").fill("currentTenant");
  await page.locator("[data-search-id]").first().click();
  await expect(page.locator("#node-title")).toHaveText("currentTenant");
  await expect(page.locator("#node-source")).toContainText("apps/web/lib/tenant-data.ts");
  await expect(page.locator("#node-evidence")).toContainText("EXTRACTED");
  await page.locator('[data-detail-tab="reader"]').click();
  await expect(page.locator("#reader-project")).toHaveValue("firs-r-sas");
  await expect(page.locator("#reader-snapshot")).toHaveValue("corevo-current");
  await page.locator("#reader-query").fill("Var används currentTenant?");
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator("#runtime-text")).toHaveText("Klar");
  await expect(page.locator('[data-detail-tab="reader"]')).toHaveClass(/active/);
  await expect(page.getByRole("searchbox")).toHaveValue("currentTenant");
  await expect(page.locator("#reader-query")).toHaveValue("Var används currentTenant?");
  await expect(page.locator("#reader-snapshot")).toHaveValue("corevo-current");
  await expect(page.locator("#node-title")).toHaveText("currentTenant");
});

test("Read, Knowledge and Jobs keep the graph context and use Studio V1 contracts", async ({ page }) => {
  const calls = await mockStudioV1(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#runtime-text")).toHaveText("Klar");
  await waitForVisibleGraph(page);
  const graphBefore = await canvasSignature(page);

  await page.locator('[data-detail-tab="reader"]').click();
  await page.locator("#reader-query").fill("Var används currentTenant?");
  await page.getByRole("button", { name: "Läs kontext" }).click();
  await expect(page.locator("#reader-output")).toContainText("currentTenant används av portalens autentiserade flöden.");
  await expect(page.locator("#reader-output")).toContainText("Freshness: Aktuell");
  await expect(page.locator("#reader-output")).toContainText("apps/web/lib/tenant-data.ts:423");

  await page.locator('[data-detail-tab="knowledge"]').click();
  await expect(page.locator("#knowledge-list")).toContainText("Tenant-kontext");
  await page.locator("[data-knowledge-record]").first().click();
  await expect(page.locator("#knowledge-detail")).toContainText("Verifierad tenant-kontext.");

  await page.locator('[data-detail-tab="jobs"]').click();
  await expect(page.locator("#system-state")).toContainText("Online");
  await expect(page.locator("#jobs-list")).toContainText("45%");
  await expect(page.locator("#jobs-list")).toContainText("Valideringen misslyckades");
  await page.getByRole("button", { name: "Avbryt jobb" }).click();
  await page.locator('[data-job-id="job-failed"]').getByRole("button", { name: "Försök igen" }).click();
  await expect(page.locator("#safety-state")).toContainText("Read-only");
  await expect(page.locator("#safety-state")).toContainText("Förhandsgranskning");
  expect(calls.some((call) => call.operation === "cancelJob" && call.payload.jobId === "job-running")).toBe(true);
  expect(calls.some((call) => call.operation === "retryJob" && call.payload.jobId === "job-failed")).toBe(true);
  await expect.poll(() => canvasSignature(page)).toBeGreaterThan(0);
  expect(graphBefore).toBeGreaterThan(0);
});

test("live MCP activity names its source and appears in the graph", async ({ page }) => {
  let emitActivity = false;
  await mockStudioV1(page, {
    activity: () => emitActivity ? [{
          id: "live-mcp-1",
          timestamp: new Date().toISOString(),
          kind: "focus",
          agent: "Graphify watcher",
          projectId: "firs-r-sas",
          graph: "current",
          mcp_call: "read_context",
          target: "currentTenant",
          label: "currentTenant",
          file: "apps/web/lib/tenant-data.ts",
          relations: ["imports", "contains"],
          source: "Zivar Graph Studio V1 Reader",
          summary: "Läser currentTenant-kontext",
        }] : [],
  });
  await page.goto("/");
  await expect(page.locator("#runtime-text")).toHaveText("Klar");
  await page.locator('[data-workspace="A"]').click();
  await page.getByRole("searchbox").fill("currentTenant");
  await page.locator("[data-search-id]").first().click();
  await waitForVisibleGraph(page);
  emitActivity = true;
  await page.locator('[data-detail-tab="agents"]').click();
  await expect(page.locator("#agent-events")).toContainText("read_context", { timeout: 5_000 });
  await expect(page.locator("#agent-events")).toContainText("imports");
  await expect(page.locator("#agent-events")).toContainText("Zivar Graph Studio V1 Reader");
  await expect(page.getByRole("region", { name: "Interaktiv graf" })).toContainText("Graphify watcher · currentTenant");
  expect((await layoutMetrics(page)).yellowPixels).toBeGreaterThan(0);
});

test("keyboard search and Escape restore a clear graph context", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#runtime-text")).toHaveText("Klar");
  await page.locator('[data-workspace="A"]').click();
  await page.keyboard.press("Control+K");
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.getByRole("searchbox").fill("currentTenant");
  await page.locator("[data-search-id]").first().click();
  await expect(page.locator("#node-inspector")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#node-empty")).toBeVisible();
});

test("the modular controls are visible and change the 3D graph", async ({ page }) => {
  test.setTimeout(60_000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#runtime-text")).toHaveText("Klar");

  for (const selector of [
    "#relation-filter",
    "#confidence-filter",
    "#weight-filter",
    "#toggle-isolates",
    "#toggle-hubs-only",
    "#toggle-arrows",
    "#toggle-edge-labels",
    "#toggle-pulse",
    "#toggle-inferred-dash",
    "#pulse-speed",
    "#color-mode",
    "#shape-mode",
    "#size-mode",
    "#sort-mode",
    "#label-density",
    "#toggle-hubs",
    "#brain-mode",
    "#layout-mode",
    "#node-spacing",
    "#toggle-grid",
    "#toggle-minimap",
  ]) {
    await expect(page.locator(selector)).toBeVisible();
  }
  await expect(page.locator("#pulse-speed")).toHaveAttribute("min", "1");
  await page.locator('[data-workspace="both"]').click();
  await expect(page.locator("#brain-mode")).toBeEnabled();

  const before = await canvasSignature(page);
  await page.locator("#color-mode").selectOption("risk");
  await page.locator("#shape-mode").selectOption("diamond");
  await expect.poll(() => canvasSignature(page)).not.toBe(before);

  await page.locator("#weight-filter").fill("3");
  await expect(page.locator("#weight-filter-value")).toHaveText("3");
  await page.locator("#toggle-arrows").uncheck();
  await page.locator("#toggle-edge-labels").check();
  await page.locator("#toggle-pulse").check();
  await page.locator("#toggle-inferred-dash").uncheck();
  await page.locator("#pulse-speed").fill("1");
  await expect(page.locator("#pulse-speed-value")).toHaveText("0,01×");
  await page.locator("#size-mode").selectOption("uniform");
  await page.locator("#sort-mode").selectOption("name");
  await page.locator("#label-density").fill("8");
  await page.locator("#toggle-hubs").uncheck();
  await page.locator("#brain-mode").selectOption("split");
  await page.locator("#layout-mode").selectOption("flow");
  await page.locator("#node-spacing").fill("125");
  await page.locator("#toggle-grid").uncheck();
  await page.locator("#toggle-minimap").uncheck();
  await expect(page.locator("#minimap")).toBeHidden();
  expect(pageErrors).toEqual([]);
});
