# Implementationsplan: PIN-bokning med Giada och e-postfallback

> **Status:** Tilläggsrevision lokalt genomförd 2026-07-23; migration, deploy och e-postcanary återstår
> **Kanon:** `02-PIN-BOKNING-SIM-FALLBACK-DESIGN.md`  
> **Kodbaser:** Corevo-plattformen + `corevo-sms`  
> **Driftsregel:** Inget riktigt SMS skickas innan fysisk SIM-canary uttryckligen körs.

## Mål

En publik bokning får inte skapas innan kontaktvägen har verifierats med en
fyrsiffrig PIN. Tenantens bokningsinställning väljer endast SMS, SMS med
e-postreserv eller endast e-post. Efter tre fel spärras koden och kunden begär
en ny. PIN och bokningsbekräftelse skickas direkt; Cloudflares 15-minuterscron
ligger inte i den normala vägen.

## Hårda gränser

- `notifications_outbox` förblir enda durabla händelse-/leveransledgern.
- Giada får aldrig Supabase-nycklar eller direkt databasåtkomst.
- Ingen ny Worker, Queue, Durable Object eller cron skapas.
- Klartext-PIN sparas aldrig i Postgres, loggar eller Giadas SQLite.
- Ett modem/SIM kan i denna fas bara skicka med det nummer som operatören tillåter. `sender_id` i kontraktet är för framtida godkänd A2P/SMPP-adapter.
- Befintliga lokala ändringar i `boka/actions.ts`, `booking/tz.ts` och `booking/tz.test.ts` bevaras och integreras.

## Task 1: Isolera arbetet och lås baslinjen

**Corevo-filer:**

- Modify: `HANDOFF.md`
- Create: `2-Byggplan/goals/goal-74-pin-bokning-sim-fallback.md`
- Test: `5-Kod/apps/web/lib/booking/tz.test.ts`

**Steg:**

1. Skapa en worktree för `codex/pin-booking-sim-fallback`; rör inte den smutsiga `main`-checkouten.
2. Kopiera in exakt de tre användarägda tidszonsändringarna från `main` och verifiera att diffen är identisk.
3. Kör `pnpm --filter @corevo/web test -- lib/booking/tz.test.ts`, `pnpm --filter @corevo/web typecheck` och gatewayens `python -m pytest` som baslinje.
4. Skapa goal-74 och markera goal-73 som väntande på Zivars acceptans, inte verifierat klar.
5. Commit: `docs: starta goal 74 för verifierad bokning`.

## Task 2: Gör Giadas transportkontrakt sanningsenligt och säkert

**Gateway-filer (`corevo-sms`):**

- Modify: `backend/app/auth.py`
- Modify: `backend/app/db.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/queue_service.py`
- Create: `tests/test_api.py`
- Create: `tests/test_auth.py`
- Modify: `docs/OUTBOX_GATEWAY_INTEGRATION.md`
- Modify: `.env.example`

**Rött test först:**

1. Skriv API-test som kräver `503 modem_offline` för `require_online=true` när providerstatus är offline.
2. Skriv test som kräver idempotent återanvändning av `idempotency_key`.
3. Skriv test som bevisar att API-nyckel kan autentisera men aldrig lagras i klartext efter migrering/rotation.
4. Skriv test som kräver att okänt/otillåtet `sender_id` avvisas i nuvarande SIM-provider i stället för att låtsas stödjas.

**Minimal implementation:**

5. Utöka `POST /api/v1/messages` med `require_online` och valfri `sender_id`.
6. Kontrollera providerhälsa före köläggning när `require_online=true`; svara 503 utan att skapa köpost om modemet inte är online.
7. Behåll stabil idempotens och returnera befintligt meddelande-id på retry.
8. Lägg till `api_key_hash`, migrera befintlig nyckel till SHA-256-hash och jämför konstant-tid; nya/roterade nycklar visas bara en gång.
9. Dokumentera request/response-kontraktet och att SIM-adaptern inte ger alfanumeriskt avsändarnamn.
10. Kör `python -m pytest` och commit: `feat: harden direct sms gateway contract`.

## Task 3: Lägg ett server-only Giada-kontrakt i Corevo

**Corevo-filer:**

- Create: `5-Kod/apps/web/lib/notifications/giada.ts`
- Create: `5-Kod/apps/web/lib/notifications/giada.test.ts`
- Modify: `5-Kod/apps/web/.env.example`
- Modify: `5-Kod/apps/web/lib/env.ts`

**Rött test först:**

1. Health-test: bara HTTP 200 + `status=ok` + `modem_online=true` + färsk timestamp ger `sms`.
2. Timeout/401/5xx/stale/offline ger deterministiskt `email`.
3. Send-test: API-nyckeln ligger bara i header, `require_online=true`, timeout är kort och idempotensnyckeln skickas.
4. Testa att mottagare och meddelandetext inte loggas vid fel.

**Minimal implementation:**

5. Lägg till `GIADA_SMS_BASE_URL`, `GIADA_SMS_API_KEY`, `GIADA_HEALTH_MAX_AGE_SECONDS` och korta timeouts i servermiljön.
6. Implementera `getBookingContactMode()` och `sendGiadaMessage()` utan klientexponerade secrets.
7. Returnera strukturerade felkoder som skiljer offline från transportfel; inga retries i browsern.
8. Kör filtest + typecheck och commit: `feat: add giada booking transport client`.

## Task 4: Skapa privat PIN-utmaning och atomisk DB-sanning

**Corevo-filer:**

- Create via Supabase CLI: nästa migration med namnet `pin_booking_verification`
- Create: `5-Kod/apps/web/lib/booking/pin-booking-migration.contract.test.ts`
- Regenerate: `5-Kod/packages/db/src/types.ts`

**Rött test först:**

1. Kontraktstest kräver privat tabell, RLS/Data API-revokes och ingen klartextkolumn.
2. Kontraktstest kräver fem minuters TTL, max tre försök, 30 sekunders resend-gate och engångskonsumtion.
3. Kontraktstest kräver atomisk RPC som låser challenge + hold, skapar bokning, konsumerar challenge och skriver bekräftelseevent till `notifications_outbox` i samma transaktion.
4. Kontraktstest kräver att fel PIN, utgången PIN, fel kontakt, fel session, upptagen tid eller återanvänd challenge inte kan skapa bokning.

**Minimal implementation:**

5. Kör Supabase CLI `migration new pin_booking_verification`; använd exakt den genererade filen.
6. Skapa `private.booking_verification_challenges` med HMAC-digest, kanal, maskerad kontaktmetadata, expiry, attempts, resend-at och consumed-at.
7. Skapa service-role-RPC:er för att starta/ersätta challenge, registrera leveransresultat och verifiera kandidatdigest.
8. Skapa en enda finalize-RPC som återvaliderar tenant/tjänst/personal/plats/tid, låser aktiv hold, konsumerar challenge, anropar bokningsintegritetskontraktet och skriver outboxevent atomiskt.
9. Filtrera bort aktiva holds i availability och stärk hold-RPC:n så överlappande holds mellan olika sessioner inte kan samexistera.
10. Regenerera typer, kör migrationstest + DB-relaterade kontraktstest och commit: `feat: add atomic verified booking contract`.

## Task 5: Bygg PIN-tjänsten med HMAC och direkt leverans

**Corevo-filer:**

- Create: `5-Kod/apps/web/lib/booking/verification.ts`
- Create: `5-Kod/apps/web/lib/booking/verification.test.ts`
- Modify: `5-Kod/apps/web/lib/security/rate-limit.ts`
- Modify: `5-Kod/apps/web/lib/security/rate-limit.test.ts`
- Modify: `5-Kod/apps/web/lib/notifications/email.ts`
- Modify: `5-Kod/apps/web/lib/notifications/email.test.ts`
- Modify: `5-Kod/apps/web/.env.example`

**Rött test först:**

1. Testa kryptografiskt säker fyrsiffrig PIN och HMAC-SHA-256 med `BOOKING_PIN_PEPPER`.
2. Testa att PIN aldrig returneras eller loggas efter transportanropet.
3. Testa SMS- och e-postmall på svenska med exakt fem minuters giltighet.
4. Testa fail-closed rate limits per IP+tenant+kontakt för start, resend och verify.
5. Testa att lyckad provideracceptans registreras men providerfel inte gör challenge verifierbar som om leveransen lyckats.

**Minimal implementation:**

6. Implementera PIN-generator/digest och server-only orchestration.
7. SMS: skapa challenge, skicka direkt till Giada, registrera resultat; vid offline växlar nästa UI-laddning till e-post men bokning skapas aldrig.
8. E-post: samma challengekontrakt och direkt befintlig mailtransport.
9. Lägg till separata strikta rate-limit buckets; booking-finalize behåller befintlig write-limit.
10. Kör filtester + typecheck och commit: `feat: add booking pin verification service`.

## Task 6: Ersätt den publika direktbokningen med PIN-styrda server actions

**Corevo-filer:**

- Modify: `5-Kod/apps/web/app/boka/actions.ts`
- Create: `5-Kod/apps/web/app/boka/actions.pin.test.ts`
- Modify: `5-Kod/apps/web/lib/booking/holds.ts`
- Modify: `5-Kod/apps/web/lib/booking/holds.test.ts`

**Rött test först:**

1. Testa contact-mode action: SMS när Giada är frisk, annars e-post.
2. Testa start action: normalisering/validering, hold, challenge och omedelbar leverans; ingen bokning skapas.
3. Testa verify/finalize action: fel PIN ger inget booking-RPC-anrop; rätt PIN ger exakt ett atomiskt RPC-anrop.
4. Testa idempotent retry efter förlorat svar.
5. Testa att kanalen låses till challengens servervalda kanal och inte kan manipuleras av klienten.

**Minimal implementation:**

6. Lägg till `getBookingContactMode`, `startBookingVerification`, `resendBookingVerification` och `verifyAndCreateBooking`.
7. Avveckla `createBooking` som publik bypass; låt all skapning gå genom finalize-RPC:n.
8. Behåll exakt befintlig slot/error/payment-mappning och den användarägda canonical-timestamp-fixen.
9. Använd `filterHeldSlots` med serverhämtade aktiva holds.
10. Kör action-/hold-/tidszonstester + typecheck och commit: `feat: require verified contact before booking`.

## Task 7: Gör bokningsgränssnittet enkelt och sanningsenligt

**Corevo-filer:**

- Modify: `5-Kod/apps/web/components/booking/BookingWizard.tsx`
- Modify: befintlig boknings-CSS för samma designvariant
- Create: `5-Kod/apps/web/components/booking/BookingWizard.pin.test.tsx`

**Rött test först:**

1. SMS-läge visar namn + telefon, inte obligatorisk e-post.
2. Offline-läge visar namn + e-post, inte telefonfält.
3. Första CTA skickar kod och går till PIN-vy; den får inte visa bokning klar.
4. PIN-vy visar maskerad destination, countdown/resend och tydliga fel för fel/utgången kod.
5. Endast lyckad finalize visar befintlig bekräftelse/paymentslinga.
6. Transportfel bevarar formulär/tid och säger aldrig att bokningen kan ha gått igenom före finalize.

**Minimal implementation:**

7. Hämta contact mode server-side när kontaktsteget öppnas och visa en liten laddstatus tills läget är känt.
8. Lägg PIN som ett kort mellan kontaktuppgifter och bekräftelse; håll befintlig visuella designkanon.
9. Lås CTA under request, stöd fyra siffror, paste och resend efter 30 sekunder.
10. Uppdatera compact och wizard utan branschhårdkodning.
11. Kör komponenttest, lint och typecheck; commit: `feat: add booking pin user flow`.

## Task 8: Skicka bokningsbekräftelsen omedelbart utan extra Worker

**Corevo-filer:**

- Modify: `5-Kod/apps/web/lib/notifications/sms.ts`
- Modify: `5-Kod/apps/web/lib/notifications/sms.test.ts`
- Modify: `5-Kod/apps/web/lib/notifications/outbox.ts`
- Modify: `5-Kod/apps/web/lib/notifications/outbox.test.ts`
- Modify: `5-Kod/apps/web/lib/notifications/booking-events.ts`
- Modify: `5-Kod/apps/web/lib/notifications/booking-events.test.ts`
- Modify: `5-Kod/apps/web/custom-worker.mjs` endast om ett test visar att vanlig request-dispatch annars inte kan återanvändas

**Rött test först:**

1. Finalize skapar exakt ett confirmation-outboxevent.
2. Samma serverrequest claimar och skickar det nya eventet direkt med `outbox:<uuid>`.
3. Giada accepterat => outbox ack; timeout/5xx => retrybar rad kvar, bokningen ligger kvar.
4. E-postfallback använder samma direkta dispatchprincip.
5. Befintlig 15-minutersscheduler skapar fortsatt påminnelser men är inte ett krav för PIN/bekräftelse.

**Minimal implementation:**

6. Lägg en avgränsad `dispatchOutboxEventNow(outboxId)` som återanvänder claim/begin/ack och rätt transportadapter.
7. Kör den efter committad finalize; leveransfel får inte rulla tillbaka bokningen.
8. Behåll cron oförändrad för schemalagda event och dokumentera dess separata ansvar.
9. Kör notifieringstester + typecheck och commit: `feat: dispatch booking confirmations immediately`.

## Task 9: Drift, secrets och deployment utan live-SMS

**Corevo-filer:**

- Create: `5-Kod/docs/ops/pin-booking-giada-runbook.md`
- Modify: `5-Kod/docs/ops/secrets-inventering.md` om filen finns
- Create: `6-Testing/pin-bokning-sms-email-canary.md`
- Modify: `HANDOFF.md`

**Gateway-filer:**

- Modify: `docs/GIADA_OPERATIONS.md`
- Modify: `scripts/healthcheck.sh`
- Modify: `tests/test_ops_scripts.py`

**Steg:**

1. Dokumentera secret-rotation, tunnelhealth, API-health, modemhealth, fallback och rollback.
2. Lägg healthcheck som verifierar både lokalt API och att den publika tunnelvägen svarar utan att skicka SMS.
3. Dokumentera exakt fysisk canary: sätt canarynummer, sätt SIM, verifiera LAN-default route, skicka en PIN, skapa en demobokning, kontrollera direkt bekräftelse och kontrollera outbox/SQLite.
4. Dokumentera e-postfallback-test genom att stoppa modemet/worker utan att stoppa webben.
5. Inga riktiga mottagare eller credentials skrivs i repo.
6. Kör gatewaytest, webtest, lint, typecheck och build.
7. Kör `git diff --check`, secrets-sökning och oberoende verifiering mot designens acceptanskriterier.
8. Uppdatera HANDOFF med exakt vad som är kodklart, vad som är deployat och vad som väntar på fysisk SIM/Telia.
9. Commit: `docs: add verified booking operations and canary`.

## Slutverifiering

Följande måste vara grönt innan branch kan betraktas som kodklar:

```powershell
Set-Location 5-Kod
pnpm --filter @corevo/web test
pnpm --filter @corevo/web lint
pnpm --filter @corevo/web typecheck
pnpm --filter @corevo/web build
```

```powershell
Set-Location C:\Users\Zivar-PC\Desktop\corevo-sms-dev
python -m pytest
```

Dessutom:

- fel/utgången PIN skapar ingen bokning,
- rätt PIN skapar exakt en bokning och ett outboxevent,
- SMS- och e-postbekräftelse dispatchas direkt,
- Giada offline visar e-post innan kunden matar in kontaktuppgift,
- inga PIN-koder, telefonnummer, e-postadresser eller API-nycklar finns i loggutskrifter,
- `wrangler.jsonc` har ingen ny trigger och 15-minuterscron ligger utanför direktflödet,
- fysisk live-SMS-canary kvarstår som manuell spärr tills SIM är inkopplat.

## Task 10: Fyrsiffrig boknings-PIN och tenantstyrt kanalval

**Filer:**

- Modify: `5-Kod/apps/web/lib/platform/booking-variant.ts`
- Test: `5-Kod/apps/web/lib/platform/booking-variant.test.ts`
- Modify: `5-Kod/apps/web/lib/notifications/giada.ts`
- Test: `5-Kod/apps/web/lib/notifications/giada.test.ts`
- Modify: `5-Kod/apps/web/lib/admin/scoped-settings.ts`
- Test: `5-Kod/apps/web/lib/admin/scoped-settings.test.ts`
- Modify: `5-Kod/apps/web/lib/admin/actions.ts`
- Modify: `5-Kod/apps/web/components/admin/SettingsForm.tsx`
- Modify: `5-Kod/apps/web/app/(admin)/admin/installningar/bokning/page.tsx`
- Modify: `5-Kod/apps/web/lib/platform/actions/data.ts`
- Modify: `5-Kod/apps/web/components/platform/BookingSettings.tsx`
- Modify: `5-Kod/apps/web/components/platform/SidaStudio.tsx`
- Modify: `5-Kod/apps/web/app/(platform)/kunder/(board)/[id]/page.tsx`
- Modify: `5-Kod/apps/web/app/boka/actions.ts`
- Modify: `5-Kod/apps/web/components/booking/BookingWizard.tsx`
- Modify: `5-Kod/apps/web/lib/booking/verification.ts`
- Test: `5-Kod/apps/web/lib/booking/verification.test.ts`
- Create via Supabase CLI: nästa migration med namnet
  `booking_pin_three_attempts`
- Test: `5-Kod/apps/web/lib/booking/booking-pin-attempt-limit.contract.test.ts`

**TDD-steg:**

1. Lägg röda testfall för tre kanalpolicys, bakåtkompatibel standard,
   fyrsiffrig PIN, tre DB-försök och bevarad settings-merge.
2. Kör de fem riktade testfilerna och bekräfta att de faller på de nya kraven.
3. Lägg enum/läsare i den befintliga booking-settings-seamen och spara samma
   `settings.booking.verificationMode` från båda adminytorna.
4. Låt servern kombinera tenantvalet med Giada-health. `sms_only` får aldrig
   falla över till e-post; `email_only` gör inget health-anrop.
5. Ändra endast Goal-74:s publika boknings-PIN till fyra siffror. Kundportalens
   separata recovery-/kontaktbyteskoder behåller sitt befintliga kontrakt.
6. Ersätt DB-funktionens femförsöksgräns med tre i en framåtriktad migration;
   klar PIN lagras fortfarande aldrig.
7. Kör riktade tester, typecheck, lint, build och `git diff --check`.
8. Uppdatera Goal-74 och den manuella testlistan. Flytta inte goal till `klart/`
   före driftsatt migration, deploy och verklig e-postfallback-canary.
