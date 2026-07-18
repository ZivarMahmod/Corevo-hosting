# Plan 012: Durabel, enhetlig infra — pg_cron (schemaläggning) + DB-webhooks → edge functions (dispatch)

> **Executor instructions**: Follow step by step; verify each step. STOP-villkor
> gäller. Uppdatera statusraden i `plans/README.md` när klar.
>
> **Drift check**: `git diff --stat 6cdd690..HEAD -- .github/workflows/cron-booking.yml 5-Kod/apps/web/app/api/cron 5-Kod/supabase/functions`

## Status

- **Priority**: P1 (robusthet + enhetlighet — Zivars uttalade mål: inget ska riskera
  att inte funka pga extern grej; allt ska bli enhetligt)
- **Effort**: L
- **Risk**: MED (rör schemaläggning + notis-dispatch; får inte dubbelköra eller tappa utskick)
- **Depends on**: mjuk koppling till 005 (cron) + 006 (SMS)
- **Category**: tech-debt / infra
- **Planned at**: commit `6cdd690`, 2026-07-17
- **Beslut (Claudes mandat):** allt tidsbaserat → pg_cron; allt händelsebaserat →
  DB-webhook (pg_net) → edge function. EN uniform, garanterad väg. Ersätter dagens
  spridda mix (GitHub Actions cron + fire-and-forget in-app-utskick).

## Why this matters

Idag är två saker sköra och osammanhängande:
1. **Schemaläggning** kör på GitHub Actions (`cron-booking.yml`) — best-effort,
   stängs av tyst efter 60 dagars repo-inaktivitet (robusthets-fynd TID-01). Om den
   tystnar dör påminnelser + pending-expiry + (framtida) retention-svep utan larm.
2. **Notis-dispatch** är fire-and-forget i appen (`lib/notifications/*`) — om
   HTTP-anropet till mejl-/SMS-relät failar mitt i en render tappas utskicket tyst,
   ingen retry.

PRO ger `pg_cron` + `pg_net` (verifierat installerade). Rätt arkitektur: schemalägg i
DB:n (pg_cron), dispatcha via DB-webhook (pg_net → edge function). Garanterat,
retry-bart, och ENHETLIGT — samma väg för allt. send-email edge function finns redan
som mönstret att spegla.

## Current state

- Schemaläggning: `.github/workflows/cron-booking.yml` (`*/15`) → `/api/cron/pending-expiry`
  + `/api/cron/reminders`, bearer `CRON_SECRET`. Rutter i `apps/web/app/api/cron/`.
- Edge functions: `supabase/functions/send-email/index.ts` (96 rader, one.com-relä,
  auth via `x-relay-secret`). Enda edge function.
- Extensions PÅ (verifierat): `pg_cron`, `pg_net`, `pg_stat_statements`.
- Notis-sändare: `lib/notifications/{booking,reminders,email,sms}.ts` — fire-and-forget.

## Scope

**In scope**:
- Ny migration: pg_cron-schema för sweep-jobben (kalla cron-rutterna via pg_net med
  CRON_SECRET, ELLER flytta sweep-logiken till SQL-funktioner och schemalägg dem direkt).
- `supabase/functions/send-sms/` (ny edge function, 46elks — speglar send-email).
- Database Webhooks (via dashboard/migration): på `bookings` insert/paid, `shop_orders`
  paid → edge function.
- `.github/workflows/cron-booking.yml` (avveckla EFTER pg_cron bevisat kör — inte innan).
- `5-Kod/docs/ops/` (kör-kontrakt: vad kör var).

**Out of scope**:
- Att skriva om varje befintlig sändare på en gång — migrera EN kanal (t.ex.
  bokningsbekräftelse) till webhook-vägen som pilot, resten följer.
- Stripe-webhooken (funkar i Workern; rör inte).

## Steps

### Step 1: Schemalägg sweep-jobben i pg_cron (kör PARALLELLT med GH Actions först)

Ny migration: `cron.schedule(...)` för pending-expiry + reminders (var 15:e min). Två
vägar — välj EN:
- (a) pg_net POST till den befintliga cron-rutten med `Authorization: Bearer <CRON_SECRET>`
  (secret som pg-inställning/vault, ALDRIG i committad SQL), eller
- (b) flytta sweep-logiken till SQL (`expire_abandoned_pending_bookings` finns redan
  som RPC) och kalla den direkt i pg_cron — enklast, ingen HTTP.
Rekommendation: (b) för sweep-RPC:erna (ren DB), (a) för det som måste gå via appen
(t.ex. mejl-påminnelser som renderar mallar).

**Verify**: `select * from cron.job` visar jobben; kör en gång manuellt, verifiera i
`cron.job_run_details` att den lyckas. LÅT GH Actions vara kvar tills detta bevisats.

### Step 2: Bevisa + avveckla GH Actions-cronen

När pg_cron kört grönt några cykler (kolla `cron.job_run_details`), ta bort/inaktivera
`cron-booking.yml` (undvik dubbelkörning — pending-TTL/påminnelser är idempotenta men
kör inte två schemaläggare i onödan).

**Verify**: `cron.job_run_details` visar återkommande success; GH Actions-workflow borttagen.

### Step 3: send-sms edge function (46elks)

Skapa `supabase/functions/send-sms/index.ts` som speglar `send-email`: tar {to, body,
from}, POSTar till `https://api.46elks.com/a1/sms` (Basic auth, form-encoded — se plan
006), auth via delad secret. Degraderar när credentials saknas.

**Verify**: `supabase functions deploy send-sms` (operatör); testanrop returnerar ok.

### Step 4: Database Webhook → durabel dispatch (pilot: EN kanal)

Sätt upp en DB-webhook (dashboard eller `supabase_functions.http_request` via trigger)
på `bookings` insert → edge function som skickar bekräftelsen. pg_net ger retry. Detta
är den uniforma, durabla vägen (ersätter fire-and-forget för den kanalen).

**Verify**: skapa en testbokning i DEMO-tenanten (CLI) → verifiera i edge-function-loggen
att den triggades; radera testbokningen (DEMO är lekytan).

### Step 5: Dokumentera kör-kontraktet

`docs/ops/`: vad kör var (pg_cron-jobb, edge functions, webhooks), och att GH Actions
inte längre schemalägger.

## Done criteria

- [ ] pg_cron kör sweep-jobben; `cron.job_run_details` visar success
- [ ] GH Actions-cron avvecklad (efter bevis) — ingen dubbelkörning
- [ ] `send-sms` edge function finns + deployad
- [ ] En notis-kanal går via DB-webhook (durabel, retry-bar) — bevisad mot DEMO
- [ ] Kör-kontraktet dokumenterat i `docs/ops/`
- [ ] Statusrad uppdaterad i `plans/README.md`

## STOP conditions

- pg_cron kan inte nå CRON_SECRET säkert (secret skulle hamna i committad SQL) →
  använd Supabase Vault eller väg (b) (ren SQL); committa aldrig secreten.
- DB-webhook dubbeltriggar utskick som redan skickas in-app → migrera kanalen HELT
  (ta bort in-app-sändningen för den kanalen) innan webhooken slås på, annars dubbla mejl.

## Maintenance notes

- När fler kanaler migreras till webhook-vägen: EN kanal i taget, ta alltid bort
  in-app-sändningen samtidigt (annars dubbelutskick).
- Realtime: om order-status ska bli live, lägg `shop_orders` i `supabase_realtime`-
  publikationen (samma postgres_changes-modell som `bookings` redan använder — håll
  det uniformt, blanda inte in Broadcast).
- Detta är basen för "kommunikations-ledger/outbox" från Wavy-researchen — nästa steg
  är en `notifications_outbox`-tabell som webhooken läser, för full spårbarhet.
