# Zivar Graph Studio 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ersätt Studio-grafens 2D-yta med en roterbar Three.js-hjärngraf av verkliga Graphify-noder.

**Architecture:** En ny `BrainGraph3D` behåller det gränssnitt som resten av
`renderer.js` redan använder. Layoutlogik hålls ren och deterministisk i en
egen modul; server-, jämförelse-, branch- och MCP-kontrakt lämnas oförändrade.

**Tech Stack:** Three.js, vanlig JavaScript, Electron, lokal HTTP-server och Playwright.

## Global Constraints

- A/B/Båda/Diff ska fortsätta använda befintlig Graphify-data.
- Ingen importerad kod körs.
- Aktivitet får aldrig hitta på en kant.
- Mobilen ska kunna rotera med ett finger och zooma med två.
- Befintliga användarändringar och branch lämnas orörda.
- Ingen commit skapas utan användarens uttryckliga begäran.

---

### Task 1: Deterministisk hjärnlayout

**Files:**
- Create: `5-Kod/apps/zivar-graph-studio/brain-layout.js`
- Modify: `5-Kod/apps/zivar-graph-studio/self-check.cjs`

**Interfaces:**
- Produces: `brainLayout(nodes, { mode, split }) -> Map<string, {x,y,z}>`
- Produces: `brainBounds(positions) -> { center, radius }`

- [ ] Skapa en ren, seedad layout som grupperar communities och formar två lober.
- [ ] Lägg A till vänster och B till höger i integrerat jämförelseläge.
- [ ] Forma två fulla hjärnor i separat läge.
- [ ] Kontrollera determinism, ändliga koordinater och korrekt A/B-separation i självkollen.

### Task 2: Three.js-renderare

**Files:**
- Create: `5-Kod/apps/zivar-graph-studio/brain-graph-3d.js`
- Modify: `5-Kod/apps/zivar-graph-studio/package.json`
- Modify: `5-Kod/apps/zivar-graph-studio/local-server.cjs`
- Modify: `5-Kod/apps/zivar-graph-studio/studio.html`
- Modify: `5-Kod/apps/zivar-graph-studio/renderer.js`

**Interfaces:**
- Consumes: `brainLayout()` och befintliga vyobjekt `{nodes, edges, mode}`.
- Produces: `BrainGraph3D` med `setData`, `setOptions`, `setActivity`,
  `setActivityFocus`, `focusTarget`, `fit`, `zoomBy`, `rotate`, `resize` och
  `canvas`.

- [ ] Lägg Three.js som lokal produktionsdependency.
- [ ] Rita noder som instansierade 3D-sfärer och kanter som linjesegment.
- [ ] Lägg OrbitControls, raycasting, klick, dubbelklick, zoom och kameraåterställning.
- [ ] Rita aktiv nod, avklingande värme och partiklar längs verkliga aktivitetsvägar.
- [ ] Stoppa rörlig aktivitet när lease och synlig värme har löpt ut.

### Task 3: Förenklad kontrollpanel

**Files:**
- Modify: `5-Kod/apps/zivar-graph-studio/studio.html`
- Modify: `5-Kod/apps/zivar-graph-studio/renderer.js`
- Modify: `5-Kod/apps/zivar-graph-studio/styles.css`

**Interfaces:**
- Consumes: befintliga serverfilter `relation`, `confidence`, `minWeight`.
- Produces: `brainMode = integrated | split`.

- [ ] Ta bort kontroller för form, färg, sortering, placering, avstånd, rutnät,
  minikarta, pilar, kantvärden, flöde, flytt och lasso.
- [ ] Behåll projekt, relation, bevisnivå, tre begripliga styrkenivåer och fristående noder.
- [ ] Visa Integrerad/Två hjärnor endast i Båda/Diff.
- [ ] Behåll sök, Info, Audit, Jämför, Agenter och mobilens bottenrad.

### Task 4: Verifiering

**Files:**
- Modify: `5-Kod/apps/zivar-graph-studio/e2e/studio-responsive.spec.cjs`

**Interfaces:**
- Consumes: lokal Studio på `http://127.0.0.1:8768/`.

- [ ] Kör syntaxkontroll och självkoll.
- [ ] Kontrollera icke-tom WebGL-yta på mobil, surfplatta och desktop.
- [ ] Dra grafen och verifiera att canvaspixlar förändras.
- [ ] Kör en riktig `studio_focus`-sekvens och verifiera synlig Codex-aktivitet.
- [ ] Kontrollera att alla fem lokala tjänster fortfarande kör.
