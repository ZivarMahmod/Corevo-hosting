# Goal 89 — storefront, preview och mallslots

**Status:** KODKLAR — lokal teknisk verifiering grön 2026-07-29. Slutlig samlad
acceptans görs i Goal 86.

## Syfte

Publik storefront och superadminens preview ska visa samma modulägda innehåll
med samma navigation, CTA-gating och modulstates. Mallarna ska äga placering
och utseende, inte verksamhetsdata eller modulbeteende.

## Leverans

- Gemensam React-fri module-surface-katalog.
- Gemensamma modul-teasers/loaders för preview och publik sida.
- Fasta mallslots med generisk fallback.
- Samma route- och CTA-gating på båda ytorna.
- Kompatibilitetsdiff före mallbyte/publicering.
- Bevarat verkligt innehåll och bevarad verksamhetsdata vid mallbyte.

## Avgränsning

Goal 89 bygger inga nya blogg-, kurs-, galleri-, presentkorts- eller
lojalitetsfunktioner. Det gör endast den gemensamma storefront-/previewytan
redo att bära dessa moduler säkert. End-to-end-låsning av innehållsmoduler är
Goal 90.

## Beroenden

- Goal 87:s modulstate och readiness.
- Goal 88:s gemensamma kundarbetsyta, revisionsägande och mallbyteslås.
- Befintliga loaders och RLS-kontrakt.

## Fastställda implementationsbeslut

- Den befintliga `module-navigation.ts` är katalogens ägare. Den utökas vid
  behov; ingen parallell katalog skapas.
- Den befintliga `LayoutModuleTeasers` är dataformatet mellan loader och theme.
  `loadLayoutModuleTeasers` är den gemensamma läsaren.
- Den befintliga `StorefrontModuleSections` är generisk fallback. `variant=
  "teaser"` används på startsidan och `variant="full"` på modulens egen sida.
- `moduleNavigationLinks`, `moduleRouteReachable` och
  `canonicalModuleHref` är den gemensamma navigation-/CTA-gaten.
- Kompatibilitetsdiffen ska vara en ren jämförelse av aktiv/vald theme, deras
  deklarerade slots och tenantens befintliga content slots. Den får bara
  rapportera saknade eller ändrade slotreferenser; den får inte skriva data.
- Den enda preview-vägen för acceptans är
  `/salong-preview/[slug]` med befintliga `theme`- och `copy`-parametrar.
- Vid saknad specialvy används den generiska fallbacken. Om fallbackens
  datakrav inte är uppfyllda döljs slotten fail-closed.

## Teknisk verifiering

- Fokuserad modul-/preview-svit: grön, 7 filer/209 tester.
- Full webbsvit: grön, 376 filer/2 909 tester.
- Typecheck: grön.
- Lint: 0 fel, 7 befintliga varningar.
- Produktionsbuild: grön.

## Klarkrav

Se `6-Testing/goal-89-storefront-preview-mallslots-testlista.md`. Alla
blockerande punkter måste vara gröna på samma branch. Lokal kodklarhet räcker
inte som produktionsdeploy eller liveacceptans.
