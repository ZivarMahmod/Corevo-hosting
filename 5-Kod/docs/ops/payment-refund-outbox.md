# Bokningsåterbetalningar — drift

Rälsen aktiveras först när migration `0121_customer_portal_cancellation_refunds.sql`
är applicerad och Worker-secrets för Supabase service role, Stripe och `CRON_SECRET`
finns. Cloudflares primära 15-minutersscheduler anropar
`/api/cron/payment-refunds`, som kör högst fem jobb per anrop. GitHub-workflow
`cron-booking.yml` är en oberoende övervakad reserv. Stripe-webhooken startar
dessutom det exakta nya jobbet best-effort via `after()`.

## Preflight för historiska Stripe-konton

Migrationen stoppar med `legacy_succeeded_payment_account_snapshot_missing` om
en lyckad bokningsbetalning saknar sitt historiska Connect-konto. Den får aldrig
fyllas från tenantens konto idag; kontot kan ha bytts sedan betalningen gjordes.
Om första migrationsförsöket rullar tillbaka kolumnen, skapa bara den additivt i
ett godkänt underhållsfönster:

```sql
alter table public.payments
  add column if not exists stripe_connected_account_id text;

select id, tenant_id, booking_id, stripe_payment_intent_id, created_at
from public.payments
where booking_id is not null
  and status = 'succeeded'
  and stripe_connected_account_id is null;
```

Slå upp varje PaymentIntent i Stripe och dokumentera vilket Connect-konto som
faktiskt äger debiteringen. Uppdatera varje rad separat med just det bevisade
`acct_...`-värdet. Kör frågan igen och kräv noll rader före ny migration. Om
historiken inte kan bevisas: stoppa release och eskalera; gissa eller bulkfyll
aldrig. `pending`/`failed` lämnas null och binds först av ett signaturverifierat
webhook-event som också passerar tenant-/betalningsfencen. Efter preflight
validerar migrationen en permanent CHECK: en lyckad bokningsbetalning kan inte
skrivas utan account-snapshot.

Migrationen stoppar även med `legacy_payment_intent_duplicate` om samma
`(stripe_connected_account_id, stripe_payment_intent_id)` redan finns flera
gånger. Stripe Connect direct-charge-identiteten är account-scopead, därför är
detta det starkaste säkra indexet och webhookuppslagningen filtrerar på båda.
Kontrollera historiken före release:

```sql
select stripe_connected_account_id, stripe_payment_intent_id, count(*)
from public.payments
where stripe_connected_account_id is not null
  and stripe_payment_intent_id is not null
group by stripe_connected_account_id, stripe_payment_intent_id
having count(*) > 1;
```

Legacy webshop-rader utan account-snapshot omfattas avsiktligt inte av indexet
och får inte backfyllas från tenantens konto idag. De routas inte heller från ett
refund-/dispute-event förrän historiskt konto kan bevisas. Nya lyckade
webshopbetalningar sparar `event.account`, så de omfattas permanent.

## Hårda driftgrindar

- `review_required > 0`, `stuckProviderStarted > 0` eller `overduePending > 0`
  ger cron HTTP 503 och ska stoppa release. `provider_started` äldre än 15 minuter
  betraktas som osäkert; `queued`/`attempting` äldre än 60 minuter har brutit SLA.
- Ett `provider_started`-jobb får aldrig återköas automatiskt. Provideranropet kan
  ha accepterats trots timeout/5xx. Stäm av i Stripe med payment intent och den
  stabila idempotency-nyckeln innan manuell åtgärd.
- `queued`/`attempting` får retry endast innan providerstart. Max åtta försök;
  därefter `review_required`. En körning som behöver retry ger också HTTP 503:
  saknad/otillgänglig Stripe-konfiguration får aldrig ge grön primary heartbeat.
- Byt inte payment intent eller connected account på en payment-rad. Jobbet bär
  immutabla snapshots och webhooken validerar samma konto.

## Kontroll

Kör som service role:

```sql
select public.payment_refund_health();
```

För incidentanalys i Supabase SQL Editor (privilegierad operatör):

```sql
select id, tenant_id, payment_id, booking_id, status, attempt_count,
       available_at, provider_started_at, review_required_at, last_error_code
from private.payment_refund_jobs
where status in ('provider_started', 'review_required')
order by coalesce(review_required_at, provider_started_at), created_at;
```

Fälten innehåller inga kundkontakter eller kortuppgifter. Kopiera inte providerfel
till databasen; endast de slutna `last_error_code`-värdena är tillåtna.

## Avstämning

1. Sök payment intent i rätt Stripe Connect-konto från jobbets snapshots.
2. Om full refund finns: leverera/omleverera `charge.refunded`; RPC:n
   `record_payment_refund_webhook` sätter payment + jobb atomiskt till klart.
3. Om Stripe bevisar att inget provideranrop accepterades: en operatör får efter
   dokumenterad avstämning skapa ett nytt kontrollerat försök. Ändra aldrig en
   `provider_started`-rad blint.
4. Om payment är `refunded` men jobbet inte är `completed`, behandla det som
   webhook-/DB-drift och reparera genom samma record-RPC, inte direkt tabellupdate.

## Releasebevis

- Focused Vitest för migration, worker, cron och Stripe-webhook är grönt.
- SQL-testet `customer_portal_cancellation_refunds_0121_test.sql` är kört på
  isolerad reset-databas.
- En Stripe test-mode cancellation ger exakt en refund och ett omlevererat event
  ger fortfarande exakt ett slutfört jobb.
- GitHub-cron visar HTTP 200 och `payment_refund_health()` har noll review,
  fastnade provideranrop och SLA-försenade väntande jobb.
