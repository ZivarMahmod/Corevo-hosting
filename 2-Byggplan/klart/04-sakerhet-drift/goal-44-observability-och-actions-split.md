# goal-44 — Observability live + refaktor `platform/actions.ts` (39 KB-monoliten)

> ✅ **KLART 2026-06-26** (båda spår, verifierat, i main — ej deployad än).
> - **Spår B (refaktor):** `actions.ts`-monoliten splittrad → 9 filer i `lib/platform/actions/` + ren re-export-barrel. Beteende-identisk (0 importör-diff). Commit `b461816`. tsc 0, vitest 694=694 (samma testfil), **next build OK** (bevisar att server-actions är wire:ade genom barreln), oberoende reviewer: inga fynd.
> - **Spår A (observability):** 13 oväntade server-action-fel-grenar route:ade genom ny best-effort `reportActionError` (loggar `action` + supabase-`code` + uuid/slug/domän, **aldrig PII**); `logAuthDenied` på `requirePlatformAdmin` före redirecten; statisk `https://*.sentry.io` i CSP; `SENTRY_DSN` dokumenterad ops-gatad (`.env.example` + `docs/ops/observability.md`); drift-och-logg orörd (redan ärlig). Commit `cfe186e`. tsc 0, vitest 698 (+4 sink-bevis-tester), next build OK, oberoende reviewer: inga fynd.
> - **DoD-not (ärlig):** "provocerat fel landar i sinken" är **test-bevisat in-process** (`observe.test.ts` — sinken = `console.*` = Workers-strömmen, redaktion + aldrig-kastar verifierat). Den **LIVE Workers-strömmen** (`wrangler tail`) + extern Sentry-sink kräver en **deploy + `SENTRY_DSN`-secret** → deploy-gatad, ej körd. Graceful degrade utan DSN.


Thinking: 🟡 (Spår B = REN refaktor, noll beteendeförändring — risken är tyst signatur-drift/trasig import som gates fångar. Spår A rör ops-secrets [DSN] + CSP + en riktig log-sink — risken är PII-läcka och en telemetri-väg som THROW:ar in i åtgärden den observerar. Inget schema. Två separabla spår — kör en i taget.)

**Datum:** 2026-06-17
**Typ:** Autonom goal-brief för Claude Code — körs via /goal. **Två separabla spår i EN goal.** Är det för stort i en körning → ta **Spår B (refaktor) FÖRST** (lägst risk, gör A:s diff läsbar), sedan Spår A. En goal i taget-kulturen gäller även här: markera vilket spår du kör.

## Mål
1. **Spår A — Observability LIVE (inte längre tyst):** koppla den befintliga strukturerade loggningen + felspårningen till en RIKTIG sink och BEVISA att ett provocerat server-fel landar där. Definiera exakt VAD som loggas (server-action-fel, auth-avslag, betal-fel) utan PII-läcka. Koppla `drift-och-logg`-sidans hälso-rad till en riktig källa (eller behåll ärlig "ej kopplad" om sinken inte är aktiverbar utan ops) — aldrig en fabricerad siffra.
2. **Spår B — Refaktor `lib/platform/actions.ts` (39 KB server-action-monolit):** splittra per concern (tenants / branding+status / billing / operativ-data / people+access / roller / domäner) till separata server-action-filer. **REN refaktor — beteende-identiskt, inga API-ändringar, inga signatur-ändringar, alla importer uppdaterade.**

## Lägeskoppling
Ops/drift-härdning, inte modul-nybygge. Bygger vidare på **`goal-10` (säkerhet/compliance/ops, KLART → `2-Byggplan/klart/04-sakerhet-drift/goal-10-sakerhet-compliance-ops.md`)** som la observability-grunden (G10 steg 6) men lämnade Sentry/sink **planerat-men-inaktivt**. Spår B städar den enda kvarvarande server-action-monoliten i plattformslagret (de övriga concern-filerna finns redan som syskon).

## Kontext (verifierat i koden 2026-06-17 — premissen "stub" stämmer INTE rakt av)
- **`lib/observability/index.ts` är INTE en tom stub.** Den har redan: `log(level, msg, fields)` → en-rads JSON till `console.*` (Workers-loggström/Logpush), `logger.{debug,info,warn,error}`, och `captureException(err, ctx)` som ALLTID loggar + (om `SENTRY_DSN` satt) POST:ar ett minimalt Sentry-envelope över `fetch` (Workers-säkert, ingen Node-SDK). Den har en `redact()` som maskar nycklar som matchar `/(secret|token|password|api[_-]?key|authorization|service[_-]?role)/i`. **Graceful degrade:** med `SENTRY_DSN` unset → `captureException` bara loggar, kastar aldrig.
- **Den är redan KONSUMERAD** i ~10 filer: `app/api/stripe/webhook/route.ts`, `app/avboka/actions.ts`, `lib/gdpr/erase.ts`, `lib/notifications/{booking,email,google-review,reminders,sms}.ts`, `lib/r2/upload.ts`, `lib/security/rate-limit.ts`, `lib/stripe/rebook-payment.ts`. Det **verkliga gapet** är: (a) ingen `SENTRY_DSN` satt → inget landar i en extern sink, (b) inget BEVIS att ett fel faktiskt når en sink (antaget, ej bevisat), (c) `platform/actions.ts` server-action-fel går INTE genom `captureException`, (d) `connect-src` i CSP saknar Sentry-domänen, (e) `drift-och-logg`-hälsopillren är ärligt "ej kopplad".
- **`drift-och-logg` visar redan RIKTIG audit-data** via `lib/platform/audit.ts` → `listAuditLogAllTenants()` → tabellen `audit_log` (cross-tenant RLS-bypass, append-only, build-once-never-delete). Det som ÄR platshållare är BARA hälso-raden: 4 pill (API-uptid / Workers / DB-pool / Köade SMS) renderar `"—" + "ej kopplad"` eftersom ingen telemetri-källa är wired. **Audit-feeden är alltså inte en platshållare — rör den inte annat än läsvägen.**
- **`actions.ts`-concerns (39 341 byte, alla `export async function (..., fd: FormData)` → `ActionState`/`DomainActionState`):**
  - `createTenant` (rad 54) — tenant-skapande + cascade-rollback · `savePlatformBranding` (294) · `setTenantStatus` (358, launch/suspend)
  - `saveBilling` (403) — billing-modell + avgifter
  - `saveTenantData` (460) — §2.1B operativ data-kontroll
  - `sendPasswordReset` (527) · `createTenantStaff` (561) · `createPlatformCustomer` (607) · `enterHelpMode` (662) — people/access
  - `saveRolePermissionsAction` (680) — goal-21 RBAC-matris
  - `addCustomDomain` (724) · `verifyCustomDomain` (786) · `removeCustomDomain` (836) — goal-23 domän-provisionering (egen `DomainActionState`)
  - Delade typer: `ActionState` (28), `DomainActionState` (702). Importer: `./billing`, `./service`, `./owner-role`, `./tenant-modules-write`, `./roles-permissions`, `./domains`, `@/lib/cloudflare/worker-domains`, `@corevo/ui`, `@/lib/tenant-data`, `@/lib/admin/tenant`.
- **Syskon-concern-filer finns redan** i `lib/platform/`: `tenants.ts`, `billing.ts`, `domains.ts`, `roles-permissions.ts`, `verticals.ts`, `tenant-modules-*.ts`, `people.ts`, `audit.ts` m.fl. — men dessa är read/helper-lager. `actions.ts` är **server-action-skiktet ovanpå** och är det som ska splittras. (Lägg INTE actions i de befintliga read-filerna — håll `'use server'`-skiktet separat per concern.)
- **CSP** bor i `apps/web/next.config.ts` rad 38 (`connect-src 'self' https://api.stripe.com ${supabaseUrl} https://*.supabase.co wss://*.supabase.co`) + appliceras rad 49 (`Content-Security-Policy`).
- **Gates:** per-app `apps/web/package.json` → `build: next build`, `lint: eslint .`, `typecheck: tsc --noEmit`, `test: vitest run`. Root `5-Kod/package.json` → `turbo run {build,lint,typecheck,test}`. Befintlig test: `lib/platform/actions.test.ts` (19 KB) + `audit.test.ts`.

## Berörda filer
**Spår B (refaktor):**
- `5-Kod/apps/web/lib/platform/actions.ts` — **splittras.** Behåll filen som en tunn **re-export-barrel** (`export * from './actions/...'`) ELLER ta bort den och peka om alla importörer. Re-export-barrel är säkrast (noll importör-diff) — välj det om inte Zivar bett om annat.
- `5-Kod/apps/web/lib/platform/actions/` — **NY mapp.** En fil per concern, var och en med `'use server'`:
  - `tenants.ts` (createTenant) · `branding.ts` (savePlatformBranding) · `status.ts` (setTenantStatus) · `billing.ts` (saveBilling) · `data.ts` (saveTenantData) · `people.ts` (sendPasswordReset, createTenantStaff, createPlatformCustomer, enterHelpMode) · `roles.ts` (saveRolePermissionsAction) · `domains.ts` (addCustomDomain, verifyCustomDomain, removeCustomDomain) · `shared.ts` (typerna `ActionState`/`DomainActionState` + ev. delade helpers).
  - ⚠️ namnkrock: `lib/platform/billing.ts` och `lib/platform/domains.ts` finns redan (helpers). Nya action-filerna bor i undermappen `actions/` → ingen krock. Verifiera importvägarna noga.
- `5-Kod/apps/web/lib/platform/actions.test.ts` — befintliga tester ska passera OFÖRÄNDRADE (importvägen `@/lib/platform/actions` bevaras via barrel). Lägg INTE om testerna för att "passa" splitten — det vore att flytta målstolparna.
- 11 importörer (`components/platform/*`) — **rör dem INTE** om barrel-vägen behålls. *(grep `platform/actions` före + efter för att bevisa noll importör-diff.)*

**Spår A (observability):**
- `5-Kod/apps/web/lib/observability/index.ts` — utöka VID BEHOV (sink-verifiering, ev. en `logAuthDenied`/`logPaymentError`-helper med definierad fält-form). Behåll graceful degrade + redact.
- `5-Kod/apps/web/lib/platform/actions/*` (eller `actions.ts`) — route:a server-action-fel genom `captureException` (try/catch i de actions som idag sväljer eller bara returnerar `{ error }`), utan att läcka FormData-PII.
- `5-Kod/apps/web/next.config.ts` — lägg Sentry-host i `connect-src` (rad 38) **villkorat/ofarligt** (tom om ingen DSN → ingen extra origin).
- `5-Kod/apps/web/app/(platform)/drift-och-logg/{page.tsx,DriftLog.tsx}` — koppla hälso-raden till en riktig källa OM en sådan finns utan ny ops-secret; annars LÅT den vara ärligt "ej kopplad" (dokumentera valet, fabricera aldrig).
- `5-Kod/.env.example` + ops-doc `5-Kod/docs/ops/` — dokumentera `SENTRY_DSN` (och ev. Logpush) som **ops-gatad**, tydligt markerad som "sätts i Cloudflare-secrets, inte i repo".

## Steg
**Spår B — refaktor (ta först, lägst risk):**
1. Snapshot baseline: kör `vitest run` + `tsc --noEmit` + `eslint .` i `apps/web` och NOTERA att allt är grönt FÖRE. Grep:a och spara listan över de 11 importörerna av `@/lib/platform/actions`.
2. Skapa `lib/platform/actions/` och flytta varje action **byte-identiskt** till sin concern-fil. Varje ny fil börjar med `'use server'`. Flytta `ActionState`/`DomainActionState` till `actions/shared.ts`; importera tillbaka där de behövs. Inga rad-för-rad-omskrivningar av logik — bara klipp + klistra + fixa relativa importvägar.
3. Gör `lib/platform/actions.ts` till en barrel: `export * from './actions/tenants'` osv + `export type { ActionState, DomainActionState } from './actions/shared'`. Importvägen `@/lib/platform/actions` MÅSTE fortsätta exportera EXAKT samma namn som idag.
4. Kör gates IGEN. **Diff-0 i beteende:** samma tester gröna, samma signaturer, noll importör-diff. Om en test ändrade beteende → du har refaktorerat fel, inte testat fel.

**Spår A — observability live:**
5. **Definiera logg-kontraktet i klartext** (skriv ut i koden/PR): vilka händelser loggas — (a) server-action-fel (alla `platform/actions/*` som idag bara returnerar `{ error }`), (b) auth-avslag (guard/`requirePlatformAdmin`-nekanden), (c) betal-fel (Stripe-webhook/rebook — delvis redan via `captureException`). Per händelse: nivå, meddelande, och EXAKT fält-uppsättning — **aldrig FormData-värden, e-post, namn, telefon, tokens råa**. `redact()` ska täcka, men förlita dig inte enbart på den: skicka inte PII in i `fields` från början.
6. Route:a server-action-fel genom `captureException`/`logger.error` i `platform/actions/*` (best-effort, sväljer aldrig in i åtgärden). Lägg en `logAuthDenied`-väg i guarden om den saknas.
7. **CSP:** lägg Sentry-host i `connect-src` i `next.config.ts`, byggt så att det är ofarligt utan DSN (ingen extra origin om host saknas). Verifiera att bygget + storefront-CSP inte regressar.
8. **`drift-och-logg`:** behåll audit-feeden orörd (den är redan riktig). För hälso-raden: koppla till en riktig källa om en finns utan ny secret; annars lämna ärligt "ej kopplad" och dokumentera varför.
9. **Bevisa sinken (inte anta):** provocera ett kontrollerat server-fel och visa att det LANDAR — i Workers-loggströmmen/Logpush ELLER i Sentry (med DSN satt i en test-/staging-secret). Skärmdump/loggrad som bevis (skärmdumpar → `4-Dokument-Underlag/skarmdumpar-bygg/`, ALDRIG roten).
10. **PII-testfall:** ett test som matar en action ett fel med PII-bärande context och bevisar att den loggade raden är redad/PII-fri.
11. Dokumentera `SENTRY_DSN` som ops-gatad i `.env.example` + `docs/ops/`. DSN sätts som Cloudflare-secret, aldrig i repo.

## Verifiering (klart när — mekaniskt 0 FAIL, bevisat ej antaget)
**Spår B:**
- [ ] `vitest run` grönt FÖRE och EFTER (samma testfil, oförändrad) — beteende-identiskt.
- [ ] `tsc --noEmit` = 0, `eslint .` = 0 efter splitten.
- [ ] Inga server-action-signaturer ändrade; `@/lib/platform/actions` exporterar EXAKT samma namn (grep-diff på de 11 importörerna = 0 rader ändrade).
- [ ] `actions.ts` är nu en barrel (eller borttagen + alla importörer ompekade); ingen fil > behövligt; varje ny action-fil har `'use server'`.

**Spår A:**
- [ ] Ett **provocerat** server-fel SYNS i log-sinken — bevisat med loggrad/skärmdump, inte antaget.
- [ ] `drift-och-logg` visar riktig data (audit-feeden var redan riktig; hälsoraden är antingen kopplad till riktig källa ELLER ärligt "ej kopplad" — aldrig fabricerad siffra).
- [ ] **PII-test grönt:** ett fel med PII i context loggas redat/PII-fritt (server-action-fel, auth-avslag, betal-fel — definierade, inte ad-hoc).
- [ ] CSP släpper igenom Sentry-domänen (om DSN aktiv) UTAN att regressa storefront/admin-CSP; ofarlig utan DSN.
- [ ] `SENTRY_DSN`/sink-secret dokumenterad som ops-gatad, tydligt markerad (sätts i CF-secrets, ej i repo).

**Båda / gemensamt:**
- [ ] Gröna gates: `vitest`, `tsc 0`, `lint 0`, `opennext`/`next build` ok, grep-guard ren.
- [ ] Worker-version + rollback-id noterade vid ev. deploy (deploy = Zivar-OK; ren refaktor kan pushas utan deploy enligt push-betyder-push).

## Anti-patterns
- **Spår B:** ALDRIG ändra en signatur, en retur-form eller logik "medan du ändå är där" — ren refaktor betyder ren refaktor. Splittra inte in actions i de befintliga read-helper-filerna (`lib/platform/billing.ts` etc) — håll `'use server'`-skiktet i `actions/`.
- **Spår B:** ALDRIG skriva om testerna för att passa splitten — testet är facit, inte målstolpen.
- **Spår A:** ALDRIG låta telemetri kasta in i, eller blockera, åtgärden den observerar (best-effort, swallow-internally — som dagens `captureException`).
- **Spår A:** ALDRIG logga PII (FormData-värden, e-post, namn, telefon, tokens, service-role). Lita inte BLINT på `redact()` — skicka inte in PII från början.
- **Spår A:** ALDRIG fabricera en hälso-siffra på `drift-och-logg`; ärlig "ej kopplad" slår påhittad live-siffra (status-honesty-regeln). Rör INTE audit-feedens skrivväg (build-once-never-delete).
- ALDRIG hårdkoda en DSN/secret i repo — ops-gatad, CF-secret.
- ALDRIG påstå "klart" på antagande — sinken måste BEVISAS landa ett fel (mekaniskt, inte ögonmått).

## Kopplingar
`goal-10` (säkerhet/compliance/ops, KLART — la observability-grunden) · `lib/observability/index.ts` (befintlig logg+Sentry-envelope) · `lib/platform/audit.ts` (`audit_log`, cross-tenant feed) · `app/(platform)/drift-och-logg/*` · `next.config.ts` (CSP) · `5-Kod/docs/ops/` (secret-inventering). Ingen modul/booking-koppling — detta är ops/städ-lagret.

## Rollback
Båda spåren är `git revert`-bara (ingen migration, ingen data-mutation).
- **Spår B:** revert återställer monoliten + barrel; inga importörer rörda om barrel-vägen behölls → trivial rollback.
- **Spår A:** revert tar bort sink-routing/CSP-raden; `SENTRY_DSN` unset → koden faller redan tillbaka till bara-logga (graceful degrade). Ev. CF-secret tas bort ops-sidan.
- Vid deploy: `wrangler rollback <förra-version-id>` + noterad worker-version.

## Notering — två separabla spår
Detta ÄR två oberoende leveranser. Om en körning blir för stor: leverera **Spår B (refaktor) som en egen klar enhet först** (lägst risk, gör Spår A:s diff läsbar), verifiera 0 FAIL, sedan **Spår A** som nästa enhet. En goal i taget-kulturen gäller per spår — markera vilket du kör och verifiera det innan du tar nästa.
