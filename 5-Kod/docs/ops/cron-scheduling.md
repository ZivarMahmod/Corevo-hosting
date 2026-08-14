# Cron-schemaläggning

## Nuläge efter migration 0102

- Rena databas-sweeps (pending, shop-reservationer, slot-holds och retention)
  ligger i `pg_cron` via migration 0090.
- Cloudflare Cron Triggers kör var 15:e minut och anropar de secret-gatade
  rutterna för pending-expiry, reminders, notifications, payment-refunds och
  media-cleanup. `custom-worker.mjs` återanvänder OpenNexts fetch-handler.
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
eventnyckel ger ytterligare idempotens i outboxen. Reminder-rutten skickar ingen
providertrafik; den köar bara durabla events. Notifications-rutten äger
leveransdispatch för sin befintliga outbox. Refund-rutten får anropa Stripe men
inte notifications-ruttens interna leveransägare. Ett icke-200 är alltid ett
driftfel.

## Cloudflare Cron Triggers

OpenNexts custom Worker-mönster finns i `custom-worker.mjs`; `wrangler.jsonc`
pekar på den och deklarerar `*/15 * * * *`. Staging har uttryckligen tom
cronlista. Aktuell produktionstrigger ska verifieras via Cloudflare efter varje
deploy; repo-konfiguration ensam är inte livebevis.

Deploy sker fortsatt via `scripts/deploy-prod.mjs`, aldrig bare Wrangler. Följ
[deploy- och rollbackrunbooken](deploy-runbook.md), och acceptera inte en
produktionsrelease förrän scheduler, secrets, heartbeat och rollback har
återverifierats i [releaseinventeringen](../../../2-Byggplan/ROADMAP.md).

Källa: [OpenNext – Custom Worker](https://opennext.js.org/cloudflare/howtos/custom-worker).
