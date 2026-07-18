# Arbets- och driftslogg — 18 juli 2026

Senast uppdaterad: 2026-07-18 11:45 CEST.

Den här loggen sammanfattar arbetet med första kundens relationspaket,
databasavstämningen, releasehärdningen och produktionsdriftsättningen. Den beskriver
vad som faktiskt byggdes och verifierades, inte framtida roadmaparbete.

## Levererat resultat

- Första kundens relationspaket är implementerat på `main`.
- Produktionsdatabasen är migrerad och verifierad genom migration `0109`.
- Koden är pushad till GitHub och produktions-Workern är publicerad på Cloudflare.
- `https://booking.corevo.se/login` svarade `200 OK` efter publiceringen och
  innehöll den förväntade inloggningsvyn.
- Skarp SMS-leverans är fortfarande avstängd med `SMS_DELIVERY_MODE=off`.
- Betalning vid bokning har inte aktiverats.
- Kundportalpaket 05 byggdes eller ändrades inte i den här arbetsrundan.
- Claudes otrackade arbete under `Mobil pwa/` rördes eller pushades inte.

## Funktionalitet som byggdes och härdades

### Bokningar och sann status

- Publik bokningsintegritet och tenant-/platsgränser härdades.
- Atomisk walk-in/adminbokning infördes för att undvika halvskrivna bokningar.
- Bokningsutfall fick en gemensam databassanning för bland annat bokad, genomförd,
  avbokad och utebliven.
- Admin-, personal- och kundvyer kopplades till samma statuslogik så att gränssnittet
  inte lovar en effekt som databasen inte genomför.
- Bokningsbekräftelser och kundvyer visar ett ärligt utfall och säkra fallbacklägen.
- Utgångna reservationer kopplades till rensningsflödet.
- Handels- och betalningsytor gjordes fail-closed där funktioner inte är aktiverade.

### Kundrelation och konto

- Ett säkert gäst-till-kundkonto-flöde byggdes med claim-token och tenantgräns.
- Kundens bokningar kan kopplas till rätt autentiserat konto utan att öppna åtkomst
  till andra tenants.
- Kund-, personal- och ägarrelationer fick explicita behörighetskontroller.
- Kundhistorik, anteckningar och bokningsinformation gjordes tillgängliga inom rätt
  roll- och tenantgräns.
- GDPR-radering byggdes som ett atomiskt tenantbundet flöde.
- Personalinbjudningar fick kompensation/städning om auth- eller databasskrivningen
  misslyckas.
- Vald roll sparas före inbjudan och används när kontot senare kopplas.

### Notifieringar och förberett SMS-flöde

- En durable notifierings-outbox infördes så att notifieringar kan köas,
  återförsökas och följas upp utan falska leveransbesked.
- Bokningshändelser och notifieringsrouting centraliserades.
- Cron-endpoint för notifieringskön och scheduler heartbeat lades till.
- Bokningsbekräftelser, påminnelser och relevanta kontolänkar kopplades till den nya
  notifieringskedjan.
- 46elks delivery-webhook byggdes och testades för framtida leveransstatus.
- SMS-sändning skyddas av flera grindar. Provideranrop sker inte när
  `SMS_DELIVERY_MODE=off`, vilket fortfarande gäller i produktion.
- Ingen betald test-SMS skickades under arbetet.

### Admin, personal och mobil

- Personalpanelen härdades så att oförändrade formulär inte ger falska fel.
- Kalenderfärg, platsval, inaktivering och historisk personal hanteras tydligare.
- Personal med bokningshistorik kan inte tas bort permanent av misstag.
- Inställningar behåller de verkliga Personal- och Schema-implementationerna i det
  nya skalet; deras framtida individuella nydesign har inte låtsats vara genomförd.
- Mobil-/iPadkalendern har separat touch-handtag för att flytta bokningar med finger,
  visar måltid/resurs och kräver bekräftelse före skrivning.

## Databas och migrationer

- Relationspaketets migrationer `0092`–`0107` infördes med tillhörande SQL-/RLS-test.
- `0108_explicit_data_api_grants.sql` infördes för explicita Data API-rättigheter:
  - `service_role` har nödvändiga fulla serverrättigheter;
  - `anon` har endast avsedd publik läsning;
  - `authenticated` följer RLS-/RPC-arkitekturen;
  - breda framtida standardrättigheter återkallades.
- `0109_user_location_access_data_api_grants.sql` kompletterade rättigheterna för
  platsbunden användaråtkomst. `UPDATE` lämnades avsiktligt utan direkt rättighet.
- Produktionens migrationshistorik stämdes av genom `0109`.
- `supabase db push --linked --dry-run` rapporterade att produktionen var uppdaterad.
- Produktionscheckpointen sparades med plattformsoberoende SHA-256-fingeravtryck.
- En tillfällig datalös Supabase-previewgren användes för migrationskontroll och
  raderades därefter. Ingen ny permanent databas skapades; produktionens `main` är
  fortsatt den kanoniska databasen.

## CI- och releasearbete

- Fresh-database-seeden ordnades så att personaldata skapas efter nödvändiga
  readiness-beroenden.
- Procedur- och RLS-tester körs med `psql` och `ON_ERROR_STOP=1`, eftersom aktuell
  Supabase CLI behandlar `supabase test db` som pgTAP och annars underkänner vanliga
  procedurtester trots passerade assertioner.
- Deployens migrationsgrind korrigerades så att en databas som ligger före koden
  inte blockeras felaktigt.
- Same-SHA-releasegrinden korrigerades så att jobbet utan checkout inte ärver en
  obefintlig `5-Kod`-arbetskatalog.
- Migrationsfingeravtrycket normaliserar CRLF/LF och blir därför identiskt på Windows
  och Linux.
- E2E-grinden accepterar ett avsiktligt hopp när isolerad staging inte är aktiverad,
  men kräver godkänt E2E-resultat när `E2E_ENABLED=true`.
- Node-version och produktionsanpassade build-/releasekontroller harmoniserades.

## Oberoende granskning

- Claude CLI användes som oberoende granskare av Data API-rättigheterna och
  migrationstesterna.
- Granskningen hittade att positiva flerprivilegieassertioner kunde få OR-semantik.
  Testerna ändrades så att varje privilegium verifieras separat.
- Ett uttryckligt RLS-kontrakt lades till. Inga kvarvarande produktionsblockerande
  grantfel hittades efter rättningen.

## Verifiering

- Lokal lint: 0 fel, 7 sedan tidigare kända varningar.
- Typkontroll: godkänd.
- Apptester: 225 testfiler, 1913 av 1913 tester godkända.
- Produktionsnära SQL-/RLS-svit: 28 av 28 tester godkända.
- Fresh-database-migrationer i CI: godkända.
- App- och OpenNext-build på Linux: godkända.
- Exakt-SHA CI för `bd53d50038c9ca17b53c30ac2b4a1322d6187c24`:
  `https://github.com/ZivarMahmod/Corevo-hosting/actions/runs/29639241295`.
- Playwright mot staging hoppades över eftersom isolerad staging inte är konfigurerad;
  det redovisades som ett avsiktligt skip, inte som ett passerat E2E-test.

## Produktionsdriftsättning

- GitHub-deployen byggde produktionen men stoppades av den interna Worker-gränsen:
  den Linux-genererade bunten rapporterades cirka 8,8 KB över den satta 3 MiB-grinden.
- På uttrycklig begäran genomfördes därefter en direkt Linux/WSL-publicering med det
  sanktionerade `deploy-prod.mjs`-flödet.
- Den direkta bunten var 3067,03 KiB gzip och accepterades av Cloudflare.
- Worker: `bokningsplatformen`.
- Cloudflare Version ID: `e16157ad-f2bf-4051-8ae0-024727e1675c`.
- Publicerade routes:
  - `*.boka.corevo.se/*`
  - `booking.corevo.se`
  - `superbooking.corevo.se`
  - `minbooking.corevo.se`
  - `freshcut.corevo.se`
  - `florist.corevo.se`
  - `zentum.corevo.se`
  - `demo.corevo.se`
- Schemat `*/15 * * * *` publicerades tillsammans med Workern.
- Direktpubliceringen använde den incheckade domänfilen och dess fasta route-vakt.
  Cloudflares separata live-domän-API-kontroll kunde inte autentisera med den lokalt
  sparade OAuth-tokenen och kördes därför med den befintliga uttryckliga
  `ALLOW_NO_CF_TOKEN=1`-overriden. Wrangler autentiserade och Cloudflare accepterade
  samtliga ovanstående routes. Detta ska följas upp genom att ge deploytokenen rätt
  API-behörighet innan nästa direktdeploy.
- Efter publicering svarade `https://booking.corevo.se/login` med `200 OK` och
  förväntad inloggningstext.

## Commits i leveransen

- `a328bed` — migrationsgrinden tillåter att databasen ligger före koden.
- `c7377b2` — första kundens relationspaket.
- `c1b327f` — rätt seedordning för fresh-database CI.
- `adb3352` — roll sparas före personalinbjudan.
- `eb335d4` — rätt arbetskatalog för same-SHA deploygrind.
- `5c90756` — explicita Data API-rättigheter och migrationerna `0108`–`0109`.
- `bbc545b` — procedurtester körs tillförlitligt med `psql`.
- `bd53d50` — plattformsoberoende migrationsfingeravtryck.

## Medvetet kvar efter leveransen

- Skarp SMS-transport och första canary-SMS aktiveras endast efter ett separat beslut.
- Betalning vid bokning och större webshop-/kassaflöden aktiveras senare.
- Kundportalpaket 05 är fortfarande ett separat produktarbete.
- Isolerad staging och dess muterande Playwright-E2E behöver konfigureras.
- Worker-storleken behöver minskas eller den interna budgeten behöver få ett beslutat
  nytt tak före nästa normala GitHub-produktionsdeploy.
- Cloudflare-tokenen bör få rätt läsbehörighet för live-domänkontrollen så att direkt
  publicering inte behöver override.

