# Observability — ops-referens

Cloudflare native logs är explicit aktiverade med 100 procent sampling i
`wrangler.jsonc` för produktion och staging. Invocation logs är avstängda och
native traces är explicit avstängda, eftersom Cloudflare annars persisterar
request-URL:er innan Corevos redaktion kan köras. Motiontest-miljön är fortsatt
explicit avstängd.

Tracing är fortsatt målarkitektur, men aktiveras först när replaybara gäst- och
kundcapabilities har flyttats bort från URL:er eller en verifierad redaktion
före Cloudflares persistens finns. Ett framtida acceptansfönster börjar då på
100 procent och sänks till 5 procent efter verifiering.

Strukturerad loggning + felrapportering för plattformen. Koden bor i
`apps/web/lib/observability/index.ts` (sink) + `apps/web/lib/platform/actions/observe.ts`
(server-action-seam). **Ingen ny ops-secret krävs för att felen ska loggas** — bara
för att även skicka dem till en extern Sentry-sink.

## Vad loggas (logg-kontraktet)
Tre händelseklasser, alla som EN-rads JSON till `console.*` (= Cloudflare Workers
loggström / Logpush):

| Händelse | Nivå | Källa | Fält (PII-fria) |
|---|---|---|---|
| (a) server-action-fel | `error` | `lib/platform/actions/*` via `reportActionError` | `action`, supabase-`code`, `tenantId`/`slug`/`domain` |
| (b) auth-avslag | `warn` | `requirePlatformAdmin` via `logAuthDenied` | `userId` (uuid), `roleLevel`, `need` |
| (c) betal-fel | `error` | Stripe-webhook/rebook via `captureException` | redan wire:at sedan G10 |

**PII-regel:** vi loggar ALDRIG FormData-värden, e-post, namn, telefon, tokens eller
service-role. Server-action-felen loggar bara supabase-koden (t.ex. `23505`), aldrig
felets `message`/`details` (som kan eka ett värde). `redact()` i sinken maskar dessutom
nycklar som matchar `/(secret|token|password|api_key|authorization|service_role)/i` som
skyddsnät. Bevisat i `lib/platform/actions/observe.test.ts`.

## SENTRY_DSN (ops-gatad)
- **Tom (default):** `captureException` loggar bara till Workers-strömmen. Graceful
  degrade — kastar aldrig, blockerar aldrig åtgärden.
- **Satt:** POST:ar dessutom ett minimalt Sentry-envelope server-side (`fetch`, ingen
  Node-SDK — Workers-säkert).
- **Format:** `https://<publicKey>@<host>/<projectId>`.
- **Sätts ALDRIG i repo.** Bara som Cloudflare Worker-secret:
  ```
  npx wrangler secret put SENTRY_DSN
  ```
  (samma klass som `SUPABASE_SERVICE_ROLE_KEY`.)

Sentry-envelope behålls tills en OTLP-destination har verifierats i aktuell
Cloudflare-plan. Ingen OTLP-destination är konfigurerad av repoändringen. En ny
betald plan eller destination kräver separat kostnadsgodkännande.

### CSP-not
Felrapporteringen körs **server-side i Workern**, där CSP `connect-src` (en
webbläsar-policy) inte gäller — så Sentry-POST:en är inte CSP-gatad idag. `next.config.ts`
har ändå en statisk `https://*.sentry.io` i `connect-src` som ofarlig framtidssäkring för
en ev. browser-side SDK. (Inte villkorad på `SENTRY_DSN` — `headers()` körs vid build,
DSN är en runtime-secret → vore tom där.)

## Liveacceptans (deploy-gatad)
In-process-routningen + redaktionen är **test-bevisad** (`observe.test.ts`, 0 FAIL).
För att se ett fel i den LIVE Workers-strömmen:
1. Deploya med `node scripts/deploy-prod.mjs` från exakt godkänd `main`-SHA.
2. Verifiera strukturerade scheduler-, Supabase- och R2-händelser i Cloudflare
   Observability.
3. Provocera ett kontrollerat fel och bekräfta den strukturerade loggraden.
4. Kontrollera att inga FormData-värden, namn, e-post, telefon, tokens, secrets
   eller service-role-värden finns i loggarna.
5. Med `SENTRY_DSN` satt: bekräfta eventet i Sentry-projektet.

Tills en deploy körts: den externa Sentry-sinken är **obevisad live** — påstå inte att
den landar externt utan steg 1–5.

## drift-och-logg-sidan
Audit-feeden (`audit_log`, cross-tenant) är RIKTIG append-only-data — rör inte
skrivvägen. Hälsoraden (4 pill: API-uptid/Workers/DB-pool/Köade SMS) är
ärligt **"— · ej kopplad"** eftersom ingen telemetri-källa finns i stacken utan ny ops.
Aldrig en fabricerad siffra (status-honesty-regeln).
