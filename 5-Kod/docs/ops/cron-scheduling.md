# Cron-schemaläggning

## Nuläge efter migration 0102

- Rena databas-sweeps (pending, shop-reservationer, slot-holds och retention)
  ligger i `pg_cron` via migration 0090.
- Tidskritisk reminder-produktion ligger primärt i Cloudflare Cron Triggers var
  15:e minut. `custom-worker.mjs` återanvänder OpenNexts fetch-handler och anropar
  bara den secret-gatade reminder-rutten.
- Migration 0102 lagrar ett PII-fritt heartbeat i `private`; en service-only RPC
  rapporterar stale/failure till `/api/cron/scheduler-health`.
- GitHub `cron-booking.yml` behålls under verifieringsperioden som nödräls och
  oberoende heartbeat-larm. `PRIMARY_SCHEDULER_ENABLED=true` sätts först efter en
  bevisat lyckad Cloudflare-cykel.

GitHub Actions är fortfarande best-effort och kan inaktiveras efter längre
repo-inaktivitet. Den är därför inte primär scheduler. Cloudflare-triggern är
primär; GitHub-overlap skyddar kunden och larmar på dess uteblivna heartbeat.
`CRON_SECRET` roteras samtidigt i Worker och GitHub.

Reminder-svepet kräver migration 0088. Den atomiska DB-claimen använder
`FOR UPDATE SKIP LOCKED`, unik körningstoken och en 15-minuters lease, så två
overlappande körningar inte kan skapa samma reminder samtidigt. 0100:s stabila
eventnyckel ger ytterligare idempotens i outboxen. Rutten skickar ingen provider-
trafik; den köar bara durabla events. Ett icke-200 är alltid ett driftfel.

## Cloudflare Cron Triggers — utredning

**Slutsats: IMPLEMENTERAD, inte aktiverad i produktion i denna kodrunda.** OpenNexts
custom Worker-mönster finns i `custom-worker.mjs`; `wrangler.jsonc` pekar på den
och deklarerar `*/15 * * * *`. Staging har uttryckligen tom cronlista. Workern
använder inga DO Queue/DO Tag Cache-exporter, så inga sådana behöver re-exporteras.

Deploy sker fortsatt via `scripts/deploy-prod.mjs`, aldrig bare Wrangler. Följ
aktiverings- och rollbackstegen i `first-customer-launch.md`.

Källa: [OpenNext – Custom Worker](https://opennext.js.org/cloudflare/howtos/custom-worker).
