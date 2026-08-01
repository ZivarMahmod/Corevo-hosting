# Goal-74 — teknisk slutgrind-audit

Datum: 2026-07-22. Audittypen är read-only mot kod och produktion; inga
produktionsskrivningar, deployer eller secret-/PII-utskrifter gjordes.

## Beslut

SMS/PIN-finalisering till
bekräftad bokning, direkt confirmation-outbox och fysisk mottagning av
confirmation-SMS är nu livebevisade. Kvarvarande grind är en full
e-postfallbackbokning. Efter godkänt prov behövs endast statusdokumentation: Goal-filen har
fortfarande en gammal omarkerad SIM-canary och texten att inget är driftsatt,
trots senare verifierat driftbevis.

Ett nytt slutprov samma dag hittade en isolerad presentationsbugg: den publika
bekräftelsesidan lovade e-post även efter SMS-verifiering. Copyt gjordes
kanalneutralt med ett RED→GREEN-regressionstest; den rättningen måste följa
ordinarie verifiering/deploy innan slutgrinden kan arkiveras.

## Verifierat nuläge

- Produktion är dokumenterad på migration `0118–0119`; `0119` kör den exakta
  service-role-claimen som tidigare stoppade PIN-raden. Worker
  `0d440c6f-fbfa-433a-b8f5-c5f39f72d3da` kommer från deploy-run `29840569825`.
- Read-only kontroll 2026-07-22 07:14 CEST: `sms.corevo.se/health` gav
  `status=ok`, `send_enabled=true`, `modem_online=true`, `queue_pending=0` och
  färsk tid. `freshcut.corevo.se` gav HTTP 200 och tenant-header.
- Ett tidigare liveprov har redan bevisat telefonläge, direkt PIN genom DB →
  exakt PIN-outboxrad → Giada samt `sent`. Provet avbröts före finalize; det
  bevisade då inte bokningsskapande eller bekräftelse-SMS.
- Senare read-only produktionsbevis visar två separata konsumerade
  Demo-challenges, vardera kopplad till exakt en `confirmed` booking och en
  `booking_confirmation` med `chosen_channel=sms`, `status=sent` och
  `attempt_count=1`:
  - booking `fb21ed6c-bd80-4e91-b440-3dd4935b5d10`, challenge
    `924d7c3f-c499-4a0f-b5f7-27f75cbdfe1e`, outbox
    `cf0afaba-d1d5-46d1-add7-e2784f0a76a2`;
  - booking `59229d10-84e4-4a51-a7a6-2637d6b0eed8`, challenge
    `834dcc1b-91fe-48e8-8a7b-156ebac9bbdc`, outbox
    `8bbac8da-5445-4f7c-9769-ed382ebaa269`.
  Detta livebevisar finalize, exakt bokning↔challenge↔confirmation-outbox och
  direkt accepterad SMS-dispatch på DB/outbox-nivå.
- Zivar visade 2026-07-22 ett mottagarbevis från sin telefon för Demo-flödet:
  verifierings-SMS följdes av bekräftelsen för bokningen fredag 31 juli 18:30.
  Skärmbilden innehåller PIN och full bearer-länk och checkas därför avsiktligt
  inte in i repot. Detta stänger den separata fysiska mottagargrinden.
- Gatewayens fristående själv-SIM-canary kördes fysiskt på Giada 2026-07-22
  efter deploy av `corevo-sms` merge-SHA `32ed4be`. Quectel-modemets eget
  MSISDN lästes direkt från ModemManager till en rootägd `0640`-fil utan att
  visas eller loggas. Canaryn tog en inbox-baseline, skickade unik PIN + 96-bit
  nonce till samma SIM och krävde exakt body-match på en nyare inkommande rad.
  Resultat: `PASS: self-SIM loopback verifierad.` efter 17 sekunder.
- Samma driftkontroll bekräftade att kabel-LAN fortsatt äger default route:
  trafik till `1.1.1.1` går via `eno1`/`192.168.50.1`; modemets `cdc-wdm0` är
  unmanaged och kan inte ta över serverns internetväg.
- `app/boka/actions.ts` har ingen publik `createBooking`-bypass. Rätt PIN går
  endast till `finalize_verified_storefront_booking`; dess returnerade
  `outbox_id` claimas direkt med `dispatchNotificationOutboxById` och awaitas i
  samma request.
- `0118_pin_booking_verification.sql` låser challenge-raden `FOR UPDATE`, kräver
  levererad och oförbrukad challenge, matchande HMAC/kontakt/val/hold, skapar
  bokning + ett `booking_confirmation` eller `booking_request_received`,
  konsumerar challenge och släpper hold i samma transaktion. En redan konsumerad
  challenge returnerar samma `booking_id` och `outbox_id`.
- Ytterligare dubblettskydd finns i unik `(tenant_id, request_id)` på bokningar,
  unik outbox-eventnyckel och Giada-nyckeln `outbox:<outbox-id>`. Exakt
  outbox-CAS/begin hindrar ett redan skickat event från att skickas igen.
- E-postfallback är fail-closed: saknad/stale/offline Giada ger e-post före
  kontaktinmatning. PIN och bekräftelse använder befintlig HTTPS-relay. Central
  loggsink maskar e-post/telefon; PIN sparas inte i DB/outbox.
- Lokalt auditbevis: 9 riktade filer/58 tester samt e-post/PII 2 filer/25 tester
  passerade, liksom web-typecheck och `git diff --check`. Full CI-bevisning och
  gatewayens 77 tester finns redan dokumenterade. SQL-runtimeproven för
  `0118–0119` bevisar schema/grants/claim, men utför avsiktligt inte en verklig
  finalize mot kunddata. Därför kan livegrinden inte kvitteras mekaniskt.

## Exakt kvarvarande arbete och säker ordning

1. Frys deploy/schema under e-postprovet. Välj en separat ledig demotid och
   godkänd canary-inkorg. Notera bara tekniska ID:n i beviset.
2. Bekräfta `queue_pending=0`. Sätt därefter Giadas dokumenterade kill-switch
   `COREVO_LIVE_SEND_ENABLED=false` och starta om API/worker. Detta är ett
   godkänt opssteg, inte ett kodsteg. Ta inte bort `BOOKING_PIN_PEPPER` eller
   e-postrelay.
3. Verifiera färsk health med `modem_online=false`. Öppna ett nytt privat
   bokningsfönster och kontrollera att endast e-post visas. Bekräfta att vald tid
   saknar bokning innan PIN.
4. Skicka e-post-PIN, prova en felaktig kod en gång och sedan rätt kod. Kräv
   exakt en bokning, exakt en confirmation/request-outboxrad och omedelbart
   mottagen bekräftelse via e-post. Lämna bevisraderna kvar; radera dem inte.
5. Återställ `COREVO_LIVE_SEND_ENABLED=true`, starta om API/worker och kräv
   färsk `modem_online=true` samt tom kö.
6. Skapa ingen tredje SMS-bokning enbart för DB- eller mottagarbevis: de två
   verifierade kedjorna och Zivars mottagarbevis ovan räcker.
7. Tvinga inte ett internt RPC-replay i produktion. Om UI naturligt tillåter
   omtryck på samma challenge ska samma ID:n returneras utan ny rad; annars räcker
   DB-/outbox-/Giada-uniciteten plus befintliga tester. Ett aktivt tvåklientsprov
   hör endast hemma i staging.
8. När e-postcanaryn och eventuell kvarvarande fysisk SMS-mottagarbekräftelse är godkända: uppdatera Goal-74/HANDOFF/testlistan med
   datum och maskerade tekniska ID:n och flytta goal enligt repo-processen.

## Säkra kontroller

Read-only health, utan auth eller mottagardata:

```powershell
$h = Invoke-RestMethod https://sms.corevo.se/health
$h | Select-Object status,send_enabled,modem_online,queue_pending,time
```

Lokalt, inga externa utskick:

```powershell
Set-Location 5-Kod
pnpm --filter @corevo/web test -- app/boka/actions.pin.contract.test.ts lib/booking/pin-booking-migration.contract.test.ts lib/booking/pin-hold-concurrency.contract.test.ts lib/booking/public-booking-integrity.contract.test.ts lib/booking/verification.test.ts lib/notifications/giada.test.ts lib/notifications/booking-immediate.test.ts lib/notifications/outbox.test.ts components/booking/booking-pin-ui.contract.test.ts lib/notifications/email.test.ts lib/platform/actions/observe.test.ts
pnpm --filter @corevo/web typecheck
git diff --check
```

Efter varje live-finalize ska en behörig operatör göra read-only urval på det
returnerade `booking_id`; välj aldrig kontaktfält, meddelandetext, digest eller PIN:

```sql
select id, tenant_id, staff_id, start_ts, status, request_id
from public.bookings where id = '<booking-id>';

select id, booking_id, outbox_id, channel, consumed_at
from private.booking_verification_challenges where booking_id = '<booking-id>';

select id, event_type, chosen_channel, status, attempt_count, max_attempts,
       provider_ref, last_error, created_at, updated_at
from public.notifications_outbox where booking_id = '<booking-id>';
```

Kör inte `concurrent_overlapping_holds.mjs`, migrationsapply/repair, deploy eller
direkta service-role-RPC:er mot produktion som del av bevisinsamlingen.

## Zivar/extern input

- Zivar måste godkänna inkorg, demotid och den korta Giada-kill-switchperioden
  samt bekräfta e-postleveransen.
- Behörig opsperson behöver växla Giada-grinden/starta om tjänster och läsa
  Supabase-/Giada-ledgers utan att kopiera PII eller secrets.
- Den externa e-postrelayens verkliga leverans kan inte bevisas av kodtest; den
  måste observeras i canary-inkorgen.

## Stop/rollback

Vid minsta avvikelse: stoppa nya prov, sätt först
`COREVO_LIVE_SEND_ENABLED=false`, bekräfta tom/avstängd gatewaykö och avstäm
bokning/outbox/Giada read-only. Behåll e-postrelay och `BOOKING_PIN_PEPPER` så
bokning fortsätter verifierat via e-post. Rulla **inte** tillbaka `0118–0119`.
Eftersom slutgrinden inte kräver ny deploy finns normalt ingen Worker att rulla
tillbaka; vid en separat konstaterad Worker-regression används ordinarie
`wrangler deployments list`/`wrangler rollback <last-good-version>` först efter
att SMS-grinden stängts.

**Största blockerare:** e-postrelayens verkliga fallbackleverans och fulla
e-postfinalize är fortfarande obesiktigade. SMS-finalize, confirmation-dispatch,
fysisk mottagning och automatisk själv-SIM-loopback är livebevisade.
