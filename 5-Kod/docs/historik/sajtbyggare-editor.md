> **RIVET 2026-07-12 — HISTORIK.** Sajtbyggarens egna ytor och moduler är BORTTAGNA ur
> kodbasen (app/sajtbyggare-spike/, app/(admin)/admin/sajtbyggare/, components/admin/SiteEditor.tsx,
> hela lib/sajtbyggare/, SAJTBYGGARE_ENABLED-flaggan). Dokumentet sparas som historik —
> det beskriver INTE nuvarande kod. Datalagret lib/storefront/skin/ lever vidare.

# Sajtbyggare-editor (S2) — arkitektur + kontrakt

> Kod-doc för goal-37 (S2, visuell innehålls-editor). Status 2026-06-18: **kärnor +
> editor-skal byggt + STAGING-render-bevisat (preview + edge-XSS + build + spar-wrapper).
> ENDA KVAR = interaktiv inloggad save-klick + prod-revalidate = Zivar-login-verify.**
> Allt bakom `SAJTBYGGARE_ENABLED` (av i prod, på i staging). Detta är artefakten goal-38
> (S3) kräver för mount-/prop-/spar-kontraktet — nu KONKRET (se nedan). **goal-38 avblockas
> FÖRST när goal-37 ligger i `2-Byggplan/klart/`** (efter Zivars login-verify).

## ⬆️ STAGING-RENDER-BEVIS 2026-06-18 (mekaniskt 0 FAIL)
Worker `bokningsplatformen-staging` v **`49a50905-4a94-455f-8408-947fab08f1d8`** (`SAJTBYGGARE_ENABLED="true"` ENDAST i env.staging; prod top-level fortsatt `"false"`). opennext build PASS ("Compiled successfully"), tsc 0, vitest **612**. curl-proba mot `test-barber` (enda aktiva salvia-tenant):
- **Draft → riktig render:** `?draft={"hero.title":"S2PROOF7788"}` → strängen renderas i den RIKTIGA `<h1 heroTitle>` (200). LÅST-B-kärnan bevisad: utkast → samma render-väg som publika storefronten.
- **Edge-XSS strippad LIVE på Workers:** `?draft={"hero.title":"<script>alert(1)</script>KVARTEXT9","color.primary":"#aa0000"}` → renderad `<h1>KVARTEXT9</h1>` (script borta), färg `#aa0000` applicerad. Råt exekverbart `<script>alert(1)</script>` i HTML = **0** (det enda `alert(1)` = Next flight-data, unicode-escapat `<script…`, icke-exekverbart — samma som publika sidan).
- **Ingen regression:** `corevo.se` 200 + `booking.corevo.se` 200 (bara staging deployad, prod orörd). Staging `/admin/sajtbyggare` = 307→login (auth-gatad, ej öppen).
- **Spar-wrappern exekverad (vitest `save-site-content.test.ts`, 9 tester):** flagga/tenant/RBAC-fence, fail-closed, upsert av apply-kärnans output (region-granulär bevarad), `revalidateTenant` (=live utan deploy), XSS-strip-före-persist, DB-fel→ok:false.
- **KVAR (Zivar-login, EJ curl-bart):** interaktiv klick på sidopanel-kontroll + "Spara" i browser → saveSiteContent → prod-revalidate gör det live. Spar-LOGIKEN är bevisad (wrapper-test + draft-render); den interaktiva UI-klick-loopen + prod-revalidate = standard inloggad verify (som goal-17/20).

## Motorval (BESLUTAT, as-built)
**Eget litet "klicka-på-elementet"-overlay** (INRIKTNING-modellen, LÅST 2026-06-16),
INTE en page-builder.
- **GrapesJS = FÖRKASTAD och RADERAD** ur repot (commit `db3ec59` "radera förkastad
  GrapesJS-editor"). Page-builder = fel modell för "klicka-på-fast-mall". (`grapesjs`
  ligger kvar som oanvänd dep i package.json — städas separat, importeras ingenstans.)
- **Reserv om eget overlay spränger grindarna:** GrapesJS-overlay → Puck (MIT) edit-only.
  Ej aktuellt — eget overlay räcker för text/bild/färg.
- **TipTap (inline rich-text):** PLANERAD men **ej tillagd denna skiva** (ny nät-dep;
  install undveks). v0-inline-text editeras via sidopanel-kontroll + saneras vid spar
  av edge-saneraren; TipTap är rich-text-uppgraderingen (fet/kursiv/länk) i en senare skiva.

### Motor-grind §1-mätvärden (goal-37 maxning §1) — ärligt utfall denna skiva
- **h:** ej en tidsboxad spik — kärnorna byggdes direkt (motorvalet redan låst + GrapesJS
  redan raderat, så ingen omprövning behövdes).
- **LoC (eget overlay-kärna, byggd hittills):** `editor/overlay-model.ts` ≈ 90 rader
  (region-bindning + draft-state, PURE). React-skalet (overlay-rendering + sidopanel +
  iframe) ej byggt → den fulla overlay-LoC mäts när skalet byggs (≈800-taket gäller då).
- **Olösta interaktions-buggar:** 0 i den byggda logik-kärnan (14 tester gröna). Skal-buggar
  (overlay-position vid scroll, fokus-krock) uppstår först när React-skalet finns.

## Byggt + verifierat denna skiva (PURE, mekaniskt bevisat)
| Modul | Vad | Tester |
|---|---|---|
| `lib/sajtbyggare/sanitize.ts` | Edge-XSS-sanerare (allowlist på html-react-parser→htmlparser2, ingen jsdom). `<corevo-module type/pos>` överlever, alla XSS-vektorer (script/on*/srcset/style/expression/data:/nästlad-modul/okänd-typ) strippas. + `isSafeUrl`/`sanitizeColor`/`sanitizeFontFamily`/`sanitizeRegionValue`. | 25 (fuzz, båda riktningar) |
| `lib/sajtbyggare/site-content-edit.ts` | PURE spar-kärna: region-edits → nya `settings.copy` + `branding`, **fail-closed** (okänd region/osäkert värde → skriv inget), region-granulär merge, array-index (hero_images[0]), prev bevarat, ingen mutation. | 12 |
| `lib/sajtbyggare/save-site-content.ts` | `'use server'`-action: auth (`requirePortal('admin')`+`getAdminTenant`) + goal-21 RBAC (`canWrite 'Branding'`) + flag-gate → läs prev → `applySiteContentEdits` → upsert `tenant_settings` (samma seam som `admin/actions.ts`) → `revalidateTenant` (live utan deploy). | (kärna täckt) |
| `lib/sajtbyggare/editor/overlay-model.ts` | PURE klick-overlay-modell: `regionRefFromAttrs` (DOM-marker→region), draft-state (set/clear/blank/toEdits), `effectiveValue`/`isModified` (preview + badge), `hasUnsavedChanges`. | 14 |

**Gates (2026-06-18, full skiva inkl. skal):** tsc 0 · vitest **612** · **opennext build PASS** ("Compiled successfully", worker.js byggd via `C:\tmp\kod`) · staging-deploy + curl-render-bevis (se ovan) · lint = miljö-trasig (eslint-config-next/rushstack-patch ⊄ ESLint 9.39, samma S1 §8-begränsning).

## Sanerings-gränsen (kritiskt — XSS)
- **Sanera vid SPAR** (server-action `saveSiteContent` → `sanitizeRegionValue`), ALDRIG per render-request.
- **Edge-kompatibelt:** allowlist ovanpå `htmlToDOM` (html-react-parser = html-dom-parser→htmlparser2),
  den parser render-bron redan kör på Workers. **INGEN jsdom/DOMPurify** (import-grep i `sanitize.test.ts`).
- **`<corevo-module>` släpps ENBART** med känt `type` (booking/shop/offert/lojalitet/presentkort/blogg)
  + slug-säkert `pos`, inga andra attribut, aldrig nästlad. Allt annat strippat. Bryts detta → render-bron väver inte modulen.

## Spar-kontrakt (för goal-38 — DEFINIERAT)
```ts
// lib/sajtbyggare/save-site-content.ts  ('use server')
type SiteContentEdit = { regionKey: string; value: string }   // value = osanerat; '' = rensa override
type SaveSiteContentResult = { ok: true } | { ok: false; error: string }
async function saveSiteContent(templateKey: string, edits: SiteContentEdit[]): Promise<SaveSiteContentResult>
```
- `templateKey`: mall (S2 = `'salvia'`; registret `TEMPLATE_MANIFESTS` utökas per mall).
- **Fail-closed:** okänd region eller osäkert värde → `{ ok:false }`, inget skrivs.
- Skriver Kund-lagret: TEXT→`settings.copy.<field>`, bild/färg/font/logo→`branding.<field>` (array-index för `hero_images[0]`).
- Resolvar som `modifierad` ovanpå Bransch/Universal via `resolveSiteContent` (S1). **Samma väg återanvänds av S3 — mappa inte om.**
  - ⚠️ S3-not: `saveSiteContent` skriver den INLOGGADE adminens egen tenant (`getAdminTenant`). Onboarding (operatör skapar ANNAN tenant)
    behöver en plattforms-scopad variant som återanvänder `applySiteContentEdits` + sanitize-kärnan mot mål-tenantens id. Låses när S2-skalet byggs.

## Mount-/prop-kontrakt (för goal-38) — KONKRET (skalet byggt)
```ts
// components/admin/SiteEditor.tsx  ('use client')
export type SiteEditorRegion = { key:string; type:'text'|'image'|'color'|'font'|'logo'; value:string|null; provenance:'standard'|'modifierad'; label:string }
export type SiteEditorMediaAsset = { id:string; url:string; alt:string|null }
export function SiteEditor(props: { slug:string; templateKey:string; regions:SiteEditorRegion[]; mediaAssets:SiteEditorMediaAsset[] }): JSX.Element
```
- **Mount-API:** `import { SiteEditor } from '@/components/admin/SiteEditor'`. Klient-komponent; två-kolumn (sidopanel + iframe-preview).
- **Prop-kontrakt:** `slug` (tenant), `templateKey` (`'salvia'`), `regions` (resolverade via `loadSiteContent` + svensk `label` per nyckel — se `app/(admin)/admin/sajtbyggare/page.tsx` `REGION_LABELS`), `mediaAssets` (`listMediaAssets(tenant.id)` → `{id,url,alt}`).
- **Spar-väg den ÅTERANVÄNDER:** `saveSiteContent(templateKey, draftToEdits(draft))` (signatur ovan). S3 monterar SAMMA komponent + SAMMA spar-väg — ingen andra editor.
- **goal-38 förkravs-gate (maxning §1):** (a) mount-API ✓ (b) prop-kontrakt ✓ (c) spar-signatur ✓ — alla KONKRETA. ⚠️ S3-specifikt: `saveSiteContent` skriver den INLOGGADE adminens egen tenant; onboarding (operatör skapar ANNAN tenant) behöver en plattforms-scopad variant som återanvänder `applySiteContentEdits`-kärnan mot mål-tenantens id (se §Spar-kontrakt-noten). **S3 startar FÖRST när goal-37 i `klart/`** (efter Zivars login-verify).

## Status för goal-37 → `klart/`
1. ✅ **Editor-skal (React, flag-gatat):** `SiteEditor.tsx` (sidopanel-kontroller per region-typ: text→textarea (TipTap = senare uppgradering, nät-dep undveks); bild/logo→`MediaPicker` över redan-laddade `mediaAssets` (ingen ny R2-uppladdare); färg→`<input type=color>`+hex; font→`<select>`) + debouncad iframe-preview. Commit `bd4cda0`.
2. ✅ **Draft-preview (LÅST B):** `app/sajtbyggare-spike/preview/[slug]/page.tsx` — RIKTIGA `SalviaLayout` + chrome (Nav/FooterFull/BookingProvider/injectTenantTokens) med utkast-värden, SAMMA origin, ALDRIG iframe av live-URL. Booking-gate + customOverride-CSS-paritet (granskar-fix `5a0f75f`).
3. ✅ **Admin-rutt:** `app/(admin)/admin/sajtbyggare/page.tsx` gatad av `sajtbyggareEnabled()` + `requirePortal('admin')`. Flag-off prod → notFound; staging → 307→login.
4. ✅ **Staging-render-bevis:** §STAGING-RENDER-BEVIS ovan (v `49a50905`; draft renderar, XSS strippad live, prod orörd, opennext build PASS).
5. ✅ **Inga fasta-yta-regressioner:** `corevo.se` 200 + `booking.corevo.se` 200 (bara staging deployad).
6. ⛔ **KVAR (enda) = Zivar-login-verify:** logga in på staging som test-barber-admin → `/admin/sajtbyggare` → klicka kontroll → ändra → "Spara" → ladda om storefront → nytt värde UTAN deploy. (Spar-LOGIKEN bevisad: wrapper-test + draft-render; den interaktiva klick-loopen + prod-revalidate kräver browser-session — samma slags inloggad verify som goal-17/20.) **EFTER → flytta goal-37 → `2-Byggplan/klart/02-ytor/sajtbyggare/` → avblockar goal-38.**
