# Sajtbyggare-editor (S2) — arkitektur + kontrakt

> Kod-doc för goal-37 (S2, visuell innehålls-editor). Status 2026-06-18: **kärnorna
> byggda + verifierade; editor-skalet (React) ej byggt än.** Allt bakom
> `SAJTBYGGARE_ENABLED` (av i prod). Detta är artefakten goal-38 (S3) kräver för
> mount-/prop-/spar-kontraktet — men **goal-38 avblockas FÖRST när goal-37 ligger i
> `2-Byggplan/klart/`** (hela kedjan inkl. staging-render-bevis), inte av denna doc ensam.

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

**Gates denna skiva:** tsc 0 · vitest 594/594 (63 nya) · lint = miljö-trasig (eslint-config-next/rushstack-patch ⊄ ESLint 9.39, samma S1 §8-begränsning) · opennext ej körd (modulerna inerta/oimporterade → noll build-yta).

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

## Mount-/prop-kontrakt (för goal-38) — DESIGN-PENDING (skalet ej byggt)
- **`components/admin/SiteEditor.tsx`** (NY, ej byggd än): editor-skalet (live-preview + sidopanel + spar). Mount-API + props
  (tenant/utkast-id, region-manifest, initial-resolvat-content, flag-state) **låses när komponenten byggs** — markeras ÖPPET tills dess.
- **goal-38 förkravs-gate (maxning §1):** monterings-API + prop-kontrakt MÅSTE vara ifyllt HÄR innan S3 börjar. Spar-signaturen ovan ÄR klar;
  mount/prop förblir ÖPPET → **S3 får inte starta än.**

## Återstående för goal-37 → `klart/` (DoD-gate, ej gjort denna skiva)
1. **Editor-skal (React, flag-gatat):** `SiteEditor.tsx` (klick-overlay som konsumerar `overlay-model` + sidopanel-kontroller per region-typ:
   text → inline/TipTap, bild → återanvänd `components/admin/MediaLibrary.tsx`, färg/font/logo → wrappa `BrandingForm`-skriv-logiken).
2. **Draft-preview (LÅST B):** den RIKTIGA storefront-renderaren med utkast-värden på SAMMA origin (draft-rutt i iframe ELLER inline-render
   med draft-props). ALDRIG iframe av publika live-URL:en (ersätter förkastade `TenantPreviewFrame`). Full trohet: alla sektioner + invävda moduler.
3. **Admin-rutt:** `app/(admin)/admin/sajtbyggare/page.tsx` gatad av `sajtbyggareEnabled()` + admin-auth. Flag-off i prod → 404.
4. **Staging-render-bevis (det riktiga klar-kriteriet):** bygg via `C:\tmp\kod` (ö-path kraschar opennext) → deploya staging-worker
   (`SAJTBYGGARE_ENABLED="true"` ENDAST i `env.staging`) → klick salvia-region → ändra text/bild/färg → spara → storefront-render visar
   nytt värde UTAN deploy (proba). Worker-version + rollback-id noteras. "Känns nära" = INTE klart (18h-läxan).
5. **Inga fasta-yta-regressioner:** booking/superbooking/minbooking + POS `corevo.se` = 200; kund-domäner orörda.
