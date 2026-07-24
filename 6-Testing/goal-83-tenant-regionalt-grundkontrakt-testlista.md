# Goal 83 — verifieringsprotokoll

Datum: 2026-07-24
Branch: `codex/launch-inventory-customer-design`
Databas: Supabase-preview `localhost-acceptance` (`cwnhpesrgolflkmyjbrm`)

## Resultat

- RED bevisade saknad regional kontraktsmodul, för bred telefonnormalisering,
  saknade onboardingfält och saknad propagation genom bokningen.
- GREEN: `354/354` testfiler och `2769/2769` tester.
- TypeScript: `0` fel.
- ESLint: `0` fel; sju äldre, orelaterade varningar.
- Next 15.5.18 produktionsbuild: grön, 11 statiska sidor genererade.
- `git diff --check`: grön.
- Previewmigration `0131_tenant_regional_contract.sql` och två preview-only
  korrigeringsposter är applicerade. Korrigeringarna motsvaras av den slutliga
  samlade definitionen i källmigration `0131`.
- Runtime-SQL: svensk region `1/1`, ogiltiga regionrader `0`, ogiltiga
  tenant-/platstidszoner `0`, aktiva regionala triggers `3`.
- RLS/grants: cross-tenant läsning/skrivning nekas, anon har endast de fyra
  avsedda kolumngrantsen och portal-wrappern är endast körbar av service role.
- Rollback: tenant-, auth-, settings- och platsfixtures `0`.
- Supabase security advisor: inga Goal 83-fynd. Befintliga varningar om flera
  permissiva policies är oförändrade från baslinjen.
- Oberoende appreview, DB-review och slutlig Claude/Fable-review: `CLEAN`.

## Kontrollerade kontrakt

- Befintlig och ny tenant får `SE`, `sv-SE`, `SEK` och
  `Europe/Stockholm` som säker standard.
- `locations.timezone` vinner för kalender och kundcopy; tenantens tidszon är
  endast fallback.
- PostgreSQL-zoner som Node/Intl inte kan använda (`posix/*`, `right/*`,
  `Factory`) nekas.
- Svenska mobilserier som är öppna 2026-07-24 (`070`, `072`, `073`, `076`,
  `079`) normaliseras till E.164. `074`, `077`, ännu ej öppnade `078`,
  fastnäts- och utlandsnummer nekas. Underlag:
  <https://pts.se/contentassets/c67be6d4f65a456d9ed86a2542505b7b/nrplansammanstallning-2026-05-18.pdf>.
- Nya SMS-masker visas lokalt (`070 ••• •• 67`). Historiska `+46`-masker
  accepteras endast ihop med exakt kontakt-digest och projiceras därefter till
  lokalt format.
- Bokning, notifiering och priser läser samma tenantkontrakt.
- Datumfönstret är platsstyrt över skilda tidszoner och DST-gränser.

## Browser-smoke

- `http://demo.localhost:3001` laddar FreshCut mot preview utan serverfel.
- Desktop 1536 px och mobil 390 × 844 px är läsbara.
- Mobilens dokumentbredd är exakt 390 px; ingen horisontell overflow.
- FreshCuts `booking=off`-kontrakt förblir intakt och visar externa
  Bokadirekt-CTA:er. En intern förstebokning körs därför i Goal 84:s syntetiska
  `booking=live`-tenant, inte genom att ändra FreshCuts kundval.

## Avgränsning

Full i18n, skatt/moms och ett andra land är inte byggda. `078` öppnas enligt
PTS först 1 oktober 2026 och kräver då en uttrycklig, testad kontraktsändring.
Produktion är orörd.
