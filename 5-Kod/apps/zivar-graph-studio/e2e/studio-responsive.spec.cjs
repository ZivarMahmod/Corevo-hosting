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

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 720 },
]) {
  test(`${viewport.name} keeps a visible, bounded graph`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#runtime-text")).toHaveText("Klar");
    const metrics = await layoutMetrics(page);
    expect(metrics.scrollWidth).toBe(metrics.bodyWidth);
    expect(metrics.canvas.width).toBeGreaterThan(viewport.width * 0.45);
    expect(metrics.canvas.height).toBeGreaterThan(viewport.height * 0.45);
    expect(metrics.visiblePixels).toBeGreaterThan(500);
  });
}

test("mobile panels and activity controls remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.locator("#control-rail")).toBeInViewport();
  await page.getByRole("button", { name: "Stäng filter", exact: true }).click();
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
  await page.getByRole("searchbox").fill("currentTenant");
  await page.locator("[data-search-id]").first().click();
  await expect(page.locator("#node-title")).not.toHaveText("Ingen nod vald");
  expect(Number(await page.locator("#neighbor-count").textContent())).toBeGreaterThan(0);
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
  await expect(page.locator('[data-library-project="B"] option')).toContainText([
    "Välj sparad graf",
    "Corevo",
    "Open Design",
    "Corevo Database",
  ]);

  await page.locator('[data-library-project="B"]').selectOption("corevo-database");
  await expect(page.locator("#project-b-name")).toHaveText("Corevo Database");
  await expect(page.locator("#runtime-text")).toHaveText("Klar");

  await page.locator('[data-project-visible="A"]').check();
  await expect(page.locator('[data-workspace="both"]')).toHaveClass(/active/);
  await page.locator('[data-project-visible="B"]').uncheck();
  await expect(page.locator('[data-workspace="A"]')).toHaveClass(/active/);
  await page.locator("#color-mode").selectOption("risk");
  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.locator("#runtime-text")).toHaveText("Klar", { timeout: 15_000 });
  await expect(page.locator("#project-b-name")).toHaveText("Corevo Database");
  await expect(page.locator('[data-workspace="A"]')).toHaveClass(/active/);
  await expect(page.locator("#color-mode")).toHaveValue("risk");
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
