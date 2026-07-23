# Goal 79 — lokal acceptans: FreshCut kundwebb

Status: **GRÖN lokalt 2026-07-23. Inte deployad.**

## Miljö

- Kodgren: `codex/launch-inventory-customer-design`
- Supabase-preview: `localhost-acceptance`
  (`cwnhpesrgolflkmyjbrm`)
- Syntetisk tenant: `11111111-1111-1111-1111-111111111111`
- Lokal publik värd: `http://demo.127.0.0.1.nip.io:3100`
- Produktion lästes eller skrevs inte under acceptansen.

## Verifierat

- [x] FreshCut renderar den godkända källans struktur och fem lokala
  originalbilder.
- [x] Sju verkliga serviceposter visar rätt namn, tid och pris från preview-DB.
- [x] Desktop 1440 × 900: hero, prislista, resultat, kontakt och footer visuellt
  kontrollerade.
- [x] Mobil 390 × 844: ingen horisontell overflow, fast boknings-CTA och
  fungerande meny.
- [x] Mobilmenyn visar `Priser`, `Resultat`, `Salongen`, `Kontakt`; framtida
  modulvägar kan fortfarande läggas till.
- [x] 19 renderade Bokadirekt-länkar går till samma HTTPS-adress med
  `target="_blank"` och `rel="noopener noreferrer"`.
- [x] Noll interna `/boka`-länkar renderas när bokningsmodulen är `off`.
- [x] Kontakt, adress, telefon, mejl och Instagram läses från tenantdata.
- [x] Svarta CTA-knappar har ljus, synlig text.
- [x] Kundens sparade copy/media vinner fortfarande över FreshCut-defaults.
- [x] Varukorgens lokala token fungerar även när `crypto.randomUUID` saknas.

## Automatiska bevis

- `pnpm typecheck` — grön.
- `pnpm lint` — 0 fel; endast sju sedan tidigare orelaterade varningar.
- 211 riktade storefront-, tema- och modultester — gröna.
- `pnpm build` mot Supabase-preview — grön.
- Fable 5 oberoende granskning — `NO P0/P1`.

## Kvar före lansering

- Zivar går igenom den samlade localhost-versionen tillsammans med Codex.
- Deploy, produktionsmigration eller produktionsdataskrivning görs först efter
  det uttryckliga gemensamma lanseringsbeslutet.
