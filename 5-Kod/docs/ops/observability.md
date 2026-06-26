# Observability — ops-referens (goal-44 Spår A)

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

### CSP-not
Felrapporteringen körs **server-side i Workern**, där CSP `connect-src` (en
webbläsar-policy) inte gäller — så Sentry-POST:en är inte CSP-gatad idag. `next.config.ts`
har ändå en statisk `https://*.sentry.io` i `connect-src` som ofarlig framtidssäkring för
en ev. browser-side SDK. (Inte villkorad på `SENTRY_DSN` — `headers()` körs vid build,
DSN är en runtime-secret → vore tom där.)

## Bevisa att ett fel landar (deploy-gatad)
In-process-routningen + redaktionen är **test-bevisad** (`observe.test.ts`, 0 FAIL).
För att se ett fel i den LIVE Workers-strömmen:
1. Deploya (Zivar-OK) — `node scripts/deploy-prod.mjs`.
2. Provocera ett kontrollerat fel (t.ex. en åtgärd mot en raderad salong).
3. `npx wrangler tail` → se `{"level":"error","action":"...","code":"..."}`-raden.
4. Med `SENTRY_DSN` satt: bekräfta eventet i Sentry-projektet.

Tills en deploy körts: den externa Sentry-sinken är **obevisad live** — påstå inte att
den landar externt utan steg 1–4.

## drift-och-logg-sidan
Audit-feeden (`audit_log`, cross-tenant) är RIKTIG data — rör inte skrivvägen
(build-once-never-delete). Hälsoraden (4 pill: API-uptid/Workers/DB-pool/Köade SMS) är
ärligt **"— · ej kopplad"** eftersom ingen telemetri-källa finns i stacken utan ny ops.
Aldrig en fabricerad siffra (status-honesty-regeln).
