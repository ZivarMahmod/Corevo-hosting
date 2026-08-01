# Goal 83 — tenantens regionala grundkontrakt

**Status:** verifierat klar lokalt 2026-07-24
**Branch:** `codex/launch-inventory-customer-design`
**Databas:** endast Supabase-preview `localhost-acceptance`; produktion är orörd

## Frysta beslut

- Sverige är enda lanseringsmarknaden i detta mål.
- Befintliga `tenant_settings` får fyra typade kolumner: `country_code`,
  `locale`, `currency` och `default_timezone`. Ingen ny tabell eller parallell
  localization-JSON skapas.
- Platsens `locations.timezone` äger alltid bokningskalendern. Tenantens
  `default_timezone` används bara när ingen plats kan ge en tidszon.
- Telefon normaliseras till svensk E.164 vid bokningens servergrind. Nummer för
  andra länder nekas tills ett sådant land stöds uttryckligen.
- Full i18n, moms-/skatteadapter och en andra marknad byggs inte i Goal 83.

## Framtida adaptergränser — dokumenterade, inte byggda

- **Översättning:** notifierings-/sidrenderaren får senare välja en meddelandekatalog
  med `locale` som nyckel. Databasen ska inte lagra översatta systemtexter.
- **Moms/skatt:** checkout får senare anropa en skatteadapter med tenantland,
  valuta, köparland och orderrader och spara resultatet som ett oföränderligt
  ordersnapshot. Ingen skatteberäkning läggs i formatteraren.
- **Nästa marknad:** en egen migration måste först vidga de svenska
  checkvillkoren och lägga till landets telefonstrategi. Okända kombinationer
  ska fortsatt neka fail-closed.

## Acceptans

- [x] Befintliga och nya tenants får `SE`, `sv-SE`, `SEK` och en giltig
      IANA-standardtidszon.
- [x] Bokning, notifiering och prisvisning läser samma regionala kontrakt.
- [x] Svenskt mobilnummer normaliseras till `+46…`, visas lokalt och fel
      land/format nekas.
- [x] Bokningsdatum och tider förblir platsstyrda när browserns tidszon skiljer
      sig från platsens.
- [x] Vanlig tenantidentitet kan inte läsa en annan tenants settings.
- [x] Migration och runtime-SQL passerar på preview; produktion förblir orörd.

## Låsgräns

Målet får låsas 100 procent lokalt efter RED→GREEN, full webbsvit, typecheck,
lint/build, preview-SQL med rollback, advisors och oberoende slutgranskning.

## Låsbevis

- Full webbsvit: `354/354` filer, `2769/2769` tester.
- Typecheck, lint utan fel, produktionsbuild och diffkontroll: gröna.
- Preview-SQL, RLS/grants, rollback och advisors: gröna.
- Desktop-/mobilsmoke: grön utan horisontell overflow.
- Oberoende app-, DB- och Claude/Fable-review: `CLEAN`.
- Testprotokoll:
  `6-Testing/goal-83-tenant-regionalt-grundkontrakt-testlista.md`.
- Produktion är orörd.
