# Goal 90 — blogg, kurser och galleri

Datum: 2026-07-29
Status: genomfört byggunderlag — Goal 90 KODKLAR 2026-07-29

## Forskningsslutsats

Corevo har redan grundtabeller, loaders, adminactions, preview och publika
modulgrindar. Goal 90 ska därför låsa innehållslivscykel, eventkapacitet och
medieintegritet; det ska inte bygga ett generellt CMS eller en ny eventmotor.

### Referenser

- [Wagtail](https://github.com/wagtail/wagtail): revisioner, schemalagd
  publicering, separata publiceringsrättigheter och kontextuell bildtext.
- [pretix](https://github.com/pretix/pretix): kvoter, väntelista,
  tidsbegränsade erbjudanden och bevarad order-/avbokningshistorik.
- [Odoo website_blog](https://github.com/odoo/odoo/tree/19.0/addons/website_blog),
  [website_event](https://github.com/odoo/odoo/tree/19.0/addons/website_event)
  och [website_slides](https://github.com/odoo/odoo/tree/19.0/addons/website_slides):
  modulgränser och gemensam webbpublicering.

Graphify-jämförelsen mot `reference-odoo-modules` och
`reference-pretix-events` bekräftar att Corevo redan har motsvarande
domänankare: `blog_posts`, `tenant_events`, `event_registrations`,
`media_assets`, `gallery_items`, `tenant_modules` och gemensamma loaders.

## Belagda gap

### Blogg

- Slug är inte hårt tenantunik.
- Publiceringsaudit och atomisk statusövergång saknas.
- Listning har limit men inte stabil cursor/sidindelning.
- Metadata, JSON-LD och sitemap är ofullständiga.
- Publicerat innehåll kan hårdraderas.

### Kurser/events

- Befintlig onsite-registrering och checkout-reservation är atomiska.
- Onsite-retry saknar idempotensnyckel.
- Avbokning, inställning och platsfrigöring saknar ett sammanhållet atomiskt
  kommando med orsak, aktör och notifieringsoutbox.
- En senare DB-trigger stoppar flera farliga raderingar, men avbokad historik
  kan fortfarande försvinna.
- Betalda event saknar en säker partiell refundrail. Befintlig refundkö gäller
  bokningar; webshop-refund återbetalar hela ordern och är därför inte säker
  för en eventrad i en blandad order.

### Galleri/media

- Galleri saknar en full kundadminyta.
- Reorder är inte atomisk och lika `sort_order` kan ge instabil ordning.
- Global alt-text räcker inte när samma fil används i olika sammanhang.
- Cross-tenant mediereferenser och radering av använda assets behöver hård
  databasvakt.

## Arkitekturbeslut

### Blogg

- Behåll `blog_posts` och den befintliga `draft/published/archived`-modellen.
- Lås tenantunik slug, atomiska statusövergångar, audit, stabil pagination och
  ärlig metadata för den befintliga publiceringsytan.
- Revisioner och schemalagd publicering är forskningsrekommendationer men
  kräver ett separat produktbeslut; de ingår inte i Goal 90.

### Kurser/events

- Behåll `tenant_events` som ett konkret tillfälle; ingen RRULE/seriemotor.
- Avbokning låser event och registrering och frigör plats exakt en gång.
- Onsite-retry använder en stabil idempotensnyckel.
- Betald avbokning får inte ändra status eller återbetala hela ordern innan en
  verifierad partiell eventrefund finns. Fram till dess ska kommandot faila
  stängt med ett tydligt resultat.
- Väntelista och tidsbegränsade erbjudanden är ett separat produktval och ingår
  inte utan uttryckligt beslut.

### Galleri

- `media_assets` äger filen; `gallery_items` äger caption, order, publicering,
  `alt_override` och `decorative`.
- Reorder sker i en DB-funktion som validerar exakt samma tenant och komplett
  ID-mängd.
- Refererad media får inte tyst raderas.

## Genomförandeplan

### Del 1 — databaskontrakt

Berör:

- ny append-only migration under `5-Kod/supabase/migrations/`;
- SQL-tester under `5-Kod/supabase/tests/`;
- genererade datatyper om projektets normala flöde kräver dem.

Leverera constraints, RLS, tenantmatchande referenser, säkra bloggstatusar,
eventavbokning och atomisk galleriorder. Alla publika
funktioner får explicita grants; känsliga funktioner återkallar `PUBLIC`.

### Del 2 — serverdomän

Återanvänd och utöka:

- `apps/web/lib/admin/blogg/actions.ts`
- `apps/web/lib/admin/events/actions.ts`
- `apps/web/lib/admin/media/actions.ts`
- `apps/web/lib/platform/actions/galleri.ts`
- `apps/web/lib/storefront/blogg/`
- `apps/web/lib/storefront/kurser/`

Serveractions ska vara tunna: auth/modulegate, validering, ett auktoritativt
DB-kommando, auditresultat och revalidate. Ingen separat app-FSM får vara den
enda säkerheten. Betald eventavbokning ska vara fail-closed tills Goal 92 har
levererat och verifierat en partiell commerce-refundrail.

### Del 3 — kundadmin och storefront

Utöka befintliga `BloggAdmin`, eventadmin och galleriadmin. Preview och publik
storefront ska fortsätta dela loaders/sections. Lägg stabil pagination,
tomt/fel/paused samt riktig gallerireorder. Scheduler och väntelista ingår
inte.

### Del 4 — metadata och acceptans

Lägg korrekt canonical/metabeskrivning och sitemap för redan publika ytor.
JSON-LD utökas bara där befintlig produktdata räcker utan ny modell. Lägg
riktade runtimeprov och browseracceptans enligt testlistan.

## Exakta implementation units

| Enhet | Befintlig fil | Nytt bevis |
|---|---|---|
| bloggstatus/listning | `apps/web/lib/admin/blogg/actions.ts`, `apps/web/lib/storefront/blogg/load-blogg.ts` | `apps/web/lib/storefront/blogg/load-blogg.test.ts` |
| eventavbokning | `apps/web/lib/admin/events/actions.ts`, befintliga eventmigrationer | `supabase/tests/goal90_event_cancel_concurrency.sql` |
| galleriorder/mediaref | `apps/web/lib/platform/actions/galleri.ts`, `apps/web/lib/admin/media/actions.ts` | `supabase/tests/goal90_gallery_media_rls.sql` |
| kundadmin | `apps/web/components/admin/BloggAdmin.tsx` och befintliga event-/gallerikomponenter | riktade Vitest-tester bredvid komponenterna |
| end-to-end | befintliga preview/storefront-routes | `e2e/acceptans/goal90-innehallsmoduler.accept.spec.ts` |

Verifiering från `5-Kod`: projektets SQL-testkommando, `pnpm test`,
`pnpm typecheck`, `pnpm lint`, `pnpm build` och det nya acceptansprobet.

## Medvetet utanför Goal 90

- full modereringsworkflow och ny redaktörsroll;
- bloggrevisioner och scheduler;
- väntelista och platserbjudanden;
- eventserier, seating och check-in;
- generell content builder;
- nya cross-module-länktabeller;
- serververkställd mediakvot, som ägs av Goal 92;
- mekanisk acceptans av alla tolv mallar, som ägs av Goal 93.

## Bedömda förbättringar

| Förbättring | Grafstöd | Aktivera när |
|---|---|---|
| bloggrevisioner + scheduler | Wagtail visar immutable revision → publish/schedule samt audit | kunden behöver förhandsgranskad eller tidsstyrd publicering |
| väntelista + tidsbegränsat erbjudande | pretix kopplar kö, kvot och expiry till samma event/orderlivscykel | verksamheter faktiskt efterfrågar kö och notifieringskanalen är durabel |
| blogg→event/galleri-länkar | Odoo visar site-scope och publicerade mål; Corevo kan göra smala tenant-FK | en godkänd storefrontdesign visar sådana relationer |
| publiceringsroller | Wagtail separerar edit/publish | Corevo inför en verklig redaktörsroll |

Förslagen är bra fits men är inte kärnkrav i Goal 90 utan dessa triggers.
