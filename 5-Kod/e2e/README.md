# E2E med Playwright

Playwright-sviten finns i `e2e/` och konfigureras av `playwright.config.ts`.
Tester märkta `@mutating` får endast köras mot den guardade, disponibla
preview/stagingdatabasen. Peka aldrig E2E mot produktion eller kunddata.

## Kommandon

Kör från `5-Kod/`:

```powershell
pnpm test:e2e:readonly
pnpm test:e2e
pnpm test:e2e:ui
```

`test:e2e:readonly` betyder att specen inte avsiktligt muterar data. Det gör inte en
godtycklig målmiljö säker. Kontrollera alltid host, Supabase-projekt och
testidentiteter före körning.

## Isolerad databasfixtur

`apps/web/scripts/e2e-db.mjs` vägrar skriva om den länkade Supabase-referensen inte
matchar både `E2E_SUPABASE_PROJECT_REF` och den separata allowlisten
`E2E_ALLOWED_SUPABASE_PROJECT_REF`, eller om den matchar
`PRODUCTION_SUPABASE_PROJECT_REF`. Fixturen använder syntetiska identiteter och ett
engångslösenord som anroparen måste sätta i `E2E_PASSWORD`; lösenordet får inte
sparas i en beständig fil eller Git och skriptet skriver aldrig ut det. Den
temporära SQL-filen raderas i `finally`, även när CLI-körningen faller.

```powershell
node apps/web/scripts/e2e-db.mjs teardown
node apps/web/scripts/e2e-db.mjs verify
node apps/web/scripts/e2e-db.mjs seed
pnpm test:e2e
node apps/web/scripts/e2e-db.mjs teardown
node apps/web/scripts/e2e-db.mjs verify
```

Generera och exportera `E2E_PASSWORD` innan seed-steget och använd samma värde i
Playwright-processen. Kör `teardown` och `verify` även när testsuiten faller.
`verify` ska vara grönt innan körningen får rapporteras ren.

Fixturidentiteterna ägs av `supabase/seeds/e2e-seed.sql` och
`e2e/helpers.ts`. Lägg inte konton eller lösenord i denna README.
Seeden innehåller ett syntetiskt kundkonto med två genomförda besök,
favoritpersonal, ett personalinternt klientkort och en aktiv framtida bokning.
Saknas någon av de raderna ska motsvarande spec falla; sviten skippar inte en
trasig eller ofullständig seed.

## Mål och server

- Utan `E2E_BASE_URL` startar Playwright webbappen lokalt.
- `E2E_PORT` byter lokal port om standardporten `3000` redan används.
- Med `E2E_BASE_URL` används den uttryckliga körande miljön och ingen lokal server
  startas.
- `E2E_BOOKING_HOST` anger backofficehost när standardvärdet inte passar målet.
- Lokalt använder storefronttester tenantens riktiga host
  `frisor1.localhost:<E2E_PORT>`.
- Ett explicit fjärrmål kräver `E2E_TENANT_HOST`; helpern gissar aldrig en
  storefronthost från `E2E_BASE_URL`.

CI:s fulla suite är villkorad i `.github/workflows/ci.yml` och förutsätter en
isolerad, seedad stagingmiljö. Ett grönt lokalt test bevisar inte CI, staging eller
produktion.

## Klassning

- `@readonly`: inga avsiktliga writes; kör ändå bara mot godkänd testmiljö.
- `@mutating`: bokningar, schema, tjänster eller tenantdata kan ändras; kräver
  disponibel seed och efterföljande teardown/verify.
- `e2e/acceptans/`: mekaniska acceptanspaket med egna probes/baselines; kör endast
  enligt respektive pakets kontrakt.

Vid fel ska trace, screenshot och rapport behandlas som potentiell kunddata. Dela
eller committa dem inte utan granskning.
