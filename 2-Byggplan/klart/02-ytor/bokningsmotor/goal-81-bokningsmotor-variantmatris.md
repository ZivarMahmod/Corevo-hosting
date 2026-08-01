# Goal 81 — bokningsmotorns fulla variantmatris

**Status:** verifierat lokalt 2026-07-24
**Branch:** `codex/launch-inventory-customer-design`
**Databas:** `localhost-acceptance`; produktion får inte muteras

## Mål

Samma bokningsmotor ska ge korrekt val, plats, datum och kontakt i `wizard`,
`compact`, `drawer` och `inline`. Redan byggd state-/platslogik återanvänds.

## Redan verifierat — byggs inte om

- platsbyte återför wizard till tjänsteval när djuplänkad tjänst blir ogiltig;
- `plats`/`tjanst` accepterar `location`/`service` som kompatibilitetsalias;
- tjänster och personal filtreras mot vald plats;
- den nya kundportalens Boka igen-länk behåller plats.

## Återstående acceptans

- [x] `personal` accepterar kompatibilitetsaliaset `staff`, medan svensk kanon
      vinner och manipulerade arrayvärden nekas.
- [x] En äldre slotrequest får aldrig skriva över ett nyare plats-/tjänst-/
      personal-/datumval.
- [x] Datumfönstret börjar på dagens datum i vald plats tidszon och använder
      platsens `max_advance_days`.
- [x] Den äldre `/konto`-ombokningen hämtar och skapar ersättningsbokningen på
      originalbokningens `location_id`.
- [x] Compact/inline stoppar ogiltig e-post eller telefon före PIN-anropet med
      kanalriktig feltext.
- [x] Alla fyra presentationer använder samma fixar; ingen ny motor eller store.

## Bevis

- RED→GREEN för queryalias, tidszon/datumfönster, ombokningsplats,
  latest-request-wins och compact/inline-validering.
- Riktad Goal 81-svit.
- Full websvit, typecheck, lint utan fel, produktionsbuild och `git diff --check`.
- Minsta representativa browsermatris körs mot Supabase-preview, inte produktion.

## Verifierat utfall

- `351` testfiler och `2745` tester gröna.
- Typecheck och produktionsbuild gröna.
- Lint: `0` fel, `7` tidigare kända varningar.
- Oberoende review: inga kvarvarande Critical/Important.
- Previewbrowser: wizard, `staff`/`service`-alias, compact desktop och compact
  mobil `390 × 844`; datumfönstret började 2026-07-24 och innehöll `366`
  kalenderdagar för `max_advance_days=365`.
- Ingen horisontell mobiloverflow eller browserkonsolfel.
- Previewkunden återställdes till bokningsmodul `off` och variant `wizard`.
- Produktion muterades inte.

## Låsgräns

Målet kan bli 100 procent lokalt. När alla mekaniska prov och previewbrowserfall
är gröna flyttas filen till `2-Byggplan/klart/02-ytor/bokningsmotor/` innan Goal
82 öppnas.
