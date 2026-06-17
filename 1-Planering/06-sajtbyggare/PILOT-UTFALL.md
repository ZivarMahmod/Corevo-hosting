# PILOT-UTFALL — sajtbyggare fidelity-pilot (restoran)

> Utfall av en `ce-optimize`-körning som konvergerade **mönstret** för att göra EN katalog-mall till en
> trogen, redigerbar sajtbyggare-mall — så att goal-36 (alla ~100) kan köra mönstret med mekaniskt bevis.
> Pilot = `restoran` (katalog `23 restoran-1.0.0`). Datum: 2026-06-17. Allt bakom `SAJTBYGGARE_ENABLED`, inget deployat.

## TL;DR
- **Fidelity 1.75 → 4.13–4.63 / 5** på EN experiment-iteration (keystone). Alla 8 vendor-sektioner trogna, 17 redigerbara regioner, alla mekaniska grindar gröna.
- Oberoende vision-diagnostik bekräftade: **0 verkliga mall-luckor** kvar — resten under 5/5 är mät-artefakter, inte mall-fel.
- Branch `optimize/sajtbyggare-pilot-fidelity`, commits `6d2e602` (harness), `c9ff7d7` (exp1), `99469c8` (harness-accuracy).

## MÖNSTRET (detta matar goal-36 — kör per mall)
1. **Verbatim kopia av vendor-HTML, alla sektioner.** Lyft varje sektion EXAKT (klasser/struktur/text). Transformer (enbart dessa):
   - asset `img/…` → `/sajtbyggare/<mall>/img/…`
   - strippa ALLT JS + JS-only attribut (`<script>`, `data-bs-*`, `data-toggle`, owl/tempusdominus/wow-hooks), spinner-loadern, modaler, navbar-toggler/dropdowns → in-page-ankare.
   - ersätt vendor-modulblocket (t.ex. reservations-`<form>`) med EXAKT en `<corevo-module type="booking" pos="…">`-markör (render-bron byter den mot live-modulen).
2. **Manifest** `manifest/<mall>.ts` enligt `manifest/salvia.ts`-mönstret: deklarera redigerbara regioner (text→`{store:'copy'}`, färg/font/logo/bild→`{store:'branding'}`). **Färg/font lyfts VERBATIM ur vendor-CSS** (aldrig re-härled) med källa i kommentar. Text/bild = exakta vendor-strängar/paths. Inga duplicerade nycklar.
3. **Kopiera ALLA refererade vendor-bilder** till `public/sajtbyggare/<mall>/img/` (annars 404 → `missing_assets`).
4. **CSS-scoping under `[data-tenant]`/`.corevo-tpl-scope`** — prefixa vendor-CSS så Bootstrap-globaler inte läcker mellan mallar. **OBS: fidelity-neutralt** (syns inte i domaren) men KRÄVS för multi-mall. Gör det som mönster-arbete, grinda det INTE på fidelity-vinst.

## HARNESS (återanvändbar — `5-Kod/apps/web/lib/sajtbyggare/_optimize/`)
- `restoran-metrics.test.ts` — TS/vitest: render-proof-invarianter (= `render_proof_failures`) + strukturella metriker → `.last-metrics.json`.
- `measure-restoran.mjs` — node: kör proben, + Playwright **dual static-render** (VÅRA vs vendor, scripts/CDN blockerade = äpplen-mot-äpplen) → screenshots + computed-style exakt-token-koll → en JSON med 8 nycklar.
- **Vision-domare** (workflow, 3-domar-panel, median) jämför VÅR render mot vendor-originalet sektionsvis (1–5). Är PRIMÄR-metriken (det render-proof INTE kan se).
- Grindar (kör först, billiga, mekaniska — håller "aldrig ögonmått"-lagen): `render_proof_failures==0`, `exact_token_mismatches==0`, `unresolved_module_markers==0`, `editable_regions>=1`, `modules_woven>=1`.

## LÄRDOMAR / FÄLLOR (läs INNAN 100-körningen)
1. **Domar-varians ~±0.5** (samma mall, 2 paneler: 4.63 vs 4.13). → keep-tröskeln i 100-körningen måste vara **≥0.5**, eller median-av-paneler. Spec:ens 0.3 ligger I bruset. exp1:s +2.88 mot baseline är långt över bruset = säker.
2. **Token-grinden måste valideras mot ett RIKTIGT manifest, inte bara baseline.** En latent bugg flaggade text/bild-defaults som font-tokens (12 falska träffar på exp1) — baseline hade inget manifest så den var dold. Den adversariella verifieraren missade det av samma skäl.
3. **Statiskt vendor-referent: self-hosta INTE fonter/ikoner.** Det gör VÅR render olik den statiska vendor-referenten (vendor faller tillbaka utan CDN) → domaren straffar. Fonter/FA-glyfer-fallback är en dokumenterad statisk-läge-kompromiss; jaga dem inte.
4. **Vendor-spinnern måste döljas i referent-renderingen.** Vendorns egen `#spinner`-loader (JS-borttagen normalt) täcker hero-sektionen i statiskt läge → blank referent. Injicera `#spinner{display:none!important}` i vendor-renderingen (symmetriskt med att vi strippar vår spinner) för rättvis hero-jämförelse.
5. **Modul-sektioner domas via en statisk stand-in** (live `BookingMount` kräver DB). Domaren ser stand-in:en, inte riktiga modulen. Doma modulens PLACERING/passform mot mallen, inte stand-in:ens detaljer.

## ÖPPNA PUNKTER (ärver till granne-goals — rör EJ här)
- **Resolver-wiring** för 6 nya copy-fält i restoran-manifestet (`aboutEyebrow`, `menuEyebrow`, `menuTitle`, `reservationTitle`, `teamEyebrow`, `teamTitle`) — deklarerade + konforma, men ej backade av en resolver ännu (kräver out-of-scope-filer → goal-37/F2-samordning). Manifest-KONFORMANS (form) håller, vilket är vad proben kräver.
- **Booking bransch-medvetenhet** (bord/`party_size` istället för salong-läge) = goal-37, rör read-only `booking-mount.tsx`. Pilot väver/placerar EXISTERANDE modul troget; bygger inte om den.
- **CSS-scoping** (mönster-punkt 4) — gjordes EJ i piloten (1 mall behöver det ej); KRÄVS i 100-körningen.

## RESULTAT
| | baseline | exp1 |
|---|---|---|
| mean_fidelity (orig referent) | 1.75 | 4.63 (+2.88) |
| mean_fidelity (fair referent) | — | 4.13 (ärlig absolut) |
| section_coverage | 0.375 (3/8) | 1.0 (8/8) |
| editable_regions | 0 | 17 |
| alla grindar | (editable FAIL) | gröna |
