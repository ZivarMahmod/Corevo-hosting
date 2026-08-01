# Goal 90 — implementationsplan

Datum: 2026-07-29
Status: genomförd — Goal 90 KODKLAR

## Globala villkor

- En del byggs och verifieras i taget.
- Testet ska visa RED före produktionsändringen och GREEN efter.
- Befintliga adminprimitives, loaders och storefrontvyer återanvänds.
- Publik malldesign ändras inte för att passa adminimplementationen.
- Databasen är auktoritativ för tenantintegritet, samtidighet och historik.
- Alla nya RPC:er får explicita `REVOKE`/`GRANT`.
- Betald eventavbokning får aldrig använda hel orderrefund som genväg.
- Goal 90 flyttas inte till `klart/` utan oberoende granskning och verifiering.

## Task 1 — bloggkontrakt

Bygg:

- tenantunik, skiftlägesokänslig och icke-tom slug;
- atomisk och idempotent statusövergång med bevarat första
  publiceringsdatum och audit;
- skydd mot hard delete av innehåll som har varit publicerat;
- tunna adminactions som använder DB-kommandot.

Bevis:

- SQL-kontrakt för slug, status, audit, retry och delete;
- riktade action- och admintester.

## Task 2 — blogglistning och SEO

Bygg:

- deterministisk sidindelning med `published_at DESC, id DESC`;
- validerat sidnummer och föregående/nästa;
- detaljmetadata med canonical, beskrivning och verklig omslagsbild;
- sitemap för endast publicerade inlägg i en live-modul;
- previewdetalj som stannar i previewkontexten.

Bevis:

- loader-, metadata-, sitemap- och previewtester;
- 390 px och 1440 px utan blockerad handling eller sidleds-overflow.

## Task 3 — eventlivscykel

Bygg:

- stabil idempotensnyckel för onsite-anmälan;
- atomisk event- och registreringsavbokning med orsak, aktör och tid;
- kapacitetskontroll när en avbokad registrering återställs;
- audit och notifieringsoutbox i samma transaktion;
- hårt historikskydd och tenantmatchande relationer;
- fail-closed resultat för betalda registreringar tills partiell refundrail är
  verifierad.

Bygg inte:

- väntelista, scheduler, eventserier eller hel orderrefund.

Bevis:

- SQL-prov för tenantgräns, idempotens, samtidighet, historik och outbox;
- action- och formulärtester för retry och tydliga fel.

## Task 4 — galleri- och mediakontrakt

Bygg:

- `alt_override` och explicit `decorative`;
- tenantmatchande media-FK och `RESTRICT` för alla använda assets;
- deterministisk, atomisk reorder med komplett ID-mängd;
- begripligt fel när refererad media inte kan raderas.

Bevis:

- SQL-prov för cross-tenant, radering, alt/dekorativ och reorder;
- loadertest för identisk ordning och tillgänglighetsdata.

## Task 5 — galleri i kundadmin

Bygg:

- `/admin/galleri`, adminarea och modulgrindad navigation;
- tenant-härledda actions; inget postat tenant-ID får vara auktoritet;
- befintliga portalprimitives och samma publika loader;
- flytta upp/ned-kontroller som fungerar med tangentbord och touch;
- read-only UI i `paused`.

Bevis:

- komponenttest för CRUD, reorder, module states och fel;
- mekaniskt admin→preview→storefront-prov vid 390 px och 1440 px;
- publik malldesign ska vara oförändrad.

## Task 6 — slutgrind

Kör från `5-Kod`:

- riktade SQL- och Vitest-prov;
- hela `pnpm test`;
- `pnpm typecheck`;
- `pnpm lint`;
- `pnpm build`;
- Goal 90:s browseracceptans mot previewmiljön.

En fristående agent granskar därefter säkerhet, dataintegritet,
tillgänglighet, designkanon och bevis. Fynd rättas och hela berörda
verifieringen körs om.

## Utfall 2026-07-29

Alla sex tasks är genomförda. Previewmigrationer, SQL-acceptans, verkligt
samtidighetsprov, 383 testfiler/2 944 tester, typkontroll, lint och build är
gröna. Browseracceptansen täcker admin→preview→storefront vid 390 px och
1440 px. Slutlig oberoende omgranskning gav 0 fynd över 81 filer.

Produktion är orörd. Samlad användaracceptans och flytt till `klart/` sker i
Goal 86. Goal 91 är nästa byggmål.
