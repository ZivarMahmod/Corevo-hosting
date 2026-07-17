# Corevo kundportal, PWA och kommunikation — produkt- och arkitekturdesign

**Status:** Codex-underlag, sammanfogat med Goal 68 via `00-SAMMANSTALLNING-goal-68-och-codex.md`  
**Datum:** 2026-07-14  
**Kanon överordnad denna fil:** `1-Planering/01-arkitektur/multibransch-plattform-arkitektur.md`  
**Ursprung:** Zivars GPT-diskussion om kundkonto, PWA, push, e-post, SMS-kostnad och framtida app, verifierad mot befintlig Corevo-kod 2026-07-14.

## 1. Beslut i korthet

Corevo ska ha ett centralt slutkundskonto som på sikt kan samla kundens verifierade relationer till flera Corevo-företag. Det är inte en marknadsplats: kunden ser endast företag där en verklig, verifierad kundrelation finns.

- `booking.corevo.se` förblir företagets ägar-/adminyta.
- `minbooking.corevo.se` förblir personalens yta enligt plattformskanonen.
- Slutkundsportalens framtida fasta host får ett separat logiskt namn. Namnet är en bagatell och blockerar inte arkitekturen.
- Företagets storefront och `/konto` fortsätter fungera. En central portal införs additivt, inte genom att riva fungerande kundkonto.
- Kunden får alltid boka utan konto.
- E-post är grundkanal.
- PWA/Web Push är den kostnadsbesparande kanalen.
- SMS ansluts sist som valbar reserv-/säkerhetskanal och faktisk kostnad bokförs per debiterat segment.
- FreshCut debiteras initialt faktisk leverantörskostnad. Datamodellen kan senare bära konfigurerbart påslag utan att historik räknas om.
- Bokningen är kärndata; kommunikation är sidoeffekter. Kommunikationsfel får aldrig rulla tillbaka eller dölja en skapad bokning.
- `customer_multi_business_hub` byggs i datalagret men är av initialt.

## 2. Produktens ytor

### 2.1 Företagets storefront

Företagets egen domän eller `<slug>.corevo.se` visar presentation, tjänster, priser och offentlig bokning. Konto är aldrig ett krav före bokning.

### 2.2 Företagets arbetsyta

`booking.corevo.se` används av ägare, administratör och kalenderpersonal. Kommunikationspolicy, leveransstatus och kostnadsöversikt hör hemma här. Personal får kalenderbefogenheter men inte ändra system-, personal- eller kommunikationsinställningar.

### 2.3 Personalytan

`minbooking.corevo.se` behåller sitt befintliga syfte. Kundportalprojektet får inte återanvända eller bryta den hosten.

### 2.4 Slutkundens konto

Slutkundsportalen visar nästa bokning först, därefter snabba åtgärder, lojalitet, historik, beställningar och moduldata. Den centrala portalen använder ett neutralt Corevo-appskal och tenant-branding inuti varje företagsvy.

Den första releasen visar bara det företag som öppnade portalen. Flerföretagsväljaren förblir dold även om datamodellen stöder flera relationer.

## 3. Verifierat nuläge i repot

| Område | Finns idag | Konsekvens |
|---|---|---|
| Kundkonto | `app/(kund)/konto/*` med bokningar, historik, lojalitet, favoriter, beställningar och profil | Återanvänd och dela upp; skapa inte en parallell portal från noll. |
| Kundidentitet | `auth.users` är global och samma `auth.uid()` kan redan länkas till en `customers`-rad per tenant | Återanvänd detta i första vågen. Inför inte `customer_accounts` utan ett konkret behov som F1 kan bevisa. |
| Bokningskoppling | `bookings.customer_id` och `resolve_booking_customer` | Återanvänd och hårdna konservativ matchning. |
| RLS | Kund kan läsa egen tenant-rad; admin använder `private.tenant_id()` | Central flerföretagsläsning kräver särskilda snäva RPC:er/policies som utgår från `auth.uid()`, inte en aktiv tenant-cookie. |
| E-post | `lib/notifications/*`, bokningsmallar, cron-påminnelser, tenant-branding | Behåll provider och mallar; lägg beständig event-/attempt-logg runt utskick. |
| Signerad länk | HMAC-baserad avboknings-/hanteringslänk | Återanvänd, men verifiera scope, livslängd och återkallelse. |
| SMS | `lib/notifications/sms.ts` stub + `sms_enabled` | Flytta bakom provider-interface och håll avstängt tills leverantör och ekonomi verifierats. |
| PWA | Manifest för admin och personal | Kundmanifest, service worker, installationsflöde och Web Push saknas. |
| Realtime/cron | Påminnelse-route och `bookings.reminded_at` | Behåll schemaläggning initialt; ersätt enkel latch med idempotenta kommunikationsjobb stegvis. |
| Kommunikationsbokföring | Endast loggar | Nya beständiga event, attempts, status, kostnad och idempotensnycklar krävs. |

## 4. Identitetsmodell

### 4.1 Låst modell

`auth.users` är global inloggning. Corevos `public.users` är appens roll-/tenantprofil och `public.customers` är företagsspecifik kundrelation. Samma `auth.uid()` kan redan vara länkat till högst en kundrad per tenant och därmed bära flera företag. Första vågen använder detta direkt via snäva portal-RPC:er/RLS. En separat `customer_accounts`-nivå införs endast om F1 bevisar ett självständigt globalt profiltillstånd som inte säkert kan knytas till `auth.uid()`.

```text
auth.users
  ├─ customer hos FreshCut (tenant A)
  │    ├─ bokningar
  │    ├─ lojalitet
  │    └─ företagsspecifika preferenser
  └─ customer hos florist (tenant B)
       ├─ bokningar
       └─ lojalitet
```

FreshCut får aldrig se att samma person använder tenant B. Centrala portalen får endast läsa `customers`-relationer vars `auth_user_id = auth.uid()`.

### 4.2 Kontoaktivering

1. Gäst bokar utan konto.
2. `create_public_booking` skapar bokning och företagsspecifik kundrad atomiskt.
3. Ett beständigt `appointment.created`-event skapas efter att bokningen är säker.
4. E-post skickas med tenant-brandad, signerad hanteringslänk.
5. Länken visar just den bokningen utan att ge generell kontoåtkomst.
6. Kunden kan logga in eller skapa konto.
7. Verifierad e-post/telefon samt länktoken används för att länka rätt `customers`-rad till `auth.uid()`.
8. Vid tvetydighet sker ingen automatisk merge. Separata rader behålls för manuell eller starkare verifiering.

Namn ensamt får aldrig användas som identitetsbevis. Delad familjemejl eller telefon får inte orsaka tyst sammanslagning.

### 4.3 Central portal utan dataläckage

Portalen ska inte byta global `private.tenant_id()` för att lista relationer. Den använder snäva kund-RPC:er eller security-invoker-vyer som alltid härleder `auth.uid()` och endast returnerar whitelistas kundfält. Interna anteckningar och annan tenants existens exponeras aldrig till företag.

Supabase `user_metadata` får inte fatta behörighetsbeslut eftersom användaren kan ändra den. Auktorisering härleds från databasen och `auth.uid()`.

## 5. Portal- och domänstrategi

### 5.1 Additiv övergång

Fas 1 behåller tenantens `/konto` som fungerande yta. Portalens logik extraheras till tenant-oberoende läsfunktioner och komponenter innan en ny host aktiveras. Därmed kan den nya portalen testas bakom feature flagga utan att befintlig storefront eller personalhost påverkas.

### 5.2 Hostnamn

Det slutliga subdomännamnet väljs före host-aktivering. Kandidater är exempelvis `mina.corevo.se` eller `konto.corevo.se`. Planen använder termen `CUSTOMER_PORTAL_HOST` och hårdkodar inget ännu.

### 5.3 Branding

PWA-skalets identitet är neutral och hållbar för flera företag. Inne i företagsvyn används befintlig tenant-branding: namn, logotyp, accentfärg, kontaktuppgifter och branschens terminologi. Ingen separat PWA eller kodfork per tenant skapas.

## 6. Kommunikationsdomänen

### 6.1 Händelser

Minsta första uppsättning:

- `appointment.created`
- `appointment.rescheduled`
- `appointment.cancelled_by_customer`
- `appointment.cancelled_by_business`
- `appointment.reminder_due`
- `customer.account_linked`
- `loyalty.points_added`

Varje händelse har unik idempotensnyckel, tenant, eventtyp, resursreferens, tid och ett minimalt payload-snapshot. Fullständig PII kopieras inte i onödan.

### 6.2 Policy

Policy-resolvern kombinerar:

- händelsetyp och allvarlighet,
- tenantens aktiverade kanaler,
- kundens företagsspecifika preferenser,
- verifierad e-post/telefon,
- aktiva pushprenumerationer,
- samtycke för marknadsföring,
- kostnads- och fallbackregel.

Första driftpolicy:

| Händelse | E-post | Push | SMS |
|---|---|---|---|
| Bekräftelse | Alltid när adress finns | Om aktiv | Av |
| Påminnelse | Enligt tenantpolicy, initialt på | Om aktiv | Av |
| Kritisk nära ändring | Alltid när adress finns | Om aktiv | Av + manuell uppföljningssignal om ingen fungerande kanal |
| Marknadsföring | Endast separat samtycke | Endast separat samtycke | Av |

Efter SMS-lansering kan påminnelse använda push först och SMS som kostnadsbärande fallback. Kritiska ändringar kan använda alla tillåtna kanaler.

### 6.3 Beständig logg

`communication_events` beskriver varför kommunikation behövs. `communication_attempts` beskriver varje kanal-/providerförsök. Statusar normaliseras till:

`created → scheduled → queued → processing → provider_accepted → succeeded|failed|expired|cancelled`

`clicked` är separat observerad interaktion. `read`, `seen`, `displayed` eller `delivered` används bara när leverantören faktiskt bevisar statusen.

### 6.4 Idempotens och retries

- Unik nyckel per `(event, channel, recipient/device, template_version)` förhindrar dubbla utskick.
- Retry sker endast för klassificerade temporära fel och med begränsad backoff.
- Permanenta pushfel inaktiverar bara den berörda enheten.
- Ett köjobb kan behandlas flera gånger utan dubbla meddelanden.
- Kommunikationsfelet förändrar aldrig bokningens status.

## 7. E-post

Befintlig SMTP/provider och mallar återanvänds. Alla bokningsmejl ska vara tenant-brandade och innehålla korrekt datum, tid, tjänst, personal/plats när tillgängligt, kalenderlänk och säker hanteringslänk.

E-post är billig i jämförelse med SMS men inte “gratis” eller garanterad. Providerresultat, bounce när tillgängligt och fel loggas ärligt. Driftbeviset boka→provideracceptans samt SPF/DKIM-verifiering är en launch-grind.

## 8. PWA och Web Push

### 8.1 PWA

Kundportalen får eget manifest, neutrala ikoner, `standalone`, start-URL, versionshanterad service worker, offline-appskal och tydlig nätverksstatus. Privat bokningsdata cacheas inte publikt. Eventuell senast läst data märks “senast uppdaterad” och kan aldrig användas för att påstå att en offline-ombokning lyckats.

### 8.2 Installation

Installation erbjuds först efter ett värdeögonblick: genomförd bokning, skapat konto eller besök i kundportalen. Ingen aggressiv prompt vid sidladdning. iPhone, Android, desktop och unsupported får separata instruktioner.

### 8.3 Push

Webbläsarens behörighetsdialog öppnas endast efter ett uttryckligt användarklick och efter en förklarande Corevo-dialog. Ett konto kan ha flera enheter; varje subscription är en egen rad.

Notiser får inte visa känsliga uppgifter på låsskärmen. Standardtext kan visa företagsnamn och att en bokning kräver uppmärksamhet; mer detaljer visas efter autentiserad öppning.

Push är inte garanterad leverans. Systemet visar “accepterad av push-tjänsten”, “öppnad” eller “misslyckad” efter vad som faktiskt kan bevisas — aldrig “kunden såg den”.

## 9. SMS och ekonomi

### 9.1 Leveransordning

SMS-interface och datamodell byggs tillsammans med kommunikationsmotorn. Riktig provider aktiveras först när e-post, PWA/push, loggning och kostnadsbokföring är verifierade.

### 9.2 Provider

46elks är nuvarande dokumenterade kandidat i repot, inte ett oåterkalleligt val. Provideradapter ska normalisera mottagare till E.164, använda korta mallar, hantera webhooksignatur/status och spara provider-ID. Hemligheter får endast finnas server-side.

### 9.3 Kostnad

Ett användarvisat “meddelande” kan debiteras som flera SMS-segment. Varje attempt sparar:

- provider och provider-ID,
- segmentantal,
- providerpris och valuta vid sändning,
- faktisk inköpskostnad,
- debiteringsmodell och debiterat belopp,
- leveransstatus och webhooktid.

Historiska rader är immutabla ekonomiska snapshots. FreshCuts debiterade belopp är initialt samma som faktisk kostnad. Framtida tenant kan ha påslag eller inkluderad kvot utan att gamla rader räknas om.

### 9.4 Kommunikationsöversikt

Ägare ser per period:

- e-post skickade/lyckade/misslyckade,
- push attempts, aktiva subscriptions, utgångna endpoints och öppningar,
- SMS-meddelanden och debiterade segment,
- faktisk kostnad, debiterat belopp och valuta,
- fallbackfrekvens och kritiska fel,
- pushandel och en tydligt definierad uppskattad SMS-besparing,
- exportbart CSV-underlag.

Besparing måste märkas som beräkning och använda en dokumenterad baseline, inte presenteras som bokförd verklighet.

## 10. Asynkron behandling

Första säkra steget är en Postgres-baserad outbox i samma transaktionsgräns som bokningshändelsen. Den befintliga cron-routen kan dränera jobb i begränsade batcher och använda lease/lock, retrytid och dead-letter-status. Detta undviker att införa Cloudflare Queues innan behovet är verifierat och ger atomisk bokning→event.

När volym eller latency motiverar det kan dispatch flyttas till Cloudflare Queues utan att domänmodellen ändras. Supabase Cron kan schemalägga jobb, men cronhistorik och providerlogg ersätter inte Corevos egen kommunikationsbokföring.

## 11. Cloudflare

Cloudflare Workers Free har 100 000 dynamiska Worker-requests per dygn och återställs vid midnatt UTC enligt aktuell dokumentation. Affärskritisk pilot ska inte förlita sig på ett hårt gratistak.

- Statiska assets och PWA-skal hålls statiska där möjligt.
- Portalens första vy får en aggregerad serverläsning i stället för ett API-anrop per kort.
- Privat data cacheas aldrig publikt.
- Worker-anrop och svarstid mäts per route.
- Rate limiting sätts på auth, signerade länkar och mutationer.
- Workers Paid är en go-live-grind innan FreshCut blir beroende av systemet som primär bokningskanal.

## 12. Feature flags

- `customer_central_portal_enabled`
- `customer_pwa_enabled`
- `customer_web_push_enabled`
- `customer_multi_business_hub`
- `communication_ledger_enabled`
- `communication_cost_dashboard_enabled`
- `sms_enabled` (befintlig; förblir false tills SMS-grinden är uppfylld)

Flaggor har plattformsdefault och kan där det behövs överstyras per tenant. Ett avstängt system ska ge dagens beteende, inte en halv ny upplevelse.

## 13. Säkerhets- och integritetskrav

- RLS på alla exponerade tabeller; `TO authenticated` kombineras alltid med ägarskapsvillkor.
- `UPDATE`-policies har både `USING` och `WITH CHECK`.
- Inga behörighetsbeslut från användarstyrd metadata.
- Ingen service-role/secret key i klient eller service worker.
- Signerade länkar är tidsbegränsade, scopesmå och kan återkallas.
- Push endpoints och nycklar behandlas som person-/enhetsdata och raderas vid återkallelse/GDPR-flöde.
- Marknadsföringssamtycke är separat från transaktionell bokningskommunikation.
- Interna kundanteckningar, andra tenants och providerhemligheter får aldrig exponeras i portal-RPC:er.
- Audit-logg för kontolänkning, ombokning, avbokning och ändrade kommunikationspreferenser.

## 14. Scope och uttryckliga icke-mål

Första genomförandet bygger inte:

- en BokaDirekt-liknande katalog eller marknadsplats,
- en native iOS-/Android-app,
- separat PWA per företag,
- full integration med Zettle, PayPal eller kassasystem,
- marknadsföringsautomation,
- automatisk sammanslagning av tvetydiga kundposter,
- riktig SMS-sändning innan den sista fasens go/no-go.

## 15. Mätbar Definition of Done

Designen är realiserad när implementationsplanens samtliga leveransgrindar är gröna och följande kan demonstreras lokalt/staging:

1. Gästbokning fungerar utan konto och överlever kommunikationsfel.
2. E-post skapas via beständigt event/attempt och innehåller korrekt säker länk.
3. Kunden kan länka verifierat konto till rätt kundrelation utan cross-tenant-läckage.
4. Portalens tenantläge återger dagens bokningar, historik, lojalitet och branding.
5. Datamodellen kan returnera flera egna relationer men UI visar ingen väljare när flaggan är av.
6. Kund-PWA installeras på stödda enheter och visar ärligt offlineläge.
7. Push kan aktiveras efter användarklick, fungerar per enhet och hanterar permanent endpointfel.
8. Kommunikation är idempotent under retry och samtidighet.
9. Ägaren ser sanningsenlig kanalstatus och exportunderlag.
10. SMS-adaptern kan anslutas utan ändring i bokningsdomänen; riktig SMS-trafik förblir av tills separat acceptansgrind passeras.

## 16. Aktuella externa teknikfakta

- Supabase Auth + RLS använder `auth.uid()` för radägarskap; användarstyrd metadata får inte vara auktoritetskälla.
- Supabase Cron bygger på `pg_cron`; jobbhistorik finns men Corevo behöver egen domänlogg.
- Cloudflare Workers Free har 100 000 requests/dygn; Paid saknar denna dagliga requestgräns.
- Web Push kräver service worker, användarens uttryckliga behörighet och har ingen generell lästgaranti.

Kontrollera alltid aktuell leverantörsdokumentation igen vid implementation eftersom priser, gränser och API-kontrakt kan ändras.
