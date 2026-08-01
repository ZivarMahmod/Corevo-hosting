# Goal 90–93 — sambandsarkitektur

Datum: 2026-07-29
Status: beslutsunderlag före bygge
Kanon: `01-lokal-fardigstallandeplan.md`

## Beslut

Goal 90–93 ska komplettera Corevos befintliga gemensamma motor. De ska inte
införa separata CMS-, wallet-, commerce- eller pluginplattformar.

| Gemensam kärna | Ägare | Konsumenter |
|---|---|---|
| tenant, partner och RLS | plattform | alla moduler |
| `tenant_modules` och readiness | modulplattform | alla publika och skrivande flöden |
| `media_assets` och R2-livscykel | media | blogg, galleri, kurser, offert, webshop och mallslots |
| kundidentitet och privacy | kunddomän | kurser, offert, webshop och lojalitet |
| order, betalning, refund/outbox | commerce | webshop, presentkort, betald kurs och accepterad offert |
| append-only audit och idempotens | plattform/domän | alla värde- och statusövergångar |
| kodägd modul-/mallkatalog | plattform | onboarding, admin, preview, storefront och acceptans |

## Hård gräns

- Kodregistren äger körbara komponenter, capabilities och mallar.
- DB äger tenantstate, affärsdata och en validerad projektion av katalogen.
- Designpaketens manifest äger visuell acceptans.
- Ett modulflöde får bara skriva när modulstate, readiness, tenantgräns och
  eventuell commerce-release är godkända.
- Historiska pengar, poäng, presentkort och accepterade offerter ändras genom
  kompensationsposter, inte genom att historik skrivs om.

## Byggordning

1. Goal 90: befintliga innehålls- och eventflöden utan ny betalningsmotor.
2. Goal 92: media-, offert- och commerce-sanningsgränser.
3. Goal 91: värdeledger och säkra inlösenflöden ovanpå verifierad
   payment/refundrail.
4. Goal 93: katalogprojektion och mekanisk acceptans för hela ytan.

Goal 86 ligger fortfarande före Goal 90–93 enligt `ROADMAP.md`. Dokumenten
förbereder bygget men ändrar inte den beslutade exekveringsordningen.
Nummerordningen 90–93 är alltså inte en teknisk beroendeordning.

## Externa referensgrafer

Referenskod ligger utanför repot under Graphifys bibliotek. Ingen extern kod
kopieras in i Corevo.

| Graphify-projekt | Källcommit | Användning |
|---|---|---|
| `reference-odoo-modules` | `06a46b083fde5688d71c5602553316c9e7160b6a` | modulberoenden, innehåll, sale/payment och loyalty |
| `reference-saleor-commerce` | `e9b9dcdb5a84f77daf877138ff4b3c4d7ad2a334` | checkout, presentkort, transaktioner och refunds |
| `reference-pretix-events` | `16040f70bbe5945a369e4a5b586215fb18081c47` | kapacitet, väntelista, erbjudanden och eventlivscykel |
| `reference-wagtail-content` | `c10e634636dae4164c2793d89f1a950a5f64517b` | revisioner, publicering, site scope och audit |
| `reference-erpnext-business` | `6b8b9d3644dc829c184be414678c95494ff87aa3` | lojalitet, offert, order och retur |
| `reference-directus-media` | `982fb3f99953515750999de8a456b0c757bcf3ca` | media/storage, metadata och radering |
| `reference-medusa-commerce` | `dde167d0be4c23ed37aa7a3d71721728e31f3e96` | commerce-moduler, workflows och kompensation |
| `reference-backstage-catalog` | `68e995e4b8f5aa20e95d7787c82bdcf47553ad29` | katalogschema, relationer och validering |
| `reference-gutenberg-blocks` | `3182e27321feedc0f9f063e98e1c4d540979698f` | manifest, supports, deprecation och fixtures |
| `reference-fineract-commands` | `c06c98764fac514ce951383cc9cb3a90f747fcbd` | idempotenta kommandon, audit och events |

Wagtail och ERPNext är fulla källgrafer. Odoo, Directus, Medusa, Backstage,
Gutenberg och Fineract är domänkompletta urval som inkluderar berörd kärnkod,
beroenden och tester men lämnar irrelevanta produktområden utanför.

### Grafstorlek vid registrering

| Projekt | Noder | Kanter | Extraherade |
|---|---:|---:|---:|
| Odoo | 20 000 | 26 474 | 96 % |
| Saleor | 33 274 | 111 109 | 93 % |
| pretix | 24 869 | 61 760 | 78 % |
| Wagtail | 22 737 | 51 471 | 82 % |
| ERPNext | 24 975 | 52 902 | 96 % |
| Directus | 6 094 | 14 855 | 99 % |
| Medusa | 18 793 | 38 283 | 100 % |
| Backstage | 3 522 | 7 644 | 100 % |
| Gutenberg | 15 428 | 23 123 | 99 % |
| Fineract | 9 282 | 19 330 | 94 % |

Siffrorna är Graphifys registreringssnapshot och används för att upptäcka om en
framtida refresh blivit ofullständig. `INFERRED`-kanter behandlas som ledtrådar;
verkliga källfiler och tester är fortsatt slutlig källa.

## Hur förbättringar bedöms

Extern forskning får föreslå förbättringar. Varje förslag klassas som:

- **kärna** — krävs för goalens befintliga end-to-end-flöde eller
  säkerhetsgräns;
- **förbättring** — tydlig produktnytta men behöver uttryckligt beslut;
- **avvisad** — ramverkskomplexitet eller framtidsspekulation utan Corevo-behov.

En förbättring flyttas till goalens obligatoriska leverans först när dess
användarflöde, datakontrakt, beroenden och acceptans är beslutade. Grafen är
bevisunderlag, inte automatisk produktkanon.

## Tvärgående acceptans

- Samma tenantkontroll gäller i UI, serveraction och DB.
- Samma idempotency key med samma payload ger samma resultat; annan payload
  med samma nyckel avvisas.
- Publika och skrivande flöden är fail-closed vid okänd katalognyckel eller
  ofullständig readiness.
- Preview och storefront använder samma loaders och samma modulstate.
- Mobil, desktop, tomt, fel, `off`, `draft`, `live` och `paused` bevisas där
  tillståndet är relevant.
- Pengar och värde bevisas med samtidighets-, retry-, RLS- och refundfall i DB,
  inte enbart med komponenttester.
