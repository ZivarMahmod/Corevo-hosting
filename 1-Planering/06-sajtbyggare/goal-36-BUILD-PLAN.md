# goal-36 — Build Plan: vendor-katalog → sajtbyggare-looks (autonom loop, mekaniskt 0 FAIL)

> ⛔ **SUPERSEDED av goal-51 (2026-06-26).** Vendor-import-idén är skrotad — de 13 looksen rivna ur
> kod + DB (baseline-reset). Rätt modell = goal-52 (native kit + look-som-config). Denna plan = historik.

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (or `executing-plans`) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax. This plan is executed via **Workflow** orchestration (ultracode). Källspec = `2-Byggplan/goals/goal-36-sajtbyggare-100-templates-autorun.md` + de-risk `3-Bakgrund-Research/de-risk-goal36-2026-06-26.md`. Krock → de-risk + denna plan vinner på mekaniken; design-kanon (`4-Dokument-Underlag/01-acceptans/`) vinner på utseendet.

**Goal:** Konvertera varje *booking-passande* vendor-mall i katalogen till en sajtbyggare-look (full vendor-HTML + RegionManifest + `<corevo-module type="booking">`-väv) som renderar troget och bevisas mekaniskt 0 FAIL, och registrera varje klar look i `look-registry.ts` (goal-50:s BOXEN).

**Architecture:** En **codemod** (`5-Kod/scripts/import-template.mjs`) gör de mekaniska 80% deterministiskt (strip scripts/chrome, asset-rewrite, token-extraktion ur vendor-CSS, public-asset-kopiering, scaffold av `.ts`+`manifest`+`proof` med RIKTIGA auto-extraherade assertions). En **per-mall-agent** (i Workflow) gör de 20% omdöme (placera booking-markören, finslipa regioner, kör proof grön). En **oberoende verify-agent** bekräftar att proofet asserterar mallens UNIKA form (ingen copy-paste-stub). En **R4-meta-assertion** i `proof-kit.ts` gör stubbing mekaniskt omöjlig.

**Tech Stack:** Node/TS-codemod (`node:fs`, `html-react-parser` redan i appen), vitest (render-proof), `parse5`/regex för transform, Python redan finns för katalog-scan. Allt bakom flaggan `SAJTBYGGARE_ENABLED`.

## Global Constraints (kopierat verbatim ur spec/de-risk/minne — gäller VARJE task)

- **READ-ONLY-kontrakt — forka ALDRIG unilateralt:** `lib/sajtbyggare/manifest/types.ts` (RegionType = `text|image|color|font|logo`, inga nya typer), `render-bridge.tsx`, `booking-mount.tsx`, `flag.ts`. Behövs ny region-typ/modul-mount → **STOPP**, markera `BLOCKERAD (schema)` i trackern för goal-37, hoppa till nästa mall (mjuk skip, ej hård stopp på runet). (goal-36 §9 + M3)
- **Design = EXAKT kopia, aldrig improvisera.** Text/bild = verbatim vendor-strängar (inkl. typos: `Compleate Projects`; inkl. eyebrow-slashes `// … //`). Färg/font = exakt lyft ur vendor-CSS, aldrig re-härled. (HÅRDA REGLER)
- **"Klart" = mekaniskt 0 FAIL** via per-mall `*.proof.test.ts` (icke-trivial: regioner+booking+kanon-token). Aldrig ögonmått. Falsk-grön = 62%-fällan.
- **Behåll `kräver-kredit`-attribution** (CC-BY/htmlcodex/colorlib/themewagon). Proofet asserterar credit-strängen — strippa den = proof FAIL + licensbrott.
- **Build-once-never-delete. Additive.** Ny look = append-rad i `look-registry.ts` + ny `templates/<key>.*`. Rör inte de 4 klara (restoran/klinik/drivin/carserv).
- **Jobba i `main`, bakom flaggan** (minne `work-on-main-not-branches` går före goal-36 §9:s branch-instruktion; flaggan gör det säkert). **INGEN deploy** i denna run (deploy detachar kunddomäner → separat Zivar-OK). Push≠live.
- **Filplacering:** codemod → `5-Kod/scripts/` (offline/CI, ALDRIG i `apps/web`-runtimen). Per-mall-artefakter → `lib/sajtbyggare/templates/` + `manifest/`. Public assets → `apps/web/public/sajtbyggare/<key>/`. Inget i repo-roten.
- **Buildable (denna run):** `type ∈ {storefront, landing}` + riktig `index.html` + licens `kräver-kredit|fri` + **EJ** admin-dashboard + **EJ** dubblett + **har en native service/appointment/reservation-`<form>`** att BYTA mot booking-markören (uppfinn ALDRIG en sektion). Endast `booking` är live-vävd idag (`booking-mount.tsx` = enda mount) → icke-service-mallar utan native form är BLOCKERADE på modul-placering (goal-40/fler mounts), tas EJ i denna run.

---

## File Structure

| Fil | Ansvar | Skapa/Ändra |
|---|---|---|
| `5-Kod/scripts/import-template.mjs` | Codemod: vendor-mapp → `.ts`+`manifest`+`proof`-scaffold + public-assets. Deterministisk, idempotent. | **Skapa** |
| `5-Kod/scripts/import-template.test.mjs` | Codemod-enhetstester (strip-set, asset-rewrite, token-extraktion, scaffold-form). | **Skapa** |
| `5-Kod/apps/web/lib/sajtbyggare/_optimize/proof-kit.ts` | **+** `proofFloor()` (R4): exporterad describe som varje proof MÅSTE köra; asserterar ≥N regioner + ≥1 booking-marker + ≥1 kanon-token i vendor-CSS. | **Ändra** (append, rör ej befintliga fns) |
| `5-Kod/apps/web/lib/sajtbyggare/_optimize/proof-floor.test.ts` | Meta-test (R4-enforcement): grep alla `*.proof.test.ts` → var och en importerar+kör `proofFloor`. Stubbing blir omöjlig. | **Skapa** |
| `5-Kod/apps/web/lib/sajtbyggare/templates/<key>.ts` | Per-look: `<KEY>_PAGE_HTML` + `<KEY>_CSS_HREFS`. | **Skapa/look** |
| `5-Kod/apps/web/lib/sajtbyggare/manifest/<key>.ts` | Per-look: `<KEY>_REGION_MANIFEST`. | **Skapa/look** |
| `5-Kod/apps/web/lib/sajtbyggare/templates/<key>.proof.test.ts` | Per-look render-proof (icke-trivial, kör `proofFloor`). | **Skapa/look** |
| `5-Kod/apps/web/public/sajtbyggare/<key>/{img,css}/` | Vendor-assets (kopierade). | **Skapa/look** |
| `5-Kod/apps/web/lib/sajtbyggare/look-registry.ts` | Append en `entry(...)`-rad per klar look (LOOKS-arrayen). | **Ändra/look** |
| `1-Planering/06-sajtbyggare/100-TEMPLATES-TRACKER.md` | Status-rad per mall (TODO→BYGGD→VERIFIERAD 0FAIL→COMMIT). Loopen läser FÖRST. | **Ändra/look** |

---

## PHASE 0 — Foundation (codemod + R4-floor + mätning). Bygg FÖRST, sekventiellt. Loopen körs INTE förrän detta är grönt.

### Task 1: R4 proof-floor i proof-kit.ts (anti-stub, mekaniskt obligatorisk)

**Files:**
- Modify: `5-Kod/apps/web/lib/sajtbyggare/_optimize/proof-kit.ts` (append; rör ej de rena fns)
- Create: `5-Kod/apps/web/lib/sajtbyggare/_optimize/proof-floor.test.ts`

**Interfaces:**
- Consumes: `RegionManifest` (types.ts), `moduleMarkerTypes`/`firstModuleMarker`/`readVendorCssLc`/`tokenScanText`/`countTokenMismatches` (befintliga proof-kit fns).
- Produces: `proofFloor(manifest: RegionManifest, pageHtml: string, opts?: { minRegions?: number }): void` — kör sina egna `it()`-assertions inuti en `describe`. Varje `<key>.proof.test.ts` MÅSTE kalla den.

- [ ] **Step 1: Write the failing test** (`proof-floor.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { proofFloor } from './proof-kit'
import { CARSERV_REGION_MANIFEST } from '../manifest/carserv'
import { CARSERV_PAGE_HTML } from '../templates/carserv'

// 1. proofFloor PASSES a real, non-trivial look (carserv).
describe('proofFloor accepts a real look', () => {
  proofFloor(CARSERV_REGION_MANIFEST, CARSERV_PAGE_HTML)
})

// 2. proofFloor FAILS a stub (too few regions / no booking / invented token).
describe('proofFloor rejects stubs', () => {
  it('throws when regions < floor', () => {
    expect(() =>
      proofFloor.check({ templateKey: 'x', regions: [] }, '<div></div>'),
    ).toThrow()
  })
  it('throws when no booking marker is woven', () => {
    expect(() => proofFloor.check(CARSERV_REGION_MANIFEST, '<div>no module</div>')).toThrow()
  })
})

// 3. ENFORCEMENT: every *.proof.test.ts in templates/ imports + calls proofFloor.
describe('every per-look proof runs proofFloor (R4 enforcement)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const dir = join(here, '..', 'templates')
  const proofs = readdirSync(dir).filter((f) => f.endsWith('.proof.test.ts'))
  it('finds at least the 4 baseline proofs', () => {
    expect(proofs.length).toBeGreaterThanOrEqual(4)
  })
  for (const f of proofs) {
    it(`${f} imports and calls proofFloor`, () => {
      const src = readFileSync(join(dir, f), 'utf8')
      expect(src).toMatch(/proofFloor\s*\(/)
    })
  }
})
```

- [ ] **Step 2: Run → verify it fails**

Run: `cd 5-Kod/apps/web && npx vitest run lib/sajtbyggare/_optimize/proof-floor.test.ts`
Expected: FAIL — `proofFloor` not exported.

- [ ] **Step 3: Implement `proofFloor` in proof-kit.ts** (append)

```ts
import { describe as _describe, it as _it, expect as _expect } from 'vitest'

/** R4 floor: the minimum a per-look proof must assert so "0 FAIL" can't be a
 *  copy-paste stub. `check` throws on violation (used in unit tests); the default
 *  export runs the assertions as a vitest describe (used in each per-look proof). */
function checkFloor(manifest: RegionManifest, pageHtml: string, minRegions = 8): void {
  if (manifest.regions.length < minRegions)
    throw new Error(`proof-floor: ${manifest.templateKey} has ${manifest.regions.length} regions, need >= ${minRegions}`)
  if (!firstModuleMarker(pageHtml)) throw new Error(`proof-floor: ${manifest.templateKey} weaves no <corevo-module>`)
  const hasColor = manifest.regions.some((r) => r.type === 'color' && r.default)
  const hasFont = manifest.regions.some((r) => r.type === 'font' && r.default)
  if (!hasColor || !hasFont) throw new Error(`proof-floor: ${manifest.templateKey} missing canon color/font region`)
  const vendorCssLc = readVendorCssLc(manifest.templateKey)
  if (vendorCssLc.length === 0) throw new Error(`proof-floor: ${manifest.templateKey} vendor CSS missing`)
  if (countTokenMismatches(tokenScanText(pageHtml, manifest), vendorCssLc) !== 0)
    throw new Error(`proof-floor: ${manifest.templateKey} has a color/font literal not in vendor CSS (drift)`)
}

export function proofFloor(manifest: RegionManifest, pageHtml: string, opts: { minRegions?: number } = {}): void {
  _describe(`proof-floor: ${manifest.templateKey} (R4)`, () => {
    _it('asserts >= floor regions + booking + canon tokens + no drift', () => {
      _expect(() => checkFloor(manifest, pageHtml, opts.minRegions ?? 8)).not.toThrow()
    })
  })
}
proofFloor.check = checkFloor
```

- [ ] **Step 4: Add `proofFloor(...)` call to the 4 baseline proofs** (carserv/klinik/drivin/restoran). One line each at top-level (outside their existing describes):

```ts
import { proofFloor } from '../_optimize/proof-kit'
proofFloor(CARSERV_REGION_MANIFEST, CARSERV_PAGE_HTML)
```
> restoran har idag bara `restoran-metrics.test.ts` (i `_optimize/`) — lägg en `templates/restoran.proof.test.ts` som kör `proofFloor` + dess unika assertions, ELLER lägg `proofFloor`-raden i metrics-testet och låt enforcement-globben täcka `_optimize/` också. Default: skapa `templates/restoran.proof.test.ts` (paritet med de andra 3).

- [ ] **Step 5: Run → verify green**

Run: `cd 5-Kod/apps/web && npx vitest run lib/sajtbyggare`
Expected: PASS (alla 4 baseline-proofs + floor-test gröna).

- [ ] **Step 6: Commit**

```bash
git add 5-Kod/apps/web/lib/sajtbyggare/_optimize/proof-kit.ts \
        5-Kod/apps/web/lib/sajtbyggare/_optimize/proof-floor.test.ts \
        5-Kod/apps/web/lib/sajtbyggare/templates/*.proof.test.ts
git commit -m "test(sajtbyggare): goal-36 R4 — proof-floor makes stub-proofs mechanically impossible"
```

---

### Task 2: Codemod `import-template.mjs` (R1 — vendor → scaffold, deterministisk)

**Files:**
- Create: `5-Kod/scripts/import-template.mjs`
- Create: `5-Kod/scripts/import-template.test.mjs`

**Interfaces:**
- CLI: `node import-template.mjs --src "<katalog>/<mapp>" --key <key> --page index.html [--booking-selector "<css/id hint>"] [--dry]`
- Produces (filer): `templates/<key>.ts`, `manifest/<key>.ts`, `templates/<key>.proof.test.ts`, `public/sajtbyggare/<key>/{img,css}/`. Emit `// CODEMOD-TODO:` där omdöme krävs (booking-marker, region-finslip).
- Exporterar rena fns (för enhetstest): `stripChrome(html)`, `rewriteAssets(html, key)`, `extractCssHrefs(html)`, `extractCanonTokens(cssText)`, `detectRegions(html)`, `emitProof(key, manifest, sentinels)`.

**Mekaniska transformer (deterministiska, enumererade — matchar de 4 klara):**
1. **Strip `<script>…</script>`** (alla). **Strip JS-only-attr:** `data-bs-toggle`, `data-bs-target`, `data-bs-slide` *(behåll? — carserv-proofet BEHÅLLER `data-bs-ride`/`data-bs-slide` inert; strippa BARA `data-bs-toggle`/`data-bs-target`/`data-target`/`data-toggle`/`data-target-input`/`data-wow-delay`/`data-src`)*. **Strip animation-klasser** som token i `class`: `wow`, `animated`, `fadeIn*`, `slideIn*`, `zoomIn*` (ta bort tokenet, behåll övriga klasser; trimma trailing space). **Strip chrome-element:** `id="spinner"`-blocket, `back-to-top`-`<a>`, `navbar-toggler`-knappen, modaler som kräver JS.
2. **Asset-rewrite:** `src="img/…"`/`href="img/…"`/`url(img/…)`/`url('img/…')` → `/sajtbyggare/<key>/img/…`. `href="css/…"` → `/sajtbyggare/<key>/css/…`. Döda länkar `href=""` → `href="#"`.
3. **CSS-hrefs:** samla `<link rel=stylesheet href>` i `<head>` → `<KEY>_CSS_HREFS` (uteslut `animate`/`animated.css`). Strippa `<head>`/`<body>`-wrappers → behåll bara body-innehållet (de 4 PAGE_HTML är body-fragment).
4. **Kanon-token ur vendor-CSS:** läs `css/style.css` (`:root{--primary}`) + `css/bootstrap.min.css` (`body{background-color}`/`{color}`/`{font-family}`) → `{ colorPrimary, colorBg, colorFg, colorAccent(=primary om ingen egen), fontBody }`. Lyft exakt (3-siffrig lowercase om vendorn skriver så).
5. **Region-detektion (kandidater, agenten finslipar):** `hero.title` = första `<h1>` i header/carousel; `*.eyebrow`/`*.title` = `<h6 class*=section-title>`/`<h5 class=section-title>` + följande heading per sektion; `about.copy` = första `<p>` i about; `hero.image`/`about.image` = carousel-bg + about-img; alltid `color.{primary,bg,fg,accent}` + `font.body` + `logo`(default null). Generera dotted-keys + `tenantBinding` (text→copy camelCase, image/color/font/logo→branding snake_case) precis som carserv-manifestet.
6. **Booking-marker:** hitta `<form>` i sektion med booking-nyckelord ELLER på den angivna `--page`/`--booking-selector` → ersätt hela `<form>…</form>` med `<corevo-module type="booking" pos="<sektionens id>">`. Om osäkert: lämna formen + `// CODEMOD-TODO: place booking marker (candidate at line N)`.
7. **Proof-emit (RIKTIGA assertions, ej smoke):** emit `<key>.proof.test.ts` som: importerar `proofFloor` + kör den; asserterar de exakta region-keys den genererade (identiteter, `toHaveLength`); de exakta kanon-token (`#hex`/font); section-sentinels (verbatim text-snutts den hittade per sektion); booking-variant (`firstModuleMarker.type==='booking'`); render-bron round-trip (`renderTemplate` parsar + markör byts); token-mismatch==0; attribution-sträng närvarande. Mönster = `carserv.proof.test.ts`.
8. **Public-assets:** kopiera `<src>/img` → `public/sajtbyggare/<key>/img`, `<src>/css` → `…/css`. Idempotent (skriv över).

- [ ] **Step 1: Write failing unit tests** (`import-template.test.mjs`) — assert `stripChrome` tar bort `<script>` men behåller `data-bs-ride`; `rewriteAssets("src=\"img/a.jpg\"","carserv")` → `/sajtbyggare/carserv/img/a.jpg`; `extractCanonTokens(":root{--primary:#D81324}")` → `colorPrimary:'#D81324'`; `extractCssHrefs` plockar stylesheets, droppar `animate`.
- [ ] **Step 2: Run → fail** (`node --test 5-Kod/scripts/import-template.test.mjs`).
- [ ] **Step 3: Implement** de rena fns + CLI-drivern enligt transform-listan.
- [ ] **Step 4: Run → green.**
- [ ] **Step 5: Commit** `feat(scripts): goal-36 R1 — import-template codemod (vendor → look scaffold)`.

---

### Task 3: Codemod-acceptans — re-derivera en KLAR mall (gyllene referens)

> Beviset att codemoden inte producerar skräp: kör den på en redan hand-byggd, VERIFIERAD mall och få proof-grönt. carserv = referensen (htmlcodex). Sen en cross-familj (haircare = colorlib) för att bevisa att den inte bara funkar på htmlcodex.

- [ ] **Step 1:** Kör codemoden mot carserv till en throwaway-key `carserv2`: `node import-template.mjs --src "4-.../87 carserv-1.0.0/carserv-1.0.0" --key carserv2 --page index.html`.
- [ ] **Step 2:** Placera booking-markören (om TODO), kör `carserv2.proof.test.ts` (auto-genererat) → ska bli grönt utan handpyssel på de mekaniska delarna.
- [ ] **Step 3:** Diffa `carserv2.ts` mot committade `carserv.ts` — avvikelser ska BARA vara i omdömes-delarna (booking-pos, region-urval), aldrig i strip/asset/token. Notera kvarvarande gap i trackern.
- [ ] **Step 4:** Radera throwaway-keyn (`carserv2.*` + `public/sajtbyggare/carserv2`). Detta är en gate, inte en leverans.
- [ ] **Step 5: Commit** ev. codemod-fixar funna här `fix(scripts): goal-36 — codemod parity vs hand-built carserv`.

---

### Task 4: Mät R6 + lås worklisten (`<B>`)

- [ ] **Step 1: R6-mätning:** kör `node 5-Kod/apps/web/lib/sajtbyggare/_optimize/measure-restoran.mjs` (eller motsvarande) + uppskatta bundle-tillägg = Σ(PAGE_HTML-bytes för worklisten). Om < ~tröskel under 10 MiB gzip → **defer R6** med en `ponytail:`-kommentar i `look-registry.ts` som namnger taket + uppgraderingsväg (ladda HTML ur R2/KV). Om över → R6 blir Task 4b (ladda ur storage) FÖRE loopen. *(goal-50 mätte 4 looks = ok; ~15–20 troligen ok — verifiera.)*
- [ ] **Step 2: Lås worklisten** i trackern: kör `scratchpad/scan_booking.py` + korsa mot KATALOG-RAPPORT buildable-grind + skip-regler. Skriv `KATALOG: <N> hittade · <B> byggbara (booking-fit) · <S> skippade (skäl)`. Front-load cross-familj (colorlib/themewagon/untree) tidigt så codemoden bevisas generalisera. **Kandidat-`<B>` (förfinas per beröring):** salonger (haircare, hairsal, haircut, alotan, BarberX, barberz), kliniker (dentcare, orthoc, klar), restauranger (Restaurantly, feane, foody2, baker, cakezone, keto), resa/hotell-reservation (wooxtravel) — minus de 4 klara, minus kräver-köp (hotelier/brber), minus okänd licens (razor).
- [ ] **Step 3: Commit** `docs(sajtbyggare): goal-36 — worklist locked + R6 measured`.

---

## PHASE 1 — Per-mall-loop (Workflow fan-out över worklisten)

> Drivs av **Workflow** (ultracode). En `pipeline()` över worklisten; varje mall flödar oberoende genom stegen (ingen barrier). Front-load cross-familj. Idempotent mot trackern.

**Per-mall-pipeline (Workflow-stages):**
1. **codemod** (agent kör `import-template.mjs` för mallens key + page) → scaffold + public-assets. *(label `codemod:<key>`, phase `Build`)*
2. **build/refine** (agent): placera booking-markören rätt (byt native form, aldrig uppfinn sektion), sätt nav-anchors + sektion-ids, finslipa regioner till verbatim vendor-strängar, behåll attribution. Lös `// CODEMOD-TODO`. *(phase `Build`)*
3. **prove** (agent): kör `<key>.proof.test.ts` → fixa tills **0 FAIL**. Om mallen kräver ny region-typ/mount → markera `BLOCKERAD (schema)` i trackern, **hoppa** (mjuk skip, M3), fortsätt. *(phase `Verify`)*
4. **independent verify** (FÄRSK agent, schema-output): granskar att proofet asserterar mallens UNIKA regioner + lyfta (ej uppfunna) kanon-token + vävd booking + render-bron round-trip; ingen copy-paste-stub; attribution kvar. Verdict {real|stub, skäl}. Rättar EJ sin egen läxa. *(phase `Verify`)*
5. **register + commit** (agent): append `entry(...)` i `look-registry.ts`; uppdatera trackern-raden → `VERIFIERAD 0FAIL, COMMIT <sha>`; `git commit` (en mall = en commit, conv-format `feat(sajtbyggare): goal-36 — <key> look (NN <namn>)`).

**Workflow-skiss (script):**
```js
// meta.phases: [{title:'Build'},{title:'Verify'}]
const WORKLIST = [ /* {key, src, page, namn, bransch} … ur trackern, cross-familj först */ ]
const results = await pipeline(
  WORKLIST,
  t => agent(codemodPrompt(t),  { label:`codemod:${t.key}`, phase:'Build' }),
  (_, t) => agent(buildPrompt(t), { label:`build:${t.key}`,   phase:'Build' }),
  (_, t) => agent(provePrompt(t), { label:`prove:${t.key}`,   phase:'Verify', schema: PROVE_SCHEMA }),
  (p, t) => p?.status === 'green'
    ? agent(verifyPrompt(t), { label:`verify:${t.key}`, phase:'Verify', schema: VERDICT_SCHEMA }).then(v => ({...p, ...t, verdict:v}))
    : { ...p, ...t, verdict:{ real:false, reason:p?.status } },
)
return results.filter(Boolean)
```
> Kör i batchar (front-loaded cross-familj först); läs varje batch-resultat, uppdatera trackern, kör nästa batch tills `<B>` = 0 kvar. Inga prompts mellan mallar (goal-36 §8). Misslyckad mall → `BLOCKERAD`/`KVAR`-rad, ej tyst hål.

**DoD-grindar per mall (annars EJ `VERIFIERAD 0FAIL`):**
- `<key>.proof.test.ts` finns, kör `proofFloor`, är icke-trivial (≥8 regioner + booking + kanon-token + sektion-coverage), grönt.
- `tsc` 0, hela `vitest lib/sajtbyggare` grön.
- `validate_markers.mjs` grön för mallen (känd modultyp, inga föräldralösa markörer).
- Oberoende verify = `real`.
- Registrerad i `look-registry.ts`; tracker-rad uppdaterad; committad.

---

## PHASE 2 — Stäng runet

- [ ] Alla `<B>` = `VERIFIERAD 0FAIL` **ELLER** `BLOCKERAD (schema)` med flagga + krävd typ (inga tysta hål). Skippade redovisade med skäl.
- [ ] Kör hela sviten: `cd 5-Kod/apps/web && npx tsc --noEmit && npx vitest run` → 0 FAIL.
- [ ] `look-registry.test.ts` + galleri-test (goal-50) asserterar nya antal + identiteter (uppdatera förväntat count).
- [ ] Uppdatera `goal-36-...md`-status + `100-TEMPLATES-TRACKER.md` manifest-rad. Sammanfatta: byggda / blockerade / skippade.
- [ ] **STOPP** — deploy = separat Zivar-OK (detachar kunddomäner). Rapportera worklist-utfall terse + ärligt (status-honesty).

---

## Self-Review (mot spec)

- **Spec-täckning:** M1 (faktisk count, ej 100) → Task 4 Step 2. M2 (mall-specifika proofs) → Task 1 + Phase 1 step 3/4. M3 (eskalering schema) → Phase 1 step 3 + Global Constraints. §3-pipeline → Phase 1. §4 ui-ux-pro-max → utgångspunkt vid region/design-tvekan; kanon vinner (noterat). §5 booking-aware → endast `booking` vävd idag; bransch-medveten = goal-40, BLOCKERAD-väg för icke-appointment. §9 isolering/read-only → Global Constraints.
- **De-risk-täckning:** R1 codemod=Task 2; R2 try/catch=redan klart (render-bridge.tsx); R4 floor=Task 1; R5 CSS-scoping → proof asserterar token-mismatch==0 (computed-style-scoping = senare härdning, noteras `KVAR`); R6=Task 4 (mät→defer/bygg); R7 peka-på-HTML-exemplar=carserv referens (Task 3); R8 validate_markers=redan klart + DoD-grind; R3/R10/R11 = per-mall under loopen.
- **Placeholder-scan:** inga "TBD"; kod-steg har kod; codemod-fns namngivna konsekvent (`stripChrome`/`rewriteAssets`/`extractCanonTokens`/`detectRegions`/`emitProof`, `proofFloor`).
- **Typ-konsistens:** `proofFloor(manifest, pageHtml, opts)` + `proofFloor.check(...)` används lika i Task 1; `LookEntry`/`entry()` matchar look-registry.ts; `RegionManifest`/`Region` ur types.ts oförändrade.

## Öppna risker (markerade, ej gissade)
- **Booking-marker-placering** är det enda riktiga omdömes-steget per mall → codemod flaggar, agent löser. Mallar utan tydlig native form → BLOCKERAD, ej uppfunnen sektion.
- **R5 full CSS-scoping** (prefix/shadow) deferras till härdning; idag sid-nivå-CSS + iframe-preview (goal-50). Noteras `KVAR` per look.
- **Bransch-medveten booking** (bord/party_size) beror på goal-40 → restaurang/gym får `booking@appointment` tills vidare eller BLOCKERAD om variant krävs.
