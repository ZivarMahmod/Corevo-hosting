# Corevo — arkitekturkanon

Uppdaterad 2026-08-04. Den här filen beskriver produktens nuvarande modell.
Historik och genomförandeplaner är inte arkitekturkanon.

## Produkt

Corevo är en generell multi-bransch-plattform: en kodbas, en datamodell och en
driftsatt motor. Frisör, florist, verkstad, ekonomi och andra branscher är
vertikaler i samma produkt, inte egna implementationer.

En tenant kombinerar:

- en vertical med terminologi och startvärden,
- valda moduler som är av eller live,
- ett tema,
- tenantens eget innehåll och media,
- modulernas verkliga verksamhetsdata.

Ny bransch betyder data och eventuellt en ny generell modulvariant. Den betyder
inte ett nytt repo, en parallell routefamilj eller ett nytt state-system.

## Kanoniska ägare

| Område | Ägare |
|---|---|
| Tenantidentitet och status | `tenants` |
| Bransch, terminologi och startvärden | `verticals` |
| Modulregister | `modules` |
| Modul per tenant | `tenant_modules` |
| Tema, copy, branding, kontakt och bokningsläge | `tenant_settings.settings` |
| Personal | `staff` och `staff_id` |
| Moduldata | respektive moduls tabeller och domänlogik |
| Publik/preview storefront-chrome | `StorefrontShell` |

Samma uppgift får inte ha en andra cache-, overlay-, fallback- eller
kompatibilitetsägare utan ett verkligt externt kontrakt. Historiska tabeller och
migrationer är inte automatiskt runtimeägare.

## Modullivscykel

Varje `tenant_modules`-rad har exakt ett av två lägen:

| Läge | Kundadmin | Publik yta | Nya åtgärder |
|---|---|---|---|
| `off` | dold | dold | nej |
| `live` | synlig | synlig | ja |

Endast en plattformsoperatör ändrar läget. Saknad rad behandlas som `off`.
Avstängning får inte radera verksamhetsdata, betalningsunderlag eller relationer
som andra rader fortfarande refererar till; den stänger bara modulens ytor och
nya åtgärder.

## Storefront och preview

1. Hosten löses till exakt en tenant.
2. Tenantens bundle laddas av den gemensamma tenant-dataägaren.
3. Tema, tenant-copy och vertical-copy löses fältvis.
4. Ett tema väljer ett renderträd; moduler gatas av `tenant_modules`.
5. `StorefrontShell` äger gemensam navigation, providers, booking-gate,
   commerce-gate och sidfot.

Publik yta lägger till publik realtime, strukturerad data och cookie consent.
Preview kräver operatörsbehörighet och lägger till preview-bryggan. Skillnaden är
en uttrycklig surface-gräns, inte två kopior av storefronten.

Tenantinnehåll har en runtimeväg genom `tenant_settings.settings.copy` och
`branding`. Tema-default fyller bara saknade värden. Ett tema äger formen;
modulen äger funktionen och verksamhetsdatan.

## Onboarding

Superadmin:

1. väljer vertical,
2. anger namn och slug,
3. väljer tema,
4. väljer vilka moduler som ska vara live,
5. anger ägaruppgifter,
6. skapar tenant, settings, moduler och ägarkoppling atomiskt.

Efter skapandet använder kundadmin och superadmin samma domänägare för data och
moduler. De kan ha olika auth och navigation, men får inte få parallella
affärsregler.

## Roller och säkerhetsgränser

- Superadmin arbetar cross-tenant genom uttryckliga plattformsgrindar.
- Tenantägare arbetar endast inom sin tenant.
- Personal arbetar genom `staff`-identiteten och tilldelade områden/platser.
- Slutkund får bara läsa eller mutera data genom publika, tenantbundna kontrakt.
- RLS och `private.tenant_id()` är databasens sista gräns; appfilter ersätter
  aldrig RLS för autentiserade mutationer.
- `corevo.se` är plattforms-/POS-yta och får inte lösas som tenantstorefront.

## Domäner

- Standard: `<slug>.boka.corevo.se`.
- Egen domän: verifierad tenantdomän via den etablerade domänägaren.
- Preview: separat operatörsyta, aldrig publik tenantidentitet.

Cloudflare, DNS, Access, tunnel och produktionsmigrationer ändras bara genom ett
uttryckligt releasebeslut.

## Ändringsregel

Ändra den befintliga ägaren och radera den ersatta vägen i samma cutover:
produktkod, imports, exports, tester, CSS, flaggor och gamla instruktioner.
Git bevarar kodhistorik. Endast publicerade URL:er, API-kontrakt, lagrad data,
säkerhet, audit och rättslig retention motiverar tidsbegränsad kompatibilitet.
