# Sammanställning — Goal 68 + Claude- och Codex-underlag

**Datum:** 2026-07-14  
**Syfte:** en gemensam läsingång innan Goal 68 byggs. Denna fil sammanför `2-Byggplan/goals/goal-68-kundportal-pwa-kommunikation.md` med Codex design och implementationsplan utan att låta motstridiga beslut följa med in i kod.

## 1. Gemensam målbild

Claude och Codex är överens om produktens kärna:

- Kunden bokar utan konto.
- Bokningen sparas atomiskt innan någon kommunikation försöks.
- E-post är grundkanal.
- Kund-PWA och Web Push minskar framtida SMS-kostnad.
- SMS förbereds providerneutralt men riktig provider kopplas sist.
- Samma globala kundkonto ska senare kunna bära verifierade relationer till flera Corevo-företag.
- “Mina företag” är dold initialt och blir aldrig en marknadsplats eller katalog.
- Företagets data, lojalitet, anteckningar, bokningar och kommunikation förblir tenantisolerade.
- Alla kommunikationsförsök loggas beständigt, idempotent och med ärliga statusord.
- Företagsägaren får kommunikationsöversikt och framtida SMS-underlag per faktiskt debiterat segment.
- Providerfel får aldrig göra att en bokning försvinner eller ser misslyckad ut efter DB-commit.

## 2. Verifierad verklighet som vinner

| Fråga | Låst beslut efter sammanställning | Varför |
|---|---|---|
| Personalhost | `minbooking.corevo.se` förblir personalens host | Produktkanon och Zivars uttryckliga beslut. Goal 68:s användning av `minbokning.corevo.se` för slutkund är fel och får inte implementeras. |
| Slutkundshost | Separat `CUSTOMER_PORTAL_HOST`; namn väljs före hostaktivering | Domännamnet blockerar inte datamodell, portalroutes eller lokal utveckling. |
| Befintligt `/konto` | Behålls och återanvänds additivt | Det är redan en verklig kundportal med bokningar, historik, lojalitet, favoriter, order och branding. |
| Global identitet | Återanvänd `auth.uid()` + befintlig `customers` per tenant i första vågen | Samma auth-id kan redan ha en kundrad per tenant. `customer_accounts` införs bara om F1 bevisar ett separat globalt profiltillstånd som modellen inte kan bära säkert. |
| Företagskund | Befintlig `customers` utökas, ersätts inte | Den bär tenant, contact hash, mergekedja, bokningar och lojalitet. |
| Företagslänk | `customers.auth_user_id` är första vågens verifierade länk | Signerad aktivering får sätta länken konservativt. En separat länktabell kräver ett bevisat behov, inte bara ett generiskt promptnamn. |
| Kontaktmatchning | Befintlig DB-funktion `customer_contact_hash`; aldrig namn och aldrig TS-reimplementation | Bevarar tenant-salt och befintligt dedupkontrakt. |
| Feature flags | Återanvänd plattforms-/tenantkonfiguration; skapa inte ett fristående flaggsystem | Modul-/config-first är Corevos kanon. Exakt lagringsyta avgörs i F1-inventeringen. |
| Kommunikation | `communication_events` + `communication_attempts` + outbox/dispatcher | Ger atomisk enqueue, idempotens, retry, status och kostnadsbokföring. |
| Push | Separat subscription per konto/enhet | Ett fel på en telefon får inte slå ut andra enheter. |
| SMS | Interface/mock nu, riktig provider sist | Zivars beslut och minsta risk för bokningskärnan. |
| FreshCut-pris | Faktisk providerkostnad initialt; inköp och debiterat belopp sparas separat | Framtida påslag/kvot kan införas utan att historik räknas om. |

## 3. Korrigeringar som måste göras i Goal 68 före exekvering

Goal 68 är sedan 2026-07-15 en program-master och ska inte köras som ett enda `/goal`. Punkterna nedan är historiken bakom v3.0 och fortsatt verifieringsunderlag.

1. Alla slutkundsreferenser till `minbokning.corevo.se` ersätts med `CUSTOMER_PORTAL_HOST`. `minbooking.corevo.se` testas explicit som regressionsskydd för personal.
2. Hårdkodade migrationsnummer är inaktuella. Vid granskningen 2026-07-15 fanns även `0067_admin_customer_rows_rpc.sql`; nästa nummer ska alltid grep-verifieras vid faktisk byggstart.
3. F2:s krav att nya tabeller ska finnas i **prod** strider mot deploy-/migrationsfrysen. Under frysen är “klar” lokal/staging schema- och testverifiering. Prodapplicering är en separat Zivar-grind.
4. Goal 68 säger att PWA redan har service worker. F1 måste verifiera detta mekaniskt; repot har manifest-routes och ikoner, men service-workerimplementeringen får inte antas utan filbevis.
5. Goal 68:s formulering att ombokning ska gå genom `create_public_booking` behöver kartläggas mot verklig ombokningsimplementation. Ny bokning får inte kringgå RPC/DB-krockskydd, men befintlig säker ombokningsaction ska återanvändas om den har rätt transaktionskontrakt.
6. “E-post- och push-provider skickar på riktigt” ska först betyda lokal testprovider/staging. Riktig kundtrafik och secrets kräver separat godkännande.
7. En commit per liten punkt är inte ett produktkrav. Commitgränser bör följa självständigt verifierbara arbetsenheter för att undvika halvfärdiga migrations-/authkontrakt.
8. Goal 68:s låsning av `customer_accounts` är upphävd av Claude⇄Codex-granskningen. F1 avgör med schema-/RLS-bevis; lean default är befintlig auth-id + tenantkund.

## 4. Rekommenderad gemensam fasordning

Den tekniska fasordningen nedan förklarar innehållet. Den faktiska goal-loopen och testgrindarna styrs av `03-EXEKVERINGSROADMAP-goal-68.md`.

### Fas A — analys och baseline

- Goal 68 F1 + Codex U0.
- Bekräfta schema, migrationsläge, authkopplingar, `/konto`, routing, PWA-mönster, e-post, reminder cron, flags och RLS med fil/rad-bevis.
- Skapa ingen produktkod.
- Resultat: `goal-68-ANALYS.md` samt korrigerad goal/plan.

### Fas B — global kundidentitet och säkerhetsfundament

- Befintlig global auth-id + tenantbundna `customers`, signerade/återkallbara bokningslänkar, kommunikationspreferenser och RLS.
- Befintliga `customers`, `customer_contact_hash`, mergekedja och `loyalty_ledger` återanvänds.
- Negativa A↔B-tester är obligatoriska innan portal-UI.

### Fas C — kommunikationsledger och e-post

- `communication_events`, `communication_attempts`, atomisk outbox, dispatcher, lease, idempotens och retry.
- Befintlig e-posttransport/mallar/branding adapteras bakom providerinterface.
- Gammal direktsändning och ledger får aldrig skicka samma mejl dubbelt.

### Fas D — säker kontoaktivering och central portal

- Hanteringslänk→verifiering→globalt konto→rätt tenant/customer.
- Befintligt `/konto` extraheras/återanvänds; ingen parallell affärslogik.
- Central portal körs bakom host- och tenantflagga.
- “Mina företag” förblir av.

### Fas E — PWA och Web Push

- Kundmanifest, versionshanterad service worker, ärligt offlineläge och installation efter värdeögonblick.
- Explicit pushsamtycke efter användarklick.
- Flera enheter, permanent endpointfel per enhet och säkra notification-click routes.

### Fas F — policy och kommunikationsöversikt

- Central policy för transaktionell email/push och framtida SMS-fallback.
- Separat marknadsföringssamtycke.
- Adminräknare, sanningsenliga statusar, kostnadssnapshot och CSV-underlag.

### Fas G — säkerhet, last och drift

- Fullt flöde gästbokning→event→mejl→länk→konto→portal→push.
- Tenant/auth/token/subscription/export-negativtester.
- Dubbelklick, dubbla köleveranser, providerfel, gammal SW och Worker-requestmätning.
- Cloudflare Paid är go-live-grind för affärskritisk FreshCut-trafik.

### Fas H — riktig SMS-provider, sist

Fas H är en separat senare goal och ingår inte i Goal 68:s stängningskrav.

- Verifiera aktuell provider, pris, segmentregler, avsändare, webhookauth och GDPR innan kod.
- Minsta test till godkänt testnummer.
- Provider-ID/webhook/segment/kostnad stäms av mot leverantörens portal/faktura.
- Kill switch och tenantflagga krävs före FreshCut-aktivering.

## 5. En gemensam datamodell

```text
auth.users                              global inloggning
  ├─ push_subscriptions                 en rad per enhet
  └─ customers                          en befintlig kundrad per tenant
       ├─ tenant_id
       ├─ bookings
       ├─ loyalty_ledger
       └─ företagsspecifika preferenser

booking/domain event
  └─ communication_events              varför något ska skickas
       └─ communication_attempts        kanal/provider/status/kostnad
```

Tenantens admin får läsa attempts för sin tenant, men får inte lista auth-användarens övriga kundrelationer eller enhetsdata som inte behövs. Slutkunden får läsa egna `customers`-relationer, preferenser och subscriptions, aldrig interna kundanteckningar.

## 6. Gemensamma leveransgrindar

- Nya tabeller: RLS + explicita grants + index + positiva/negativa tester.
- `auth.uid()`/DB-relation är auktoritet; inte `user_metadata`.
- Bokning commitas före provideranrop.
- En event-/attempt-idempotensnyckel ger högst ett utskick trots retry/samtidighet.
- Ingen privat portaldata i offentlig cache eller känslig pushtext på låsskärm.
- Ingen “läst/sett/levererat”-status utan tekniskt bevis.
- Flaggor av ger dagens beteende.
- `minbooking.corevo.se` fortsätter fungera för personal.
- Ingen prodmigration, push, tagg eller deploy under frysen.
- SMS förblir mock/av tills separat Zivar-go.

## 7. Dokumenten i denna mapp

1. `00-SAMMANSTALLNING-goal-68-och-codex.md` — läs först; löser konflikter och anger gemensam riktning.
2. `01-CODEX-DESIGN-kundportal-kommunikation.md` — detaljerad produkt-/arkitekturdesign och bakgrund.
3. `02-CODEX-IMPLEMENTATIONSPLAN.md` — konkreta arbetsenheter, filer, tester och reviewgrindar.
4. `03-EXEKVERINGSROADMAP-goal-68.md` — del-goals, testfamiljer, bevisstruktur och stoppskyltar.
5. Goal 68 ligger i `2-Byggplan/goals/goal-68-kundportal-pwa-kommunikation.md` som program-master/index och aktiveras inte direkt.

## 8. Rekommenderad nästa handling

Verifiera och stäng Goal 67. Skapa därefter den separata del-goalen `goal-68-0-baseline-och-ktd.md` från U0 och program-mastern. Genomför endast baseline/KTD först; ingen produktkod eller migration skrivs innan dess oberoende review är grön.
