# goal-74 — Verifierad publik bokning via SMS eller e-post

> Startad 2026-07-21 på Zivars uttryckliga prioritering. Goal-73 är mekaniskt
> verifierad men ligger kvar i väntan på Zivars fysiska liveacceptans.

## Mål

En publik bokning skapas först efter att besökaren verifierat sin valda
kontaktväg med en fyrsiffrig PIN. Tenantens bokningsinställning väljer endast
SMS, SMS med e-postreserv eller endast e-post.
PIN och bokningsbekräftelse dispatchas direkt och är inte beroende av den
befintliga 15-minuterskörningen för schemalagda notifieringar.

## Designlag

- `1-Planering/18-sms-direktoperator/02-PIN-BOKNING-SIM-FALLBACK-DESIGN.md`
- `1-Planering/18-sms-direktoperator/03-PIN-BOKNING-SIM-IMPLEMENTATIONSPLAN.md`

## Acceptans

- Klartext-PIN finns bara i serverminnet under det omedelbara transportanropet.
- PIN gäller i fem minuter, max tre försök och resend tidigast efter 30 sekunder.
- Efter tredje felet spärras koden; ny kod krävs och den gamla kan aldrig återbrukas.
- PIN-utskick begränsas fail-closed både per IP och per kontaktmål/challenge.
- Fel, utgången eller redan använd PIN kan aldrig skapa en bokning.
- Challenge, hold, bokning och outboxevent har en atomisk DB-sanning.
- `notifications_outbox` är fortsatt enda durabla notifieringsledgern.
- Giada har ingen Supabase-access och accepterar stabil idempotensnyckel.
- Offline Giada väljer e-post före kontaktsteget; inget falskt SMS-löfte visas.
- Endast-SMS blockerar verifieringen när Giada är nere; endast-mejl frågar inte
  Giada. SMS med e-postreserv behåller dagens automatiska fallback.
- Kundadmin och superadminens kundkort sparar samma
  `settings.booking.verificationMode`.
- Bekräftelsen försöker dispatchas i samma request efter commit. Transportfel
  lämnar en retrybar outboxrad och rullar aldrig tillbaka bokningen.
- Inga nya Workers, Queues, Durable Objects eller crontriggers skapas.
- SIM-provider visar nummer. Alfanumeriskt avsändarnamn aktiveras först genom en
  framtida godkänd A2P/SMPP-adapter bakom samma transportkontrakt.
- Live-SMS förblir spärrat tills fysisk SIM-canary har godkänts uttryckligen.

## Verifiering

- Riktade TDD-test för Giada API/auth, health, HMAC/PIN, rate limits, holds,
  atomisk finalize, actions, UI och omedelbar outboxdispatch.
- Ett tvåklientstest i staging bevisar att olika men överlappande starter för
  samma personal serialiseras; körs efter att migrationen applicerats.
- Full web-Vitest, typecheck, lint och build.
- Full gateway-pytest.
- Manuell e-postfallback-canary utan modem.
- Separat fysisk live-SMS-canary när SIM finns i Giada.

## Status — lokalt verifierad och stängd 2026-07-24

- [x] Implementerad på den samlade branchen
      `codex/launch-inventory-customer-design`
- [x] Fyrsiffrig publik boknings-PIN med exakt tre försök
- [x] Tenantstyrt kanalval: endast SMS, SMS med e-postreserv eller endast e-post
- [x] SMS-flödet skapar inte längre en oanvänd e-postbaserad claim-länk
- [x] Bokningslänken använder den kanoniska hosten `<slug>.boka.corevo.se`
- [x] Migration `0125_booking_pin_three_attempts.sql` körd och
      runtimekontrollerad på Supabase-branchen `localhost-acceptance`
- [x] Funktionsgrant verifierad: endast `service_role` får finalisera
- [x] Fysisk SIM-canary godkänd — två verifierade Demo-kedjor med mottagarbevis
      samt automatisk själv-SIM-loopback på Giada 2026-07-22
- [x] Full PIN-finalisering godkänd — ytterligare publik Demo-bokning skapades
      via SMS-PIN och avbokades därefter genom den publika capability-länken
      2026-07-22; ingen testtid lämnades aktiv

Produktkoden är därmed låst lokalt. Produktionsmigration, deploy,
browserverifiering av de tre kanalvalen och e-postfallback-canary ingår i den
gemensamma releaseacceptansen och öppnar inte Goal 74 igen.

Driftordning och manuella canary-steg finns i
`5-Kod/docs/ops/pin-booking-activation.md` respektive
`6-Testing/goal-74-pin-bokning-testlista.md`. Migration `0118–0119` och Worker
`0d440c6f-fbfa-433a-b8f5-c5f39f72d3da` är driftsatta och verifierade enligt
`HANDOFF.md`. Den gemensamma releaseacceptansen ansvarar för migration,
deploy, browserkontroll av tenantens kanalval och e-postfallbackens
leveranscanary.

Mekaniskt bevis 2026-07-21: web 271 testfiler/2 197 tester, typecheck,
lint utan fel och Next-produktionsbuild passerar; migrationen parsas som 30
PostgreSQL-statements; gateway 54/54 tester passerar. Lintens sju varningar är
befintliga och ligger utanför goal-74:s filer.

Lokalt slutbevis 2026-07-24: riktad svit 10 testfiler/57 tester och full web
350 testfiler/2 737 tester passerar. Migrationen är applicerad på den isolerade
Supabase-branchen `localhost-acceptance` (`cwnhpesrgolflkmyjbrm`), där
funktionsdefinition, exakt tre försök, kanonisk bokningshost och
`service_role`-grant runtimekontrollerats. Alla fem SQL-runtimeprov för
migration `0125–0129` passerar. Slutlig typecheck, lint, build och
diffkontroll körs på den committade leveransen innan push.
