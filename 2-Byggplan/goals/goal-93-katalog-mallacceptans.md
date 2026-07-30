# Goal 93 — katalog och mekanisk mallacceptans

Status: **TEKNISKT GRÖN — SAMLAD ANVÄNDARACCEPTANS I GOAL 86 ÅTERSTÅR**

## Mål

Skapa ett versionerat, kodägt och DB-projekterat katalogkontrakt för
vertikaler, moduler och exakt tolv Corevo-mallar samt bevisa varje designpaket
mekaniskt.

## Leverans

1. En kodägd katalog med schema, ägare, status, capabilities och beroenden.
2. Härledda tema-/onboardinglistor utan parallella handskrivna sanningar.
3. Append-only DB-projektion av 12 mallar, moduler, slots och vertikaler.
4. Fail-closed validator för designmanifest = kod = DB.
5. Explicit deprecation/replacement och fixturebaserad kontraktsmigration.
6. Kataloggenererad desktop-/mobilmatris.
7. Per-paket `accept.spec.ts` + `probe.js`, visual och a11y.

## Klargrind

- Exakt 12 nyvalbara Corevo-nycklar finns i design, kod och preview-DB;
  deprecated/legacy räknas separat.
- Alla referenser, capabilities och versioner valideras.
- 0 fail och 0 oväntat skip för samtliga designpaket.
- 0 console/hydration/404/overflow och 0 serious/critical Axe.
- Baselines kommer från designfacit och verifieras mekaniskt.
- DB-migration, rollback, test, typecheck, lint och build är gröna.
- Användaraudit är genomförd; samlad användaracceptans sker i Goal 86.

## Verifierat 2026-07-30

- Design, kod och preview-DB matchar: 12 nyvalbara teman, 174 rutter och 376
  matrisfall.
- 376/376 browserfall och 12/12 verkliga previewteman är gröna utan skip.
- 5/5 centrala kontraktsfall, 7/7 validator-självtester, katalog-SQL,
  CSS-synk och kontrastvakt är gröna.
- Användarauditen hittade och rättade mobilnavets gemensamma CSS-specificitet
  samt en dubblerad Kontakt-länk i Calytrix. Regressionerna ingår i fullmatrisen.
- Hela kodbasen: 397 testfiler/3 015 tester, typecheck, lint utan fel och build.
- Previewdatabasen var ren efter verifieringen. Produktion är orörd.

Goal 93 kan nu ingå i Goal 86.
