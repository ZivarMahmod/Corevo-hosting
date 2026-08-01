# Goal 90 — blogg, kurser och galleri

Status: **KODKLAR — teknisk och previewbaserad acceptans grön 2026-07-29**

## Mål

Lås `blogg`, `kurser` och `galleri` end-to-end med säker livscykel,
tenantintegritet och samma data i kundadmin, preview och storefront.

## Före start

- Zivar har uttryckligen aktiverat Goal 90 före Goal 86.
- Underlaget i
  `1-Planering/24-goal-90-innehallsmoduler/00-underlag-och-byggplan.md` är
  källkodsgranskat.
- Aktiv worktree, migrationsläge och previewdatabas är verifierade live.

## Leverans

1. Tenantunik bloggslug och atomisk befintlig publiceringslivscykel.
2. Stabil bloggpagination, korrekt metadata och sitemap.
3. Atomisk eventavbokning och platsfrigöring.
4. Riktig galleriadmin med atomisk reorder och kontextuell alt/dekorativ-status.
5. Databasvakt mot cross-tenant media och tyst radering av refererade assets.
6. Audit/outbox för statusövergångar. Betald eventavbokning failar stängt tills
   Goal 92 har levererat en verifierad partiell refundrail; hel orderrefund får
   aldrig användas som genväg.

## Klargrind

- SQL concurrency- och RLS-prov är gröna.
- Unit/integration/typecheck/lint/build är gröna.
- Browseracceptans täcker admin→preview→storefront, mobil/desktop och relevanta
  tomt/fel/module-state-lägen.
- Ingen mediereferens eller statusmutation kan läcka över tenantgräns.
- Betald eventavbokning kan inte lämna status och pengar i konflikt.
- Oberoende verifierare har granskat beviset.

Goal flyttas först därefter till rätt mapp under `2-Byggplan/klart/`.

## Verifierat utfall

- Blogg, event och galleri/media använder nu låsta DB-kontrakt för tenantgräns,
  livscykel, historik, audit och atomiska mutationer.
- Previewdatabasen `localhost-acceptance` har Goal 90:s sju migrationer.
  Produktion är orörd.
- Tre rollback-baserade SQL-sviter är gröna och lämnar noll fixture-rader.
- Ett verkligt tvåsessionsprov gav exakt en registrering för den sista platsen;
  det andra anropet nekades med `event_capacity_exceeded`.
- Hela kodbasen är grön: 383 testfiler och 2 944 tester, typkontroll, lint med
  0 fel samt produktionsbuild.
- Admin→preview→storefront är verifierat vid 390 px och 1440 px. Reorder,
  kontextuell alt-text, dekorativa bilder, touchmål och overflow är kontrollerade.
- Första oberoende granskningen gav 16 synpunkter. Elva godtogs och rättades;
  fem avvisades som kontraktsstridiga eller utanför Goal 90. En ny oberoende
  CodeRabbit-granskning läste 81 filer och gav 0 fynd.

Goal 90 ligger kvar i `goals/` tills den samlade användaracceptansen i Goal 86.
Nästa byggmål är Goal 91.
