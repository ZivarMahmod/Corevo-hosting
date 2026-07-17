# Kundportal, PWA och kommunikation — implementationsplan

> **För agentiska byggare:** använd TDD och kör en oberoende review-grind efter varje arbetsenhet. Stegen använder checkboxar för spårning. Arbeta inte parallellt i samma migrations-, routing- eller authfiler.

**Mål:** Införa ett säkert centralt kundportal-fundament, beständig kanalneutral kommunikation, kund-PWA/Web Push och en senare inkopplingsbar SMS-kanal utan att bryta dagens bokning, `/konto`, `booking.corevo.se` eller `minbooking.corevo.se`.

**Arkitektur:** Utöka den befintliga Next.js-appen och befintliga `customers`-modellen additivt. Bokningshändelser skrivs till en Postgres-outbox, en idempotent dispatcher skapar providerförsök och befintlig e-post återanvänds. Kundportal och PWA slås på bakom flaggor; SMS-provider är sista leveransen.

**Teknik:** Next.js 15.5, React 19, TypeScript, Supabase Auth/Postgres/RLS/Cron, OpenNext på Cloudflare Workers, Vitest, Playwright, Web App Manifest, Service Worker, Web Push.

**Designkälla:** `1-Planering/12-claude-och-codex/01-CODEX-DESIGN-kundportal-kommunikation.md`  
**Sammanställning med Goal 68:** `1-Planering/12-claude-och-codex/00-SAMMANSTALLNING-goal-68-och-codex.md`

## Globala regler

- Multibransch: en motor, en DB, en kodbas; inga frisör- eller tenantforkar.
- `minbooking.corevo.se` fortsätter vara personalens host.
- Slutkundsportalens slutliga hostnamn är ett deploybeslut och representeras av `CUSTOMER_PORTAL_HOST` tills dess.
- Dagens `/konto` och bokning ska fortsätta fungera när alla nya flaggor är av.
- Ny publik bokning fortsätter genom `create_public_booking`; DB:ns konfliktspärr är auktoritativ. Ombokning ska i U0 kartläggas till befintlig säker transaktionsväg och får inte tvingas genom fel RPC.
- Bokning commitas före kommunikation. Providerfel får aldrig påverka bokningsresultatet.
- Ingen prodmutation, push eller deploy utan Zivars uttryckliga besked.
- Ingen riktig SMS-trafik före arbetsenhet 13:s go/no-go.
- Nya tabeller i exponerat schema får RLS, explicita grants och negativa tenanttester.
- Använd inte `user_metadata` för auktorisering och exponera aldrig service-role/secret key.
- Kör inte `next build` samtidigt med dev-servern.

## Beroendekedja

```text
U0 nulägesbevis
  → U1 kontrakt/flags
  → U2 kommunikationsschema/outbox
  → U3 dispatch/idempotens
  → U4 e-postmigrering
  → U5 säker kontolänkning
  → U6 portal-DAL
  → U7 central portal bakom flagga
  → U8 kund-PWA
  → U9 Web Push
  → U10 policy/fallback
  → U11 adminöversikt/export
  → U12 last/säkerhet/drift
  → U13 SMS-provider sist
```

U5–U8 kan detaljbyggas parallellt med U3–U4 först efter att U1–U2:s interfaces är låsta. U9–U11 väntar på U3. U13 väntar på allt annat.

## Planerad filkarta

### Befintliga kodytor att återanvända/ändra

- `5-Kod/apps/web/app/(kund)/konto/*` — dagens tenantbundna kundportal.
- `5-Kod/apps/web/lib/kund/*` — kundportalens befintliga DAL och actions.
- `5-Kod/apps/web/lib/auth/host-routing.ts` och `middleware.ts` — ny host först när flagga/domän är beslutad.
- `5-Kod/apps/web/lib/notifications/booking.ts`, `reminders.ts`, `email.ts`, `templates.ts`, `sms.ts` — transport flyttas bakom kommunikationsdomänen utan big-bang rewrite.
- `5-Kod/apps/web/app/api/cron/reminders/route.ts` — befintlig cron-grind; blir scheduler/dispatcher-ingång.
- `5-Kod/apps/web/lib/booking/cancel-token.ts` och `/avboka/[id]` — signerad länk återanvänds och hårdnas.
- `5-Kod/supabase/migrations/0011_customers_identity_and_schedule.sql` och senare migrationer — mönsterkälla, aldrig redigerad historik.
- `5-Kod/packages/db/types.ts` — regenereras/uppdateras efter nya migrationer.

### Nya fokuserade kodytor

- `5-Kod/apps/web/lib/communications/types.ts` — kanal-, event-, attempt- och statuskontrakt.
- `5-Kod/apps/web/lib/communications/events.ts` — skapa/enqueue domänhändelser.
- `5-Kod/apps/web/lib/communications/policy.ts` — kanalbeslut, inga provideranrop.
- `5-Kod/apps/web/lib/communications/dispatcher.ts` — claim, idempotens, providerresultat och retry.
- `5-Kod/apps/web/lib/communications/providers/email.ts` — adapter runt befintlig e-posttransport.
- `5-Kod/apps/web/lib/communications/providers/push.ts` — Web Push-adapter.
- `5-Kod/apps/web/lib/communications/providers/sms.ts` — adapter runt vald SMS-provider i sista fasen.
- `5-Kod/apps/web/lib/communications/cost.ts` — immutable kostnad/debiteringssnapshot.
- `5-Kod/apps/web/lib/customer-portal/relationships.ts` — central, `auth.uid()`-bunden relations-DAL.
- `5-Kod/apps/web/lib/customer-portal/dashboard.ts` — aggregerad tenantportalmodell.
- `5-Kod/apps/web/lib/customer-portal/preferences.ts` — företagsspecifika kanalval.
- `5-Kod/apps/web/app/api/communications/dispatch/route.ts` — skyddad batchdispatcher.
- `5-Kod/apps/web/app/api/push/subscriptions/route.ts` — skapa/återkalla egen enhetsprenumeration.
- `5-Kod/apps/web/app/api/push/click/route.ts` — signerad/auktoriserad click-observation.
- `5-Kod/apps/web/public/customer-sw.js` — kundportalens versionshanterade service worker.
- `5-Kod/apps/web/app/api/pwa/customer-manifest/route.ts` — neutralt kundmanifest.
- `5-Kod/apps/web/app/(customer-hub)/*` — central portal bakom host- och feature gate; slutlig routegrupp låses i U7.
- `5-Kod/apps/web/app/(admin)/admin/kommunikation/*` — ägarens kommunikationsöversikt.

### Nya tester

- `5-Kod/apps/web/lib/communications/*.test.ts`
- `5-Kod/apps/web/lib/customer-portal/*.test.ts`
- `5-Kod/apps/web/lib/auth/customer-host-routing.test.ts`
- `5-Kod/e2e/customer-portal.spec.ts`
- `5-Kod/e2e/customer-pwa.spec.ts`
- `5-Kod/e2e/communication-idempotency.spec.ts`
- `5-Kod/e2e/customer-tenant-isolation.spec.ts`
- `5-Kod/e2e/communication-load.spec.ts`
- `6-Testing/kundportal-pwa-enheter.md` — Zivars manuella iPhone/Android/desktop-test.

## U0 — Baseline och bevis före ändring

**Leverans:** dokumenterad verklig baseline; inga produktändringar.

- [ ] Bekräfta att Goal 67 är mekaniskt verifierad och flyttad till `klart/`; grep-verifiera därefter aktuell migrationsbaseline. Vid granskningen 2026-07-15 fanns `0067_admin_customer_rows_rpc.sql`, men numret får aldrig antas vid byggstart.
- [ ] Kör `pnpm typecheck` och `pnpm test` i `5-Kod/apps/web`; spara antal gröna tester i arbetsloggen.
- [ ] Kör dagens gästbokning lokalt och bevisa att bokning sparas även när mejlprovider saknas.
- [ ] Kör dagens `/konto` för inloggad kund och inventera exakt vilka funktioner som måste vara regressionsfria.
- [ ] Verifiera signerad avbokningslänk och lagkravets synliga avboka-knapp i konto + mejl.
- [ ] Dokumentera aktuella cronjobb, `reminded_at`, e-postmiljövariabler, `sms_enabled` och providerstatus utan att skriva ut hemligheter.
- [ ] Kontrollera aktuell Supabase changelog och officiell dokumentation för Auth/RLS/Cron samt Cloudflare Worker limits före implementering.

**Testgrind:** baselinekommandon gröna eller varje befintligt fel dokumenterat med reproduktion; inget nytt arbete får gömma ett baselinefel.

## U1 — Kontrakt, feature flags och kompatibilitet

**Leverans:** typer och flaggor som gör att alla senare delar kan byggas avstängda.

**Filer:**

- Skapa `5-Kod/apps/web/lib/communications/types.ts`
- Skapa `5-Kod/apps/web/lib/communications/types.test.ts`
- Skapa `5-Kod/apps/web/lib/customer-portal/flags.ts`
- Skapa `5-Kod/apps/web/lib/customer-portal/flags.test.ts`
- Ändra befintlig tenant-/plattformskonfiguration där feature flags idag läses

**Interfaces som låses:**

```ts
type CommunicationChannel = 'email' | 'push' | 'sms' | 'in_app'
type CommunicationEventType =
  | 'appointment.created'
  | 'appointment.rescheduled'
  | 'appointment.cancelled_by_customer'
  | 'appointment.cancelled_by_business'
  | 'appointment.reminder_due'
  | 'customer.account_linked'
  | 'loyalty.points_added'
type AttemptStatus =
  | 'created' | 'scheduled' | 'queued' | 'processing'
  | 'provider_accepted' | 'succeeded' | 'failed' | 'expired' | 'cancelled'
```

- [ ] Skriv test som bevisar att okända event-, kanal- och statusvärden avvisas.
- [ ] Implementera serialiserbara, providerneutrala typer.
- [ ] Skriv test där alla nya flaggor är av och dagens beteende returneras.
- [ ] Lägg till `customer_central_portal_enabled`, `customer_pwa_enabled`, `customer_web_push_enabled`, `customer_multi_business_hub`, `communication_ledger_enabled` och `communication_cost_dashboard_enabled`.
- [ ] Säkerställ att befintlig `sms_enabled` fortfarande är false utan explicit tenantval.
- [ ] Kör riktade tester och hela typecheck.

**Reviewgrind:** inga providerbegrepp i bokningsdomänens publika interface; avstängda flaggor ger diff-0 i dagens ytor.

## U2 — Kommunikationsledger och transaktionell outbox

**Leverans:** migrationsschema som kan ta emot ett event exakt en gång och bära flera leveransförsök.

**Filer:**

- Skapa nästa migration via projektets godkända migrationsflöde, namn `communication_ledger`
- Uppdatera `5-Kod/packages/db/types.ts`
- Skapa `5-Kod/apps/web/lib/communications/events.ts`
- Skapa `5-Kod/apps/web/lib/communications/events.test.ts`

**Tabeller:**

- `communication_events`: tenant, event_type, aggregate_type/id, occurred_at, payload, idempotency_key, status, available_at, lease, attempts, last_error.
- `communication_attempts`: event, tenant, channel, recipient fingerprint/subscription, template key/version, provider, provider_message_id, status, retry data, timestamps, error code, immutable cost snapshot.
- `customer_communication_preferences`: tenant + customer/auth user, transaktionell email/push/SMS-policy och separat marketing opt-in.
- Skapa inte `customer_accounts`/`customer_business_links` i första vågen om F1 inte bevisar att befintlig `(tenant_id, auth_user_id)`-modell saknar ett nödvändigt globalt tillstånd.

- [ ] Skriv DB-test: två inserts med samma event-idempotensnyckel ger en rad.
- [ ] Skriv DB-test: två attempts för samma event/kanal/mottagare/templateversion kan inte skapas.
- [ ] Skriv negativa RLS-test för anon, annan kund och annan tenant.
- [ ] Skriv positivt test för kundens egna preferenser och ägarens tenantöversikt.
- [ ] Implementera tabeller, index, constraints, grants och RLS.
- [ ] Implementera en transaktionssäker funktion som boknings-RPC kan anropa för att skapa event efter bokningens insert.
- [ ] Uppdatera den auktoritativa `create_public_booking`-RPC:n (eller lås en DB-trigger i U0) så att bokningsinsert och `communication_events` sker i **samma SQL-transaktion**. Bevara exakt RPC-signatur, idempotens och EXCLUDE-beteende med kontraktstest. Ett appanrop efter RPC-retur uppfyller inte kravet.
- [ ] Lägg inga providerhemligheter eller fulla meddelandekroppar i eventpayload.
- [ ] Kör advisors/säkerhetsgranskning enligt aktuell Supabase CLI/MCP innan migrationen godkänns.

**Reviewgrind:** eventet kan samexistera med dagens direktsändning men får ännu inte orsaka dubbla mejl; all cross-tenantåtkomst nekas i DB.

## U3 — Dispatcher, lease, retries och providerinterface

**Leverans:** en jobbkörning kan claim:a event, skapa idempotenta attempts och återförsöka temporära fel.

**Filer:**

- Skapa `lib/communications/policy.ts` + test
- Skapa `lib/communications/dispatcher.ts` + test
- Skapa `lib/communications/providers/provider.ts`
- Skapa `app/api/communications/dispatch/route.ts` + test

**Providerresultat:**

```ts
type ProviderResult =
  | { ok: true; providerMessageId: string | null; acceptedAt: string; rawStatus?: string }
  | { ok: false; retryable: boolean; code: string; retryAfterMs?: number }
```

- [ ] Skriv test: två dispatchers claim:ar samma event men endast en skickar.
- [ ] Skriv test: samma jobb behandlas två gånger utan nytt attempt.
- [ ] Skriv test: timeout/429/5xx retryas med gräns; 4xx mottagarfel markeras permanent.
- [ ] Skriv test: lease som övergivits kan tas över efter timeout.
- [ ] Implementera DB-claim med `FOR UPDATE SKIP LOCKED` eller motsvarande atomiskt RPC-kontrakt.
- [ ] Implementera maxförsök, backoff, dead-letter-status och strukturerad loggning utan PII.
- [ ] Skydda dispatch-route med befintligt cron secret och begränsad batchstorlek.
- [ ] Kör samtidighetstest minst 100 parallella claimförsök mot samma eventset.

**Reviewgrind:** minst-once jobbkörning resulterar i högst ett providerförsök per idempotensnyckel.

## U4 — Flytta e-post bakom ledger utan regression

**Leverans:** bokningsbekräftelse och påminnelse använder ledger/dispatcher; gamla mallar och branding består.

**Filer:**

- Skapa `lib/communications/providers/email.ts` + test
- Ändra `lib/notifications/booking.ts`
- Ändra `lib/notifications/reminders.ts`
- Ändra `app/api/cron/reminders/route.ts`
- Behåll `lib/notifications/email.ts` som låg nivå tills alla callers migrerats

- [ ] Karakteriseringstest för dagens ämne, datum/tid, tenant-branding, Reply-To, kalender- och hanteringslänk.
- [ ] Skriv test: bokning commitas när emailprovider kastar eller returnerar fel.
- [ ] Skriv test: samma bokningsbekräftelseevent kan inte mejlas två gånger.
- [ ] Adaptera befintlig `sendEmail` till `CommunicationProvider`.
- [ ] Byt bokningsbekräftelse till event enqueue bakom `communication_ledger_enabled`.
- [ ] Byt reminder cron till att skapa `appointment.reminder_due` exakt en gång per bokning/påminnelsefönster.
- [ ] Behåll gammal väg när flaggan är av; förbjud dubbelsändning när flaggan är på.
- [ ] Bevisa boka→DB-event→dispatch→provideraccepted lokalt/staging med testprovider.
- [ ] Verifiera SPF/DKIM och verkligt mejl separat före go-live.

**Reviewgrind:** e-postutfall är beständigt och bokningen är oberoende av providerstatus.

## U5 — Säker kontolänkning från bokning

**Leverans:** verifierad auth-användare kan säkert claima rätt företagsspecifika kundrad från en signerad bokningslänk.

**Filer:**

- Hårdna `lib/booking/cancel-token.ts` eller skapa separat `lib/booking/manage-token.ts`
- Skapa `lib/customer-portal/link-account.ts` + test
- Ändra kontoaktiverings-/registreringsactions
- Lägg additiv migration för tokenversion/revocation endast om befintlig HMAC inte räcker

- [ ] Testa token för bokning A mot bokning B, tenant B, ändrat payload och utgången tid: alla nekas.
- [ ] Testa återkallad token efter avbokning/kontolänkning enligt beslutad scope.
- [ ] Testa verifierad e-post som matchar exakt en kundrad: länk lyckas.
- [ ] Testa delad e-post/telefon eller konflikt mellan authlänkar: ingen automatisk merge.
- [ ] Testa att rå token inte lagras om en serverlagrad tokenmodell används.
- [ ] Implementera audit event `customer.account_linked` utan att logga token/PII.
- [ ] Bevisa att intern kundanteckning och andra tenants inte returneras efter länkning.

**Reviewgrind:** inga osäkra merges; länkningen är återspelssäker och tenantsäker.

## U6 — Central kundportal-DAL för en och flera relationer

**Leverans:** en auth-användare kan läsa sina egna företagsrelationer och en aggregerad dashboardmodell utan N+1 eller global tenantväxling.

**Filer:**

- Skapa `lib/customer-portal/relationships.ts` + test
- Skapa `lib/customer-portal/dashboard.ts` + test
- Skapa/ändra snäva DB-RPC:er i additiv migration

**Dashboardmodell:** nästa bokning, tillåtna snabbåtgärder, lojalitet, senaste historik, modulstatus, tenantbranding och senaste synktid.

- [ ] Negativt test: auth user A kan inte ange user B eller en orelaterad customer/tenant.
- [ ] Positivt test: samma auth user får två separata egna relationer hos tenant A/B.
- [ ] Testa att tenant A aldrig får veta att usern har tenant B.
- [ ] Testa aggregerad dashboard med 0, 1 och flera relationer.
- [ ] Implementera security-invoker/RPC-läsning med `auth.uid()` inuti DB, whitelistade fält och index på `(auth_user_id, tenant_id)`.
- [ ] Mät query count och svarstid; första portalvyn ska inte göra ett anrop per UI-kort.

**Reviewgrind:** RLS/RPC isolation bevisad separat från frontendfiltrering.

## U7 — Central portal bakom host- och feature gate

**Leverans:** ny central portal kan köras lokalt/staging, men befintlig `/konto` och personalhost är oförändrade när flaggan är av.

**Förkrav:** komplett Codex Design-/acceptanspaket i `4-Dokument-Underlag/01-acceptans/` med exakta skärmar, tomma/fel/offline/session-states, responsive specs samt mekaniska acceptanstester/probe. U7 får inte improvisera UI där underlag saknas.

**Filer:**

- Skapa routegrupp `app/(customer-hub)/*`
- Skapa portalens layout/start/boknings-/profil-/notisroutes
- Återanvänd komponenter från `components/kund/*`; extrahera endast gemensamma rena presentationsdelar
- Skapa `lib/auth/customer-host-routing.ts` + test
- Ändra middleware först efter hostbeslut

- [ ] Skriv host-routingtest: `minbooking.corevo.se` fortsätter till `/personal`.
- [ ] Skriv gate-test: central host av → 404/redirect enligt beslut; dagens storefront `/konto` fungerar.
- [ ] Skriv UI-test: en relation öppnas direkt utan “Mina företag”.
- [ ] Skriv UI-test: flera relationer + flagga av visar bara explicit företagskontext.
- [ ] Skriv UI-test: flagga på visar endast verifierade relationer och ingen katalog/sök.
- [ ] Bygg mobil först: nästa bokning, omboka/avboka/kontakt/kalender, lojalitet, historik, notisstatus.
- [ ] Återanvänd tenanttokens och branschterminologi; inga frisörhårdkodningar.
- [ ] Kör Playwright viewporttest för 360, 390, 768 och desktop.

**Reviewgrind:** nytt appskal men samma data/affärsregler; ingen separat tenantapp eller duplicerad bookinglogik.

## U8 — Kund-PWA utan push

**Leverans:** central portal är installerbar, versionssäker och ärlig offline.

**Filer:**

- Skapa `app/api/pwa/customer-manifest/route.ts` + test
- Skapa `public/customer-sw.js`
- Skapa PWA-registrering/installationskomponent + test
- Skapa neutrala kundikoner i `public/pwa/`

- [ ] Testa manifestnamn, scope, start URL, ikoner, theme/background och `standalone`.
- [ ] Testa att service workern aldrig cachear authresponse eller privata API-/portaldata publikt.
- [ ] Testa gammal service worker efter deploy: ny version aktiveras kontrollerat och UI kan uppdateras.
- [ ] Testa offline: appskal visas, mutationer blockeras, ingen falsk “ombokad/avbokad”.
- [ ] Visa installations-CTA först efter värdeögonblick och aldrig som automatisk browserprompt.
- [ ] Lägg plattformsspecifika instruktioner för iPhone/Android/unsupported.
- [ ] Kör Lighthouse/installability och manuellt enhetstest enligt `6-Testing/kundportal-pwa-enheter.md`.

**Reviewgrind:** PWA kan installeras utan att påverka admin-/personalmanifest eller cachea känslig data.

## U9 — Web Push subscription lifecycle och provider

**Leverans:** kund kan aktivera push efter eget klick på flera enheter; permanenta fel stänger bara en endpoint.

**Filer:**

- Additiv migration `customer_push_subscriptions`
- Skapa `app/api/push/subscriptions/route.ts` + test
- Skapa `lib/communications/providers/push.ts` + test
- Utöka `public/customer-sw.js` med push/notificationclick
- Skapa portalens notisinställningskomponent

**Subscriptionfält:** auth user/customerkoppling, endpoint, krypterade/skyddade keys, user agent/device label, status, last success/failure, failure count och revoked timestamp. Unik endpoint.

- [ ] Negativt RLS-test: användare kan inte läsa/återkalla annans endpoint.
- [ ] Testa explicit pre-prompt→användarklick→browser permission; ingen prompt på sidladdning.
- [ ] Testa unsupported, default, granted, denied, active, expired och revoked.
- [ ] Testa två enheter där endpoint A=410 men B lyckas; bara A inaktiveras.
- [ ] Testa notificationclick mot allowlistad intern portalroute; externa/omanipulerade URL:er nekas.
- [ ] Begränsa låsskärmstext till icke-känslig standardcopy.
- [ ] Dokumentera VAPID secrets server-side och rotationsplan utan att committa hemligheter.

**Reviewgrind:** systemet säger aldrig “läst” utan observerat klick och tappar inte alla enheter på ett endpointfel.

## U10 — Kanalpolicy, preferenser och fallback

**Leverans:** en central resolver väljer korrekt kanal utan att bokningskod känner till provider eller pris.

**Filer:**

- Färdigställ `lib/communications/policy.ts`
- Skapa `lib/customer-portal/preferences.ts`
- Lägg portal-/admin-UI för företagsspecifika transaktionella val och separat marketing consent

- [ ] Tabelltest för varje event × email available × push active × tenantpolicy × kundpreferens.
- [ ] Testa att bokningsbekräftelse fortfarande ger email när push finns.
- [ ] Testa att marknadsföring aldrig använder transaktionellt samtycke.
- [ ] Testa kritisk ändring utan fungerande kanal → `manual_attention`-signal, inte falsk success.
- [ ] Testa framtida SMS-fallback som policyresultat medan SMS-provider fortfarande är disabled.
- [ ] Implementera tydlig copy som skiljer kanalpreferens från leveransgaranti.

**Reviewgrind:** policy är ren och deterministisk; providers och UI implementerar beslutet men fattar det inte.

## U11 — Kommunikationsöversikt och export

**Leverans:** ägare kan granska verklig kanalaktivitet och ekonomiskt underlag för sin tenant.

**Filer:**

- Skapa `app/(admin)/admin/kommunikation/page.tsx`
- Skapa `lib/communications/analytics.ts` + test
- Skapa CSV-export-route + test
- Länka ytan från befintliga inställnings-/statistikmönster

- [ ] Negativt test: tenant A:s ägare kan inte exportera tenant B:s attempts.
- [ ] Testa periodgränser i tenantens tidszon och valuta.
- [ ] Testa statusräknare mot en deterministisk fixture.
- [ ] Testa “SMS-besparing” med dokumenterad baseline och märkning som uppskattning.
- [ ] Visa email/push/SMS separat, providerstatus utan “kunden såg”, aktiva/utgångna pushendpoints och kritiska fel.
- [ ] CSV innehåller period, kanal, typ, providerreferens, segment, faktisk kostnad och debiterat belopp men ingen onödig meddelandetext/PII.
- [ ] Gata hela ytan bakom `communication_cost_dashboard_enabled` och ägar-/adminbehörighet; kalenderpersonal nekas.

**Reviewgrind:** varje visad summa går att härleda till immutable attempts; exporten kan användas som fakturaunderlag men utger sig inte för att vara faktura.

## U12 — Säkerhet, last, observability och go-live

**Leverans:** mekaniska bevis för tenantisolering, idempotens, belastning och driftgränser.

- [ ] Playwright/integration: gästbokning→event→email→manage link→kontoaktivering→rätt portaldata.
- [ ] Negativ e2e: tenant A/B, auth user A/B, manipulerad token, annan booking/customer/subscription/export.
- [ ] Lasttest: många samtidiga bokningar, dubbla requests, ombokningar, avbokningar och dispatchers; noll tappade/dubbla bokningar/utskick.
- [ ] Providerfaults: timeout, 429, 5xx, permanent recipientfel, webhookdublett, gammal pushendpoint och databas-timeout.
- [ ] PWA: gammal SW efter deploy, offline, återanslutning, flera enheter och permission revoked.
- [ ] Mät Worker-requests per portalöppning och route; skapa varningströsklar.
- [ ] Verifiera Cloudflare Workers Paid innan FreshCut använder detta affärskritiskt.
- [ ] Verifiera cronhistorik, dispatcher backlog, dead letters och larm för kritiska kommunikationsfel.
- [ ] Kör `pnpm typecheck`, `pnpm test`, `pnpm build` med dev-server avstängd och relevanta Playwright-sviter mot staging.
- [ ] Oberoende reviewer jämför bevisen mot designens Definition of Done.

**Reviewgrind:** ingen “klart”-status utan testartefakter, stagingbevis och dokumenterad rollback/flag-off.

## U13 — SMS-provider och faktisk kostnad (sist)

**Förkrav:** U0–U12 gröna; Zivar har valt provider, avsändarnamn, prissättning och godkänt riktig testtrafik.

**Leverans:** en riktig SMS-provider kan sända valda transaktionella meddelanden, ta emot signerad statuswebhook och skapa verifierbart kostnadsunderlag.

**Filer:**

- Ersätt stub bakom `lib/communications/providers/sms.ts`; behåll providerinterface
- Skapa webhook-route + signatur-/idempotensstest
- Skapa E.164-normalisering och segmentberäkningstest
- Lägg provider-/kostnadskonfiguration server-side och per tenant

- [ ] Verifiera aktuell 46elks-dokumentation, svenskt avsändarstöd, webhookauth, statuskontrakt, segmentregler och priser före kod.
- [ ] Testa GSM-7, Unicode, långa texter och faktisk providersegmentering; UI-estimat får aldrig ersätta providerfakturan.
- [ ] Testa webhookdublett, fel provider-ID, manipulerad signatur och statusövergång bakåt.
- [ ] Testa policy: SMS skickas aldrig när tenantflagga är av eller kund saknar tillåten kanal.
- [ ] Spara faktisk kostnad och debiterat belopp som immutable snapshot. FreshCut använder cost=charged initialt.
- [ ] Skicka minsta möjliga riktiga test till Zivars godkända nummer, inte kunddata.
- [ ] Stäm av providerportal/faktura mot ledgerns segment och kostnad.
- [ ] Aktivera först för FreshCut efter separat go/no-go och med omedelbar kill switch.

**Reviewgrind:** full kedja event→policy→SMS→provider-ID→webhook→kostnad stämmer; email/push och bokning fungerar vid SMS-avbrott.

## Slutlig acceptansmatris

| Krav | Bevis |
|---|---|
| Boka utan konto | E2E + DB-rad |
| Bokning oberoende av provider | fault injection |
| Säker kontolänkning | positiva + negativa token/identitytester |
| En relation nu, flera senare | DAL-fixture + flaggtest |
| Personalhost orörd | host-routingtest |
| Tenantisolering | DB/RLS + e2e A↔B |
| E-post via ledger | event/attempt/providerfixture |
| Installerbar kund-PWA | manifest/SW/Lighthouse + enhetstest |
| Push på flera enheter | två-endpointtest + 410-hantering |
| Ärlig leveransstatus | analyticsfixture + UI-copytest |
| Idempotens | parallell dispatcher/webhook/retry |
| Kostnadsunderlag | deterministic export + provideravstämning |
| SMS sist och avstängningsbart | flagg-/kill-switchtest |
| Cloudflare redo | requestmätning + Paid-grind |
| Full regressionsgrind | typecheck, unit, build, staging e2e |

## Dokumentation och handoff efter bygge

- Teknisk arkitektur och providerinterface → `5-Kod/docs/`.
- Drift, secrets, cron/dispatcher, larm, webhook och rollback → `5-Kod/docs/ops/`.
- Zivars manuella mobil/PWA-test → `6-Testing/`.
- Varje exekverad och mekaniskt verifierad goal flyttas till `2-Byggplan/klart/06-mejl-notiser/` eller korrekt kategori; inget markeras klart enbart för att kod finns.
- ROADMAP/HANDOFF uppdateras endast med verifierat nuläge, kända gap och nästa säkra steg.

## Obligatorisk goal-uppdelning

Skapa inte ett enda jättemål. När Goal 67 är verifierat/stängt exekveras programmet enligt `03-EXEKVERINGSROADMAP-goal-68.md`, en del-goal i taget:

1. **Baseline och tekniska beslut** — U0, ingen produktkod.
2. **Kundportal-identitet och kommunikationsledger** — U1–U3.
3. **E-post och säker kontoaktivering** — U4–U6.
4. **Central kundportal bakom flagga** — U7.
5. **Kund-PWA, Web Push och kanalpolicy** — U8–U10.
6. **Kommunikationsöversikt, last och drift** — U11–U12.

**Riktig SMS-provider och kostnadsavstämning** — U13 — är en separat senare goal, endast efter Zivars uttryckliga val av provider, pris, avsändare och riktig testtrafik.

Denna ordning lämnar fungerande, testbar produkt efter varje goal och gör SMS till den sista inkopplingen precis som Zivar har beslutat.
