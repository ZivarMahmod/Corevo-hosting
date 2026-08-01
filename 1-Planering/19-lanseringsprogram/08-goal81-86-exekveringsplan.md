# Goal 81–86 — exekveringsplan före nästa bygge

**Datum:** 2026-07-24
**Branch:** `codex/launch-inventory-customer-design`
**Databas:** Supabase-preview `localhost-acceptance`
**Releasescope:** Sverige först; ingen produktionsdeploy före Goal 86

## Syfte

Bygga alla återstående lokalt verifierbara lanseringsdelar före Zivars nästa
testsession. Varje goal låses separat, men Zivar behöver bara göra en gemensam
localhostacceptans när Goal 81–85 är klara.

## Gemensamma gränser

- Återanvänd nuvarande bokningsmotor, roller, `staff`/`staff_id`,
  `notifications_outbox`, tenantstatus och URL-builders.
- Ingen ny design av kundportal, Sida-studio, FreshCut eller kundarbetsyta.
- Ingen andra marknad, full översättning, ny betalprovider eller ny SMS-provider.
- Ingen produktion, riktig kunddata eller ny Cloudflare-route under Goal 81–85.
- Varje goal börjar med regressionsprov som faller på det verkliga gapet.
- Varje goal slutar med full websvit, typecheck, lint, build och relevant
  previewruntime innan nästa goal öppnas.

## Goal 81 — bokningsmotorns fulla variantmatris

### Problem som stängs

- platsbyte kan lämna wizard på fel steg efter en djuplänk;
- `tjanst`/`personal` och `service`/`staff` är två URL-dialekter;
- äldre slotsvar kan skriva över ett nyare val;
- datumfönstret ignorerar platsens tidszon och `max_advance_days`;
- platsspecifika tjänster och ombokningsplats kan tappas;
- compact/inline kan gå vidare med ogiltig kontakt.

### Minsta förändring

1. Frys ett kanoniskt bokningsstate för plats, tjänst, personal, datum och steg.
2. Läs svenska kanonparametrar och behåll engelska alias för gamla länkar.
3. Nollställ beroende val och steg i en gemensam befintlig kodväg.
4. Lägg request-sekvens eller abort på slotshämtning så senaste val alltid vinner.
5. Bygg datumgränser från serverns platsregler och tidszon.
6. Behåll `location_id` genom vanlig bokning och Boka igen/ombokning.
7. Använd riktig kontaktvalidering i compact/inline.

### Bevis

- enhets-/kontraktstest för varje gap ovan;
- browsermatris: fyra lägen × enplats/flerplats × vanlig/djuplänk, reducerad till
  minsta representativa fall som bevisar gemensam motor;
- snabbt byte mellan två val bevisar latest-request-wins;
- previewbokning skapas på vald plats och lämnar ingen testtid aktiv.

### Lokal låsning

Kan bli **100 % lokalt**. Ingen produktion eller riktig SMS-leverans krävs.

## Goal 82 — personaladmin och tenantlivscykel

### Problem som stängs

- pausad/suspended/provisioning tenant stoppas inte konsekvent server-side;
- personal kan se genvägar till ytor som deras grant nekar;
- personalprofilen använder den branschspecifika etiketten `FRISÖR`;
- roll × plats × serveraction har mycket test, men saknar ett samlat acceptansbevis.

### Minsta förändring

1. Återanvänd en serverägd tenantstatusvakt för mutationer och publicering.
2. Filtrera befintliga genvägar med samma area-/grantmodell som destinationssidan.
3. Ersätt hårdkodad frisörterm med befintlig branschneutral roll-/personcopy.
4. Testa ägare, manager och personal med och utan plats-/områdesgrant.
5. Behåll ägarfunktioner i ägaradmin; personalytan får ingen ny konfigurationsmotor.

### Bevis

- negativa direkta URL-/serveractiontester;
- pausad tenant kan läsa rätt information men inte mutera eller publicera;
- rätt personal kan hantera egen/delegerad kalender, kund och frånvaro;
- fel personal/tenant/plats nekas fail-closed;
- kort desktop- och mobilbrowserkontroll utan redesign.

### Lokal låsning

Kod och browsermatris kan bli **100 % lokalt**. Zivars fysiska
mobilacceptans för historiska Goal 71–73 förblir separat releasebevis.

## Goal 83 — tenantens regionala grundkontrakt

### Beslut

Alternativ A gäller: svensk lansering färdigställs samtidigt som databasen och
servern får tenantstyrd regional grund. Ett andra land är uttryckligen utanför
detta program.

### Minsta förändring

1. Fastställ serverägda värden för `country`, `locale`, `currency` och
   standardtidszon per tenant, med platsens tidszon där platsen äger kalendern.
2. Återanvänd nuvarande settings-/tenantmodell; skapa ingen parallell
   localization-tabell om befintlig JSON/kolumn räcker.
3. Normalisera telefon till E.164 vid trust boundary och visa lokalt format i UI.
4. Låt bokning, notifiering och prisformat läsa samma värden.
5. Sätt svenska säkra defaults för befintliga tenants och onboarding.
6. Dokumentera adaptergränser för framtida moms/översättning utan att bygga dem.

### Bevis

- svensk tenant får `sv-SE`, `SEK`, `SE` och vald IANA-tidszon;
- svensk telefon normaliseras till `+46…`; felaktigt land/nummer nekas;
- tider och datum är stabila över browser i annan tidszon;
- prisformat och notifieringsspråk använder tenantens kontrakt;
- cross-tenant settingsåtkomst nekas.

### Lokal låsning

Den regionala grunden kan bli **100 % lokalt**. Full i18n, skatteberäkning och
första icke-svenska marknad kan inte räknas som klara och byggs inte nu.

## Goal 84 — komplett onboarding till första bokning

### Problem som stängs

Goal 76 bevisar readiness och publicering var för sig. Nu behövs en enda verklig
kedja som visar att superadminens skapade kund går att konfigurera och använda.

### Minsta förändring

1. Seeda en ren syntetisk tenant på preview.
2. Kör create → ägare → plats/öppettider → tjänst → personal →
   tjänstekoppling/schema → modulval.
3. Kontrollera exakta readinessblockerare efter varje saknad del.
4. Publicera genom den befintliga atomiska grinden.
5. Öppna `<slug>.boka.corevo.se`, välj ett Goal 81-läge och skapa första
   verifierade bokningen med lokal testtransport.
6. Städa endast testbokningen; behåll reproducerbar tenantfixture.

### Bevis

- en browserkedja på desktop och en kort mobilsmoke;
- ingen `active`-bypass och ingen tenantunik Cloudflare-route;
- booking-off-tenant publiceras som webbplats utan bokningsreadiness;
- booking-live-tenant kräver hela bokningsgrunden;
- första bokningen har rätt tenant, plats, personal och outboxrelation.

### Lokal låsning

Kan bli **100 % på localhost + Supabase-preview**. DNS/HTTPS i produktion är en
releasegrind, inte ett lokalt produktgap.

## Goal 85 — fail-closed lokal releaseövning

### Problem som stängs

En grön build får inte kunna deployas med fel migrationer, osynkade hosts,
saknade scheduler-secrets eller otydlig rollback.

### Minsta förändring

1. Repetera migration `0001–senaste` på disposable Supabase-branch om replay kan
   göras utan att förstöra den persistenta acceptansbranchen.
2. Kräv lokalt/remote migrationsfingerprint och produktionens explicita checkpoint.
3. Kör SQL-runtimeprov, RLS/grants och relevanta security advisors på preview.
4. Verifiera canonical hostkontrakt för storefront, portal, admin och personal.
5. Kör scheduler/cron fail-closed med saknade och korrekta secrets.
6. Generera deployplan och rollbacksteg utan att köra produktionsdeploy.
7. Gör kvarvarande P1-säkerhetsfynd till explicit releaseblockerare eller
   dokumenterad, riskbedömd senarepost; inga massändringar av RLS i detta goal.

### Bevis

- CI-kontraktet kan inte skippa kritiska tester;
- schema-/hostdrift ger rött resultat;
- inga secrets eller PII skrivs i artefakter;
- migrations- och approllback har ett testat kommando-/beslutsflöde;
- produktion förblir orörd.

### Lokal låsning

Releaseövningen kan bli **100 % lokalt/preview**. Riktig deploy, e-postleverans,
DNS/SSL och extern health kan endast bli 100 % i den samlade releasen.

## Goal 86 — en gemensam localhostacceptans

### Zivars enda testsession

1. Superadmin skapar och konfigurerar en svensk tenant.
2. Tenant publiceras först när readiness är grön.
3. Sida/mall och webbplatsläge beter sig enligt Goal 77–80.
4. Alla fyra bokningslägen öppnas; representativa djuplänks-/platsfall körs.
5. Fyrasiffrig PIN provas med ett fel, rätt kod och tre fel/ny kod.
6. Bokningen syns i kundportal, kundadmin och rätt personals kalender.
7. Boka igen, avbokning, kontaktbyte, säkerhet/enheter och PWA-smoke körs.
8. Tenant pausas; mutation/publicering blockeras. Den återaktiveras.
9. Releaseövningens rapport visar grönt men kör ingen produktion.

### Frysningsregel

- Godkänt fall markeras låst samma dag.
- Fel blir en avgränsad fix med ett regressionstest, inte ett nytt sidoprojekt.
- När listan är grön fryses funktionerna och endast samlad release återstår.

### Lokal låsning

Goal 86 är **100 % först efter Zivars godkända testsession**. Det är den enda
planerade användartestsessionen före release.

## Vad som medvetet återstår efter Goal 86

- produktionsmigration `0120–senaste`;
- `mina.corevo.se` och övrig host/HTTPS-verifiering;
- riktig e-postfallback-canary och slutlig SIM-/gateway-health;
- produktionsdeploy, domänsmoke och autentiserade liveprov;
- full internationell produkt, första nya land, full i18n, moms/skatt per marknad;
- partnerprovision och volym-/prestandaarbete som inte blockerar svensk pilot.
