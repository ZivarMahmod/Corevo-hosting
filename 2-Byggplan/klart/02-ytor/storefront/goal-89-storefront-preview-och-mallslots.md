# Goal 89 — storefront, preview och mallslots

**Status:** VERIFIERAT KLART lokalt 2026-07-29. Inte deployad. Ingen main-/produktskärmning.

## Mål

- Publik storefront och preview använder samma modulägna loaders och samma nav/CTA-gating.
- Modulslottning (`shop`, `blogg`, `kurser`, `offert`, `presentkort`, `lojalitet/klubb`, `galleri`)
  fungerar konsekvent mellan publicerad storefront och `/salong-preview/[slug]`.
- Goal 89 levererar en testbar first-version utan ändringar i editor/revisionsmotor/mallbyte.

## Vad som slås fast lokalt

- `app/(public)/page.tsx` och `app/(public)/layout.tsx` använder redan den
  delade modulladdningen:
  - `THEME_LOADS_LAYOUT_MODULES`
  - `loadLayoutModuleTeasers`
  - `StorefrontModuleSections`
  - delade nav/fot-kontrakt.
- `salong-preview/[slug]` använder samma mallstyrda modulnav och CTA-gate som public sida:
  - `THEME_OWNS_MODULES` styr om teasers renderas i preview.
  - `moduleNavigationLinks`, `moduleRouteReachable`, `canonicalModuleHref`.
  - `booking` använder samma paus/404/aktiveringsläge som publika routingregler.
- Mallslots för `kurser` och `galleri` är inkluderade i loadern och navigationen i detta mål.
- Inga nya migrations- eller production-äventyrligheter har lagts till.

## Verifiering

- `corepack pnpm exec vitest run` (körda från `5-Kod/apps/web`):
  - `components/storefront/layouts/module-gating-layouts.test.tsx`
  - `components/storefront/layouts/florist/florist-suite.test.tsx`
  - `components/storefront/layouts/production-layout-module-matrix.test.tsx`
- Resultat: **3 filer, 195 tester passade**.

## Nästa steg

- Goal 90 får ta nästa funktionella lager (innehållsmoduler).
- Goal 89-briefen och denna verifieringsstatus ligger i denna målfil under `2-Byggplan/klart/02-ytor/storefront/`.

## Noteringar

- Den lokala loop/acceptansen för detta mål är snabb och fokuserad:
  publik storefront + preview och modulväxling enligt goal-brieffilen.
