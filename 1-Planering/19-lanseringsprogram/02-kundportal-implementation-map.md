# Kundportal v1 — read-only implementation map

**Datum:** 2026-07-22
**Status:** Kartläggning, inte bygglov
**Kanon:** `4-Dokument-Underlag/01-acceptans/kundportal-losenordsfri-pwa-v1/` och `4-Dokument-Underlag/02-design-brief/kundportal-losenordsfri-pwa-v1-designspec.md`

## 0. Beslut före all kod

Den minsta säkra kundportalen är en **ny, host-isolerad, lösenordsfri yta på `mina.corevo.se`**. Den kan dela bokningsdata, notifierings-outbox och rena hjälpfunktioner med plattformen, men den får inte dela auktoritetsmodell med legacy `/konto`.

Byggstart är blockerad just nu:

1. `ACCEPTANCE-MATRIX.md` har samtliga rader markerade `EJ KÖRD`. Paketets ACC-C-050 förbjuder implementation vid öppen blocker eller FAIL. Oberoende designgranskning med 0 blocker/FAIL är därför grind D0.
2. Paketets ACC-C-046/047 stoppar verkliga portal-/recovery-token i produktion tills `corevo-sms` har verifierad authenticated envelope encryption och backupredaktion. Nuvarande gateway lagrar meddelandekropp i klartext enligt kanon.
3. Ny portalsession, länkförbrukning, bokningstillit och portalspecifika RPC:er saknas helt. Att koppla UI direkt till befintlig legacy-auth vore en säkerhetsregression.

Den här planen kan användas för att skriva tester och estimera arbete, men produktimplementation bör inte påbörjas förrän D0 är godkänd.

## 1. Låsta invariants

- Portalhost: endast `https://mina.corevo.se`; okänd/fel host fail-closed.
- Tenantval sker från signerad portalrelation/session, aldrig från fritt request-värde, querystring, slug ensam eller klientstate.
- Kundval sker från samma validerade session. `customer_profile_id`, Supabase Auth och `private.current_customer_id()` är inte tillräckliga portalbevis.
- Magic-link-token ligger i URL-fragment, läses lokalt av JavaScript, POST:as till exchange och tas omedelbart bort med `history.replaceState`. Ingen GET, serverlogg, referrer eller analytics får se token.
- Bara tokenhash lagras. Bara sessionshemlighetens hash lagras. Rotera hemlighet vid användning/revokering enligt designspec.
- Cookie: `__Host-corevo-portal`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/`, ingen `Domain`; 180 dagars idle och 365 dagars absolut livslängd.
- Bokningsflödets trust-cookie är separat: `__Host-corevo-booking-trust` på tenantens publika host och separat DB-kontext. Den är inte en portalsession.
- Alla bokningsläsningar/mutationer binder atomiskt `session -> tenant_id -> customer_id -> booking.tenant_id/customer_id`.
- Ägarskapsfel och okänt boknings-id ger samma neutrala yta/svar.
- Avbokning validerar policy i samma transaktion som statusändringen; dialogens gamla klientbeslut är aldrig auktoritet. Redan avbokad ger idempotent success.
- ”Boka igen” är en extern länk till tenantens publika `/boka`, inte ett nytt bokningsflöde inne i portalen.
- Portalens manifest, ikoner och eventuell service worker innehåller ingen tenant- eller persondata. Personliga routes är network-only/no-store.
- Legacy `customer_portal.mode` bevaras isolerat. Tillåtna värden: `off`, `legacy_account`, `passwordless_tenant`, `global_account` (reserverad). Saknat/okänt värde fail-closed; befintliga tenants backfillas explicit till `legacy_account`.

## 2. Befintlig kod: återanvänd, isolera eller ersätt

| Område | Exakt befintlig kod | Minsta säkra användning | Får inte bli portalens kontrakt |
|---|---|---|---|
| Hostklassning | `5-Kod/apps/web/lib/tenant.ts`, `middleware.ts` | Utöka samma centrala hostklassning med `customer_portal`; lägg `mina` före generisk `*.corevo.se`-tenantmatchning | Nu klassas `mina.corevo.se` som tenant-slug om den inte reserveras; ingen route/API-firewall finns |
| Deploy/DNS | `wrangler.jsonc`, `scripts/domain-routes.mjs`, `scripts/deploy-prod.mjs`, `scripts/gen-deploy-config.mjs` | Gör `mina.corevo.se` till fast custom-domain och obligatorisk fixed route; reservera `mina` i alla speglade listor | Behandla aldrig `mina` som kundslug och skapa aldrig `*.corevo.se` wildcard |
| Backoffice-routing | `lib/auth/host-routing.ts` | Lämna orörd; ny portal-router ligger separat | Backoffice-routern får inte äga portalhosten |
| Legacy kundkonto | `app/(kund)/konto/**`, `lib/kund/customer-host-fence.ts`, `lib/kund/customer-claim-*` | Behåll som regressionsskydd för `legacy_account`; använd endast som beteendereferens | `requirePortal('kund')`, Supabase Auth, GET-claim och legacy host-fence är uttryckligen otillåtna för nya portalen |
| Kund-/bokningsdata | `lib/kund/bookings.ts`, `5-Kod/supabase/migrations/0011_customers_identity_and_schedule.sql` | Återanvänd datamodellens `customers.id`, `bookings.customer_id`, tenant-id och mapningsidéer bakom ny RPC-gräns | Befintliga queries är auth.uid-/RLS-bundna och accepterar legacy `customer_profile_id OR customer_id`; importera dem inte |
| Format | `lib/kund/format.ts` | Extrahera eller återanvänd rena datum-/tidsmönster; skapa portalens valutaformat från faktiskt currency | `statusLabel` har fel copy och okänd-status-fallback; `formatPrice` är hårdkodad till SEK |
| Avbokning | `lib/kund/actions.ts`, `lib/kund/settings.ts` | Återanvänd cutoff-beräkning endast för visning samt befintliga refund/notifierings-side effects efter bekräftad transition | Nuvarande action gör app-side policycheck och service-role update; den uppfyller inte atomisk policy-/ägarskapsgrind |
| Notifiering | `lib/notifications/booking-events.ts`, `lib/notifications/booking-delivery.ts`, befintlig `notifications_outbox` | Behåll en producer/outbox/delivery rail. Minta portallänk JIT i delivery-steget och styr med mode | Skapa inte parallell SMS-jobbkö. `accountClaimUrl ?? manageUrl` måste ersättas av explicit mode-kontrakt |
| PIN/krypto | `lib/booking/verification.ts`, migration `0118_pin_booking_verification.sql` och dess tester | Återanvänd Web Crypto/HMAC-mönster, normalisering, maskning, rate-limit-/attempt-idéer och leveransadapter | `bookingPinDigest()` har för smal domänseparation för portal/recovery. Portal-, challenge- och trust-digest ska vara separata kontrakt med key-version |
| Kalender | `app/boka/bekraftelse/[id]/page.tsx` (`icsStamp`, `icsEscape`, `buildIcs`) | Extrahera minsta rena RFC5545-hjälpare och testa escaping/CRLF | Befintlig data-URL och interna booking-id i UID är inte portalens auth/sekretesskontrakt |
| PWA | `app/api/pwa/kund-manifest/route.ts`, `public/kund-sw.js`, befintliga neutrala PNG-ikoner | Återanvänd route-testmönster och neutrala ikonassets endast om acceptanstest visar exakt passning | Legacy manifest har fel namn/start/scope och `kund-sw.js` får uttryckligen inte återanvändas |
| Plats | `public.locations` från migration `0005`/`0021` | `name`, `address`, `timezone`, `active` kan projiceras i portal-RPC | Tabellen saknar dedikerad telefon/map-URL; visa inte påhittade värden. Härled kartlänk server-side från adress endast om kanon tillåter |

## 3. Ny minimal kod- och filyta

Följ FEATURE-MATRIX och håll portalen samlad. Minsta filyta är:

```text
5-Kod/apps/web/
  app/(customer-portal)/
    layout.tsx
    (open)/oppna/[tenantSlug]/page.tsx
    (open)/aterhamta/[tenantSlug]/page.tsx
    (open)/verifiera/[tenantSlug]/page.tsx
    (open)/hjalp/page.tsx
    mina/page.tsx
    mina/historik/page.tsx
    mina/bokningar/[id]/page.tsx
    mina/profil/page.tsx
    mina/sakerhet/page.tsx
    mina/installera/page.tsx
    mina/integritet/page.tsx
  app/api/customer-portal/
    exchange/route.ts
    manifest/route.ts
    bookings/[id]/calendar/route.ts
  components/customer-portal/
    PortalShell.tsx
    OpenLinkExchange.tsx
    BookingCard.tsx
    BookingDetail.tsx
    CancelDialog.tsx
    HistorySections.tsx
    ProfileForm.tsx
    SecurityPanel.tsx
    InstallPanel.tsx
  lib/customer-portal/
    host-routing.ts
    origin.ts
    crypto.ts
    link.ts
    session.ts
    data.ts
    actions.ts
    recovery.ts
    calendar.ts
    types.ts
  lib/customer-portal/*.test.ts
  public/pwa/customer-portal-icon-{192,512}.png

5-Kod/supabase/
  migrations/0120_customer_portal_security.sql
  tests/customer_portal_security_0120_test.sql

5-Kod/e2e/acceptans/kundportal-losenordsfri-pwa-v1/
  kundportal-losenordsfri-pwa-v1.accept.spec.ts
  probe.js
```

`0120` är nästa lediga migrationsnummer efter verifierad repo-topp `0119`. Dela bara migrationen om faktisk review visar att rollback-/granskningsbarhet blir bättre; skapa inte flera migrationsfiler av vana.

CSS ska lyftas mekaniskt ur designpaketets exakta tokens/prototyper till portalens lokala stylesheet/modul. Befintliga legacy-komponenter under `components/kund/` ska inte importeras: deras copy, stateindelning, design och authantaganden avviker.

## 4. Databasgräns och atomiska operationer

### 4.1 Privata tabeller i migration 0120

- `private.customer_portal_links`: public id, token hash, key version, tenant, customer, purpose, expires/consumed/revoked, delivery intent. Aldrig råtoken.
- `private.customer_portal_sessions`: public session id, secret hash, key version, tenant, customer, created/last-seen/idle-/absolute expiry/revoked, metadata med strikt minimering.
- `private.customer_booking_trusts`: separat trust-id/hash, tenant, customer/relation, idle-/absolute expiry/revoked. Aldrig portal-cookieåteranvändning.
- `private.customer_portal_challenges`: purpose/channel/contact digest, attempts, expiry, consumed/revoked; inga råkoder.
- `private.customer_portal_audit`: tillåtna säkerhetshändelser utan token, kod, cookie, full kontakt eller onödig PII.

Alla tabeller: inga grants till `anon`/`authenticated`, explicita index för hash/public id/expiry, tenantbundna relationer, scrub/revoke vid GDPR. `SECURITY DEFINER`-funktioner ska ha `set search_path=''`, fullt kvalificerade objekt, `REVOKE ALL ... FROM PUBLIC` och endast anropas server-side via service role.

### 4.2 Minsta RPC-kontrakt

SQL-funktionerna ska härleda tenant och customer från validerad session inuti funktionen; Next-lagret skickar aldrig ett auktoritativt tenant-/customer-id.

1. `private.customer_portal_mint_link(...)` — JIT och mode-gated; returnerar råtoken endast en gång till delivery worker.
2. `private.customer_portal_exchange_link(link_public_id, token_digest, new_session_digest, ...)` — låser rad, kontrollerar expiry/purpose/unused, förbrukar länk och skapar session i samma transaktion.
3. `private.customer_portal_session_snapshot(session_public_id, secret_digest, now)` — verifierar hash/idle/absolute/revoked/mode/customer status och roterar/touchar kontrollerat.
4. `private.customer_portal_list_bookings(session..., cursor, page_size)` — max 20, stabil cursor, exakta kommande/historik-sektioner och endast presentationsfält.
5. `private.customer_portal_get_booking(session..., booking_public_id)` — neutral not-found och komplett detail projection.
6. `private.customer_portal_cancel_booking(session..., booking_public_id, expected_policy_version/idempotency_key)` — row lock, ägarskap, aktiv status och aktuell cutoff i en transaktion; returnerar `cancelled|already_cancelled|policy_changed|not_allowed|not_found` utan läcka. En durable booking-cancelled event/outboxrad måste följa exakt en lyckad transition.
7. `private.customer_portal_update_name(...)` och, för full design-v1, verifierad kontaktändring/conflict-lösning via challenge.
8. `private.customer_portal_create/verify_challenge(...)` — neutral response shape, cooldown/rate limits/attempt cap och stark domänseparation.
9. `private.customer_portal_revoke_session(...)`, `...revoke_other_sessions(...)`, `...revoke_booking_trusts(...)`, `...gdpr_scrub(...)`.

`public.customers` och legacy RLS lämnas orörda. Portalen ska inte exponera direkt table access eller försöka efterlikna en Supabase Auth-JWT. Service-role är bara transport till de smala RPC:erna, aldrig en ursäkt för fria `.from('bookings')`-queries.

## 5. TDD-ordning: små uppgifter och beroenden

Varje punkt bör vara en egen liten red-green-refactor-loop. Gå inte vidare vid rött test eller öppen säkerhetsfråga.

### D0 — oberoende designgrind (blockerar T1–T12)

- Kör hela `ACCEPTANCE-MATRIX.md` oberoende av byggaren; uppdatera endast evidens/status enligt paketets process.
- Krav: 0 FAIL, 0 BLOCKER och formellt godkänd ACC-C-050.
- Skapa acceptanstest/probe-skelettet från paketets exakta routes/states först efter godkänd grind; nu saknas hela acceptansmappen.

### T1 — host och brandvägg

1. Röda tester i `lib/tenant.test.ts`, nytt `lib/customer-portal/host-routing.test.ts`, middleware-kontraktstest och `scripts/domain-routes.test.mjs`:
   - `mina.corevo.se -> customer_portal`, aldrig tenant/platform.
   - portalroutes + `/api/customer-portal/**` nekas på alla andra hosts.
   - icke-portalroutes på mina fail-closed, bortsett från explicita statiska assets.
   - `mina` kan inte provisioneras som kundslug.
   - fixed-route-invariant inkluderar `mina.corevo.se`.
2. Minimal kod i `lib/tenant.ts`, ny portal host-router, `middleware.ts`, `wrangler.jsonc`, `scripts/domain-routes.mjs` och speglade reserved-var-listor.
3. Verifiera staging/preview-host explicit; ingen produktion DNS/deploy i denna uppgift.

### T2 — DB-schema och SQL-security

1. Skriv `customer_portal_security_0120_test.sql` först: inga grants, cross-tenant/customer nekas, hash-only, expiry, reuse, race/double consume, mode fail-closed, GDPR scrub.
2. Implementera migration 0120 med tabeller, backfill till `legacy_account` och minsta RPC:er.
3. Testa två samtidiga exchanges/cancels; exakt en transition får vinna.

**Beroende:** T1-kontrakt beslutat. **Grind:** DB-review av annan person än byggaren.

### T3 — länkmint, fragment-exchange och session

1. Unit-/route-tester för HMAC-domäner, key-version, expiry, cookie-attribut, rotation och neutral error shape.
2. Browsertest: GET till `/oppna/[tenantSlug]` innehåller aldrig token; JS POST:ar fragment till `/api/customer-portal/exchange`, rensar adressfältet omedelbart och navigerar med replace.
3. Browsertest: refresh/back, crawler/no-JS, använd token två gånger, fel tenantSlug, expired/revoked token, långsam/offline exchange.
4. Integrera JIT mint i befintlig booking-delivery/outbox; mode `passwordless_tenant` ger portallänk, legacy fortsätter isolerat.

**Beroende:** T2. **Grind:** logg-/analytics-inspektion visar ingen token eller kontakt-PII.

### T4 — portal-DAL, shell och bokningslistor

1. Tester för sessionsnapshot och projection: kommande, tomt, loading/error/offline/closed, historik i tre sektioner, 20-raders cursorpagination och okända statusar fail-closed.
2. Implementera `data.ts` endast via RPC; inga service-role tabellqueries.
3. Bygg shell/list/detail mekaniskt från designpaketet. Mobil/desktop brytpunkter, tokens, copy och states är exakta.

**Beroende:** T3. **Grind:** test med två tenants och två kunder i samma tenant bevisar noll sidoläcka.

### T5 — bokningsdetalj och neutral ägarskap

1. Tester: egen bokning, annat customer-id, annat tenant-id, slump-id och anonymiserad kund. De tre senare ska vara observerbart likvärdiga.
2. Projektera endast service, start/slut/duration, status, pris/valuta, personalnamn om tillåtet, location name/address och serverbyggd publik rebook-origin.
3. Rendera designens exakta detaljstates; inga interna notes, DB-id eller operativa metadata.

**Beroende:** T4.

### T6 — atomisk avbokning

1. SQL-test först: tillåten, cutoff passerad, policy ändras medan dialog är öppen, redan avbokad, dubbelklick/race, annan kund/tenant, refund/event exakt en gång.
2. Implementera en RPC-transition och tunn `actions.ts`-adapter.
3. Bygg designens dialog; klientens `canCancel` är endast presentationshint. `policy_changed` stänger/uppdaterar utan mutation.

**Beroende:** T5 och verifierat outbox/refund-kontrakt. **Grind:** inga direkta booking-updates i portal-TS.

### T7 — kalenderfil

1. Extrahera/testa `icsEscape`, UTC timestamps, CRLF/folding samt injektionsfall.
2. Authenticated GET `/api/customer-portal/bookings/[id]/calendar`; verifiera session/ägarskap via samma RPC som detaljen.
3. Innehåll endast service, start/slut, location och tenantvisningsnamn. Använd opaque/non-DB UID, `text/calendar`, attachment och `Cache-Control: no-store`.

**Beroende:** T5.

### T8 — Boka igen

1. Testa serverbyggd origin mot tillåtna aktiva tenantdomäner; inga Host-/redirect-injektioner.
2. Länka externt till `/boka`; skicka bara fortfarande giltig service/location-preselect. Utan giltig preselect landar kunden i vanlig bokning.
3. Importera inte `components/kund/RebookPanel.tsx` eller legacy `rebookBooking`.

**Beroende:** T5 och host-origin helper.

### T9 — profil, recovery och verifierad kontaktändring

1. Namnuppdatering: session/customer-bindning, validering, anonymiserad/inaktiv kund och audit.
2. Recovery/challenge: samma neutrala svar för existerande/icke-existerande kontakt, rate limit per flera dimensioner, attempt cap, expiry, replay och konflikt.
3. Kontaktbyte sker först efter verifierad challenge och atomisk customer/relation-uppdatering.

**Beroende:** T2–T4 samt krypterad gateway för verklig produktion. Att utelämna recovery/contact change betyder att resultatet inte är hela design-v1.

### T10 — säkerhet, trusted device och logout

1. Testa aktuell session, andra sessioner, booking-trusts, revoke-one/revoke-all, redan revokerad och logout med trasig/expired cookie.
2. Logout revokerar server-side och expirererar cookie; enbart cookie-delete är otillräckligt.
3. Säkerhetssidan visar endast maskad enhets-/tidinformation enligt copy; ingen fingerprinting eller full IP.

**Beroende:** T3 och T9.

### T11 — PWA manifest/install

1. Route-test först för exakt manifest: `name: Mina bokningar · Corevo`, `short_name: Mina bokningar`, `id/start_url/scope: /mina/`, `display: standalone`, neutrala ikoner och inga query/tenant/PII.
2. Portal-layout länkar endast nya manifestet. Legacy `/api/pwa/kund-manifest` och `public/kund-sw.js` lämnas isolerade.
3. Testa installation i målwebbläsare. Skapa bara vid bevisat behov en separat minimal network-only portal-worker; aldrig cache av `/mina`, exchange, kalender eller API-svar.
4. Installationssidans browserstates och iOS-copy följer paketet exakt.

**Beroende:** T4. **Grind:** cache-inspektion visar noll personligt innehåll.

### T12 — full acceptans och oberoende verifiering

1. Implementera hela acceptansspecen och `probe.js`; kör mobil + desktop, keyboard/focus, reduced motion, offline/closed, no-JS, security headers, multi-tenant och PWA.
2. Kör unit, SQL, typecheck, lint, build och acceptance.
3. Oberoende verifierare, inte byggaren, ska ge mekaniskt 0 FAIL.
4. Produktion förblir avstängd tills gateway encryption/backupredaktion och driftgrindar är verifierade.

## 6. Testkommandon att standardisera

Från `5-Kod/apps/web`:

```powershell
pnpm test -- lib/customer-portal lib/tenant.test.ts
pnpm exec vitest run scripts/domain-routes.test.mjs
pnpm typecheck
pnpm lint
pnpm build
```

SQL-tester körs med repots befintliga Supabase-testflöde mot en isolerad lokal/testdatabas, aldrig produktion. Playwright/acceptanskommandot ska låsas när acceptansmappen skapats; skriv inte ett låtsaskommando innan runner-konfigurationen finns.

## 7. Säkerhetsgrindar

| Grind | Måste vara sant innan nästa steg |
|---|---|
| G0 Design | Hela designmatrisen oberoende körd: 0 FAIL/BLOCKER |
| G1 Host | `mina` reserverad i kod/config/deploy, portalhost klassas före tenant, route/API brandvägg testad |
| G2 DB | Privata tabeller utan grants; RPC search_path/grants låsta; cross-tenant/customer/race SQL-test gröna |
| G3 Token/session | Fragment-only + POST exchange, omedelbar URL-rensning, hash-only, cookie exakt, rotation/replay/expiry gröna |
| G4 Enumeration | Neutral response/timingpraktik, rate limits och audit utan hemligheter/PII |
| G5 Mutation | Avbokningspolicy + ägarskap + transition + durable event atomiskt/idempotent |
| G6 PWA/cache | Ingen persondata i manifest/ikon/cache; personliga svar `no-store` |
| G7 Mode/legacy | Missing/unknown mode fail-closed; legacy `/konto` regressionstestad och aldrig mixad med portal-session |
| G8 Leverans | `corevo-sms` authenticated envelope encryption + backupredaktion verifierade före verklig token |
| G9 Release | Full acceptans/probe 0 FAIL och oberoende verifierare godkänner |

## 8. Minsta säkra releaseordning

1. D0 designgodkännande.
2. Host/firewall + mode utan att aktivera någon tenant.
3. Migration/RPC och serverlager med mode fortsatt `legacy_account`/`off`.
4. Exchange/session + data + UI + mutationer + recovery/security/PWA bakom `passwordless_tenant`.
5. Full acceptans på isolerad testtenant.
6. Gateway-krypteringsgrind.
7. En explicit pilottenant växlas till `passwordless_tenant`; rollback är mode tillbaka till `legacy_account`/`off`, utan att radera tabeller eller kod.
8. Gradvis tenant-för-tenant-aktivering efter audit/telemetri utan PII.

## 9. Största konkreta gap i nuläget

- Ingen `customer-portal`-kod, route, DAL, migration eller test finns.
- `mina.corevo.se` saknas i hostklassning, reserved-listor, fixed route och Cloudflare worker routes; nuvarande generiska regel riskerar att tolka `mina` som tenant.
- Ingen portal-/booking-trust-cookie eller hashad sessionmodell finns.
- Ingen POST-only fragment exchange eller atomisk consume+session RPC finns.
- Befintlig kund-DAL är legacy Supabase Auth-bunden och kan inte säkert återanvändas.
- Befintlig avbokning uppfyller inte portalens atomiska policy-/idempotenskrav.
- Platsmodellen saknar telefon/map-URL som designen kan vilja visa; detta måste hanteras som ärlig datalucka, inte improviserad copy/data.
- Legacy PWA har fel manifestkontrakt och en service worker som uttryckligen inte får återanvändas.
- Acceptansmappen med spec/probe saknas helt.

## 10. Ponytail-bedömning

Minsta lösning är **inte** att generalisera hela authstacken eller skapa ett nytt portalramverk. Skapa en smal kundportalmodul, en migration, tre publika HTTP-endpoints och de RPC:er som behövs för faktiska use cases. Extrahera bara rena helpers som redan har ett andra verkligt användningsfall (format/ICS/origin); låt legacy `/konto` leva separat tills en egen, senare migreringsgoal beslutas.
