# goal-50 — status (BOXEN: mall-register + galleri)

> 2026-06-26. Byggt i main (unpushed), bakom `SAJTBYGGARE_ENABLED`. INGEN prod-deploy
> (detachar kunddomäner) → STOPP för Zivars browser-verify. Arkitekturbeslut +
> 3-render-väg-kartan: `goal-50-ARKITEKTURBESLUT.md` (läs den FÖRST).

## Commits (main, unpushed)
- `a3c42a8` foundation — look-registry + R2 + R8 + distinct-proof
- `b23d027` M5+M6 — flat look-galleri + render-bron-preview (iframe)
- `c0381e1` M8+M9 — vald look persisteras + renderas live på storefront
- `58b3446` M10 — grep-guard: look-vägen tema-fri

## KLART (mekaniskt bevisat — 759 tester gröna, tsc 0)
| # | Vad | Bevis |
|---|---|---|
| Box | `look-registry.ts` = EN lista av 4 render-bron-looks (restoran/klinik/drivin/carserv), inga teman, ingen bransch | look-registry.test (7) |
| Galleri | Studions "Välj mall"-steg = platt thumbnail-grid av ALLA looks, **0 bransch-filter** (live-bevis #2) | render-smoke gallery-test |
| Distinkt | 3 val = 3 synligt olika previews via render-bron (iframe → look-route); pairwise-distinct HTML + ≥3 paletter (live-bevis #3) | look-distinct.test (5), StorefrontPreview.test |
| Live | Vald look persisteras (`settings.look`) → publika storefronten renderar lookens riktiga HTML + väver in live BookingMount | storefront-look-dispatch.test (3) |
| R2 | renderTemplate try/catch → safe fallback, ingen 500 på trasig/null HTML | render-bridge.test (8) |
| R8 | `validate_markers.mjs` fångar felstavad modultyp; CLI grön för de 4 | validate-markers.test (5) |
| Tema-fri | Look-vägen har 0 WIZARD_THEMES/THEME_KEYS/theme==='salvia' | look-path-no-theme.test (4) |
| Flagg-OFF | Box passas bara när flaggan PÅ; `settings.look` skrivs bara när PÅ; CreateTenantForm orörd; legacy tema-lista byte-identisk | render-smoke flag-OFF-test + tenants.ts gate |
| RLS | Ingen migration/RLS-ändring (registret är KOD) | — |
| Anti-stub | Per-mall-proofs (carserv/klinik/drivin) asserterar UNIKA region-id + canon-hex + booking-pos | befintliga proofs |

## PARKERAT (ärligt — INTE byggt, beror på goal-37-overlay)
- **Per-look innehållsredigering (hero/accent IN i den valda looken).** SiteEditor-komponenten
  är redan look-agnostisk (tar `templateKey`+`regions` som props, ingen salvia-hårdkodning).
  MEN: lookens hero-text är inbakad i vendor-HTML:en. Att låta studions text/brand-paneler
  (eller SiteEditorns klick-redigera) skriva ÖVER lookens inbakade text kräver
  region-overlay PÅ vendor-HTML — det är goal-37:s "klicka-redigera-overlay", PARKERAT.
  Idag: en look-tenant renderar lookens FAITHFUL vendor-innehåll + riktig bokning (distinkt,
  funkar). Studions accent/hero/tagline-redigeringar slår igenom på TEMA-tenants, inte på
  render-bron-looks. → nästa slice.
- **CSS-scoping (R5) full.** Lookens vendor-CSS laddas sid-nivå (samma som spiken; "per-mall
  onboarding-kostnad mätt i F3"). Studio-previewen är iframe-isolerad (R5 löst där); publika
  look-rendern är sid-nivå-CSS i en slim shell (minskad Corevo-CSS-yta). Full prefix/scope =
  goal-36 R5-härdning.
- **R6 i skala.** 4 looks = ~ok i worker-bundeln. goal-36:s ~30+ looks → ladda HTML ur R2/KV
  (inte bundeln). Ceiling-kommentar finns i look-registry.ts.

## Deploy-pending (kan ej live-bevisas denna session)
- Ingen tenant har `settings.look` än (skapas först av flagg-PÅ-onboarding i prod). Storefront-
  render-bron-vägen är enhetstestad (getLook + renderTemplate + proofs), live-bevisas vid deploy.
- STOPP för Zivars browser-genomgång: superbooking.corevo.se/salonger/ny → "Välj mall" → 3 olika
  val ger 3 olika previews → Lansera → (efter deploy) lookens publika sida.

## Flytta till klart/ FÖRST när Zivar browser-verifierat (ej nu).
