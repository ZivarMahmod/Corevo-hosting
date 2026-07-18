# Första kundlanseringen — funktionell GO/NO-GO

Denna runbook gäller första enkla kundpaketet: publik sajt, bokning, kalender,
kundkort, personaldörr, kundkonto och durabla bokningsnotiser. Betalning vid
bokning, webshop och skarpt SMS ingår inte i denna release.

## Automatiska grindar

Alla måste vara gröna på samma commit/tagg:

- CI: lint, typkontroll, unit-/kontraktstester och build.
- Fresh databas 0001–0107, migrationshistorik och alla SQL-runtime/RLS-test.
- Kritisk Playwright mot isolerad staging (`E2E_ENABLED=true`).
- Cloudflare Worker under 3 MiB gzip enligt Wrangler dry-run-artifact.
- Produktionscheckpoint: historik/schema verifierad till 0107 av operatör.
- Post-deploy-smoke: alla aktiva domäner + `booking.corevo.se/login`.
- Cloudflare reminder-scheduler har lyckats minst en gång och heartbeat är frisk.
- GitHub-variabeln `PRIMARY_SCHEDULER_ENABLED=true` är satt först efter det beviset.

`cron-booking.yml` ligger kvar under verifieringsperioden. Samtidiga Cloudflare-
och GitHub-körningar producerar inte dubletter: reminder-claim använder
`FOR UPDATE SKIP LOCKED`/lease och outboxen har stabil event-idempotens. GitHub
är både nödräls och oberoende heartbeat-larm.

## Manuella grindar — aktuellt ärligt läge

| Grind | Status före operatörsbevis | Bevis som krävs |
|---|---|---|
| Supabase-plan | KLAR | Pro verifierad; dagliga backuper har 7 dagars retention enligt leverantörens planvillkor. |
| Backup restore drill | **BLOCKERAD** | Återställ senaste backup till separat branch/staging, verifiera tenantantal + bokningsantal + auth/inloggning, dokumentera UTC-tid och operatör. |
| Migrationsdrift | KLAR | Produktion numeriskt avstämd till 0107; 26/26 SQL-/RLS-tester och schemaauditen passerade 2026-07-18. |
| Juridiska texter | **BLOCKERAD** | Ägare/jurist ersätter eller godkänner alla `JURIDIK-TEXT`-platshållare, org.nr, moms och kontaktuppgifter. |
| E-postleverans | **BLOCKERAD tills bevisad** | SPF, DKIM, From/Reply-To, bounceväg och en riktig bekräftelse/påminnelse till godkänd mottagare. |
| Scheduler-larm | **BLOCKERAD tills bevisad** | Cloudflare-logg + frisk `/api/cron/scheduler-health` + röd test av watchdog i staging. |
| SMS | AV MED AVSIKT | `SMS_DELIVERY_MODE=off`; inget provider-canary utan Zivars uttryckliga beslut. |
| Betalning vid bokning | AV MED AVSIKT | Ingår inte i första kundpaketet. |
| Webshop | AV MED KODGRIND | Modul-toggle räcker inte; settlement, reservationssvep och webhooktester måste godkännas först. |
| Presentkort | AV MED KODGRIND | Får inte utfärdas eller säljas före atomisk betalning/aktivering och durabel leverans. |
| PayPal | AV MED KODGRIND | Kräver både godkänd handelsrelease och separat partner-/kontogranskning. |

Supabase Pro skapar dagliga databasbackuper, men Storage-objekt ingår inte i en
databasrestore. R2/media måste därför ha egen versions-/återställningskontroll.
Källa: [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).

## Secrets och konfiguration — namn, aldrig värden

Cloudflare Worker: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`,
`EMAIL_RELAY_URL`, `EMAIL_RELAY_SECRET`, `NOTIFICATIONS_FROM`, eventuellt
`SENTRY_DSN`. GitHub production environment: `CRON_SECRET` och befintliga
Cloudflare/Supabase deploy-secrets. GitHub-variabler:
`PROD_DB_MIGRATION=0107`, `PRIMARY_SCHEDULER_ENABLED=true` först efter respektive
bevis.

SMS-hemligheter får finnas utan att aktivera transport, men
`SMS_DELIVERY_MODE` ska vara `off`. Ingen runbookrad får innehålla ett faktiskt
secretvärde.

Handelsgrinden är fail-closed i `lib/release/commerce.ts`. För piloten ska inga
`COREVO_COMMERCE_*`, `COREVO_PAYPAL_*` eller `COREVO_BOOKING_PAYMENT_*`-releasevariabler
sättas. En framtida aktivering kräver både den exakta verifieringsetiketten i kod
och tenantens ID i respektive allowlist; befintlig modulstate, Stripe-status eller
leverantörsnyckel kan aldrig ensam öppna flödet.

## Scheduleraktivering och rollback

1. Applicera/verifiera hela migrationskedjan genom 0107 (heartbeat införs i 0102).
2. Deploya custom Workern via `scripts/deploy-prod.mjs`, aldrig bare Wrangler.
3. Vänta på en Cloudflare Cron Trigger och kontrollera Worker-logg.
4. Kör manuellt GitHub `Booking cron`; heartbeat-steget ska vara av tills första
   Cloudflare-success finns.
5. Kontrollera secret-gatat:
   `GET https://booking.corevo.se/api/cron/scheduler-health` med `CRON_SECRET`.
6. Sätt `PRIMARY_SCHEDULER_ENABLED=true`; nästa GitHub-körning måste bli grön.

Vid fel: sätt variabeln false så alarmsteget inte ger falskt releasebevis, men
behåll GitHub-remindertriggern aktiv som nödräls. Rulla tillbaka Worker-versionen
via Cloudflare. Ta inte bort migration 0102; heartbeat-tabellen är inert och
innehåller ingen PII. Skarpt SMS påverkas inte eftersom scheduler bara köar events.

## Releasebevis att spara

- commit/tagg + CI-run,
- migrationslista och checkpoint,
- Worker gzip-artifact,
- post-deploy-smoke,
- senaste Cloudflare scheduler-success + heartbeat,
- backup-restoreprotokoll,
- legal/e-post sign-off,
- kundens tenant, domäner, ägar-/personalkonton och manuella acceptansresultat.
