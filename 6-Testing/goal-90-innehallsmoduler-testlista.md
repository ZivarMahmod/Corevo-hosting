# Testlista — Goal 90

## Blogg

- [x] Draft och arkiverat innehåll nekas anon via ID och slug.
- [x] Publish/unpublish/archive är atomiskt, auditerat och idempotent.
- [x] Slug är unik inom tenant men kan återanvändas av annan tenant.
- [x] Pagination är deterministisk utan dubbletter.
- [x] Canonical, metadata och sitemap är korrekta.

## Kurser/events

- [x] Två samtidiga sista-platsförsök kan inte överboka.
- [x] Avbokning frigör plats exakt en gång.
- [x] Inställt event bevarar registreringar, orsak, tid och aktör.
- [x] Retry av samma onsite-anmälan skapar högst en registrering.
- [x] Betald avbokning använder en verifierad partiell refund/outbox eller
      failar stängt utan statusändring; hel orderrefund används aldrig.
- [x] Onsite-avbokning skapar ingen refund.

## Galleri/media

- [x] Reorder är atomisk och identisk i admin, preview och storefront.
- [x] Cross-tenant asset-ID avvisas av DB.
- [x] Använd media kan inte raderas tyst.
- [x] Varje användning har `alt_override` eller är uttryckligen dekorativ.

## Roller och ytor

- [x] Staff nekas mutationer; ägare hålls inom tenant; superadmin auditeras.
- [x] `off/draft/live/paused`, tomt och fel ger beslutat utfall.
- [x] Mobil 390 px och desktop verifieras utan overflow eller blockerad action.

## Körbevis 2026-07-29

- Preview: `cwnhpesrgolflkmyjbrm` (`localhost-acceptance`), sju Goal 90-migrationer.
- SQL: blogg, event och galleri/media gröna; alla transaktioner rollbackade och
  fixturekontrollen gav 0 rader i samtliga berörda tabeller.
- Samtidighet: två separata anrop mot en sista plats gav 1 lyckad registrering,
  1 `event_capacity_exceeded`, slutresultat `registrations=1`, `occupied=1`.
- Vitest: 383 testfiler, 2 944 tester, samtliga gröna.
- `pnpm typecheck`: grön.
- `pnpm lint`: 0 fel, 7 sedan tidigare kända varningar utanför Goal 90.
- `pnpm build`: grön.
- Browser: admin→preview→storefront, 390 px och 1440 px; identisk ordning,
  korrekt alt/dekorativ-semantik, touchmål minst 44 px och ingen overflow.
- Oberoende kontroll: första granskningen gav 16 synpunkter, varav 11 rättades
  och 5 avvisades med kontraktsstöd. Slutlig CodeRabbit-omgranskning:
  81 lästa filer, 0 fynd.
- Supabase-advisorn visar endast de fyra avsiktliga autentiserade
  lifecycle-RPC:erna för Goal 90. Behörighet, organisationsscope och audit är
  runtimeverifierade. [Advisorns förklaring](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Produktion `clylvowtowbtotrahuad` är orörd. Ingen commit, push eller deploy är
  gjord.

Samlade användarflöden körs en gång till i Goal 86 innan Goal 90 flyttas till
`2-Byggplan/klart/`.
