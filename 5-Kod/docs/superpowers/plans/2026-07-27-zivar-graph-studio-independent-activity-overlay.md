# Zivar Graph Studio Independent Activity Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visa verklig agentaktivitet och senaste aktivitetspasset utan att agenthändelser ändrar användarens grafvy.

**Architecture:** Behåll grafens befintliga aktivitetslager men normalisera MCP-händelser till verkliga nodmål innan de når renderaren. Gör playback till ett rent urval av senaste tidsavgränsade passet och ta bort kommandovägen som applicerar agenternas `view`/`refresh` på användarens tillstånd.

**Tech Stack:** Vanilla JavaScript, Three.js, Node `assert`, Playwright, befintlig lokal JSONL-logg.

## Global Constraints

- Ingen ny dependency eller sessionsdatabas.
- Ett nytt aktivitetspass börjar efter minst `30 * 60_000` ms inaktivitet.
- Agentaktivitet får aldrig ändra workspace, hjärnläge, sökning, filter, layout, zoom eller kamera.
- Endast mål som kan lösas mot verkliga grafnoder får ritas i grafen.
- Loggen behålls som kompletterande historik.
- `5-Kod/apps/zivar-graph-studio/` är ett befintligt otrackat arbete; skapa
  ingen partiell app-commit och stagea inte andra befintliga filer.

---

### Task 1: Rena aktivitetshjälpare

**Files:**
- Modify: `5-Kod/apps/zivar-graph-studio/activity-engine.js`
- Test: `5-Kod/apps/zivar-graph-studio/self-check.cjs`

**Interfaces:**
- Produces: `activityTargets(event) -> Array<{id?, label?, sourceFile?, community?}>`
- Produces: `expandActivityEvents(events) -> Array<object>`
- Produces: `latestActivityPass(events, gapMs?) -> {start, end, events}`

- [ ] **Step 1: Skriv fallerande självtest**

Importera de tre funktionerna och lägg till kontroller som bevisar top-level
`label`, `file` och `files`, samt att senaste passet börjar efter en 30-minuterslucka:

```js
assert.deepEqual(
  activityTargets({ label: "renderActivity()", file: "renderer.js", files: ["renderer.js", "styles.css"] }),
  [
    { label: "renderActivity()", sourceFile: "renderer.js" },
    { sourceFile: "styles.css" },
  ],
);
assert.equal(expandActivityEvents([{ kind: "change", files: ["a.js", "b.js"] }]).length, 2);
const pass = latestActivityPass([
  { timestamp: "2026-07-27T08:00:00.000Z" },
  { timestamp: "2026-07-27T08:05:00.000Z" },
  { timestamp: "2026-07-27T08:40:00.000Z" },
]);
assert.deepEqual([pass.start, pass.end, pass.events.length], [2, 2, 1]);
```

- [ ] **Step 2: Kör självtestet och verifiera rött**

Run: `node 5-Kod/apps/zivar-graph-studio/self-check.cjs`

Expected: FAIL eftersom de tre exporterna saknas.

- [ ] **Step 3: Implementera minsta rena logik**

Normalisera ett explicit `event.target` först, kombinera därefter top-level
`label` + `file`, lägg till unika poster ur `files`, och expandera en rå händelse
till en grafhändelse per mål. Hitta senaste passets start genom en enda linjär
genomgång och standardluckan `1_800_000`.

- [ ] **Step 4: Kör självtestet grönt**

Run: `node 5-Kod/apps/zivar-graph-studio/self-check.cjs`

Expected: `Zivar Graph Studio engine self-check: OK`

- [ ] **Step 5: Kontrollera den avgränsade diffen**

```bash
git status --short -- 5-Kod/apps/zivar-graph-studio/activity-engine.js 5-Kod/apps/zivar-graph-studio/self-check.cjs
```

Ingen staging görs eftersom appens gemensamma baseline ännu är otrackad.

### Task 2: Frikoppla overlay och förenkla playback

**Files:**
- Modify: `5-Kod/apps/zivar-graph-studio/renderer.js`
- Modify: `5-Kod/apps/zivar-graph-studio/brain-graph-3d.mjs`
- Modify: `5-Kod/apps/zivar-graph-studio/studio.html`
- Modify: `5-Kod/apps/zivar-graph-studio/styles.css`
- Test: `5-Kod/apps/zivar-graph-studio/e2e/studio-responsive.spec.cjs`

**Interfaces:**
- Consumes: `expandActivityEvents(events)`
- Consumes: `latestActivityPass(events)`
- Preserves: befintliga `graph.setActivity(events, options)` och JSONL-formatet

- [ ] **Step 1: Skriv och kör ett fallerande vy-isoleringskontrakt**

Intercepta `/api/get-activity` med ett `view`-event som försöker byta projekt,
sökning, confidence och layout. Välj först `Båda`, delad hjärna och
`EXTRACTED`, öppna sedan agentpanelen och verifiera att valen samt basgrafens
normala fokusklass består:

```js
await expect(page.locator('[data-workspace="both"]')).toHaveClass(/active/);
await expect(page.locator("#brain-mode")).toHaveValue("split");
await expect(page.locator("#confidence-filter")).toHaveValue("EXTRACTED");
await expect(page.locator("#graph-canvas")).not.toHaveClass(/activity-focus/);
```

Run: `pnpm --dir 5-Kod --filter @corevo/zivar-graph-studio test:e2e -- --grep "agent activity never changes user view"`

Expected: FAIL eftersom dagens `applyActivityCommands()` byter vy och
agentpanelen aktiverar `activity-focus`.

- [ ] **Step 2: Stoppa agentkommandon från att mutera användarvyn**

Ta bort `applyActivityCommands()` och dess anrop från `pollActivity()`. Ta även
bort `refreshLiveGraph()` om den då saknar anrop. `openDetailTab()` ska inte slå
på `graph.setActivityFocus()`, eftersom fokusläget tonar ned och döljer
basgrafen.

- [ ] **Step 3: Lös verkliga mål utan kameraflytt**

Skicka `expandActivityEvents(playbackEvents())` till `graph.setActivity()`.
Utöka båda befintliga `targetId()`-implementationerna så att `target.label`
kan matcha `node.label`; anropa inte `focusTarget()` från live eller replay.

- [ ] **Step 4: Spela senaste passet från början**

Lägg `passStart` i playback-state. När användaren väljer senaste passet:

```js
const pass = window.ZivarActivity.latestActivityPass(state.activity);
state.playback.passStart = pass.start;
state.playback.cursor = pass.start;
state.playback.agents = new Set(pass.events.map((event) => event.agent || "Agent"));
state.playback.mode = "playing";
```

I replay ska `playbackEvents()` använda
`state.activity.slice(state.playback.passStart, state.playback.cursor + 1)`.
Tidslinjens min/max och räknare ska beskriva endast det valda passet.

- [ ] **Step 5: Gör huvudkontrollerna begripliga**

Byt huvudknapparna till `● Följ live`, `▶ Spela senaste passet` och `Pausa`.
Flytta hastighet, värme och agentfilter till ett `<details>` med texten
`Avancerat`. Behåll tidslinje och logg, och låt agentindikatorn visa senaste
verkliga mål eller top-level `label`/`file` även när noden ligger utanför aktuell
vy.

- [ ] **Step 6: Kör kontraktet och paketkontrollerna grönt**

Run: `pnpm --dir 5-Kod --filter @corevo/zivar-graph-studio test:e2e -- --grep "agent activity never changes user view"`

Expected: testet grönt utan workspace-, filter- eller fokusklassändring.

Run: `pnpm --dir 5-Kod --filter @corevo/zivar-graph-studio typecheck`

Expected: exit `0`.

Run: `pnpm --dir 5-Kod --filter @corevo/zivar-graph-studio test`

Expected: `Zivar Graph Studio engine self-check: OK`

- [ ] **Step 7: Kontrollera de ändrade appfilerna**

```bash
git status --short -- 5-Kod/apps/zivar-graph-studio
```

Ingen partiell app-commit skapas.

### Task 3: Browserkontrakt och visuell verifiering

**Files:**
- Modify: `5-Kod/apps/zivar-graph-studio/e2e/studio-responsive.spec.cjs`

**Interfaces:**
- Consumes: `/api/get-activity` polling
- Verifies: user-owned view state and top-level focus-label presentation

- [ ] **Step 1: Skriv browsertestet**

Intercepta `/api/get-activity` med ett `view`-event som försöker byta projekt,
sökning, relation, confidence och layout samt ett `focus`-event med top-level
`label`. Välj först `Båda`, delad hjärna och ett confidence-filter. Vänta minst
en pollcykel och verifiera:

```js
await expect(page.locator('[data-workspace="both"]')).toHaveClass(/active/);
await expect(page.locator("#brain-mode")).toHaveValue("split");
await expect(page.locator("#confidence-filter")).toHaveValue("EXTRACTED");
await expect(page.locator("#agent-summary")).toContainText("currentTenant");
await expect(page.locator("#graph-canvas")).not.toHaveClass(/activity-focus/);
```

- [ ] **Step 2: Kör riktat browsertest**

Run: `pnpm --dir 5-Kod --filter @corevo/zivar-graph-studio test:e2e -- --grep "activity"`

Expected: samtliga activity-tester gröna.

- [ ] **Step 3: Kör hela Graph Studio-verifieringen**

Run: `pnpm --dir 5-Kod --filter @corevo/zivar-graph-studio typecheck`

Run: `pnpm --dir 5-Kod --filter @corevo/zivar-graph-studio test`

Run: `pnpm --dir 5-Kod --filter @corevo/zivar-graph-studio test:e2e`

Expected: alla tre kommandon exit `0`.

- [ ] **Step 4: Uppdatera kodgrafen och gör en synlig slutkontroll**

Kör Graphifys inkrementella uppdatering för de ändrade källfilerna. Öppna
Studio i användarens befintliga vy, registrera ett riktigt `focus`-event och
bekräfta att hela grafen samt användarens filter ligger kvar medan pulsen syns.

- [ ] **Step 5: Spara verifieringsresultatet utan partiell app-commit**

```bash
git status --short -- 5-Kod/apps/zivar-graph-studio
```

Appens hela baseline kan committas separat först när den gemensamma otrackade
verktygsytan har granskats som en enhet.
