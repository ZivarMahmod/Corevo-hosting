import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/0121_customer_portal_cancellation_refunds.sql'),
  'utf8',
).toLowerCase()
const runtimeSql = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/tests/customer_portal_cancellation_refunds_0121_test.sql'),
  'utf8',
).toLowerCase()
const concurrencyShell = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/tests/customer_portal_cancellation_refunds_0121_concurrency_test.sh'),
  'utf8',
).toLowerCase()
const checkoutAction = readFileSync(
  resolve(import.meta.dirname, '../../app/boka/actions.ts'),
  'utf8',
).toLowerCase()
const shopCheckoutAction = readFileSync(
  resolve(import.meta.dirname, '../../app/butik/actions.ts'),
  'utf8',
).toLowerCase()
const webhook = readFileSync(
  resolve(import.meta.dirname, '../../app/api/stripe/webhook/route.ts'),
  'utf8',
).toLowerCase()
const cronWorkflow = readFileSync(
  resolve(import.meta.dirname, '../../../../../.github/workflows/cron-booking.yml'),
  'utf8',
).toLowerCase()

const rpcs = [
  'claim_payment_refund_jobs',
  'claim_payment_refund_job_by_id',
  'begin_payment_refund_delivery',
  'retry_payment_refund_job',
  'complete_payment_refund_job',
  'review_payment_refund_job',
  'record_payment_refund_webhook',
  'prepare_booking_checkout_payment',
  'payment_refund_health',
  'booking_payment_event_matches',
  'finalize_customer_booking_rebook',
  'compensate_customer_booking_rebook',
  'confirm_shop_order_payment',
] as const

describe('customer portal cancellation refund rail migration', () => {
  it('keeps refund jobs private, tenant-tight and one-per-payment', () => {
    expect(migration).toContain('create table private.payment_refund_jobs')
    expect(migration).toContain('foreign key (tenant_id, payment_id, booking_id)')
    expect(migration).toContain('references public.payments (tenant_id, id, booking_id)')
    expect(migration).toContain('foreign key (tenant_id, booking_id)')
    expect(migration).toContain('references public.bookings (tenant_id, id)')
    expect(migration).toContain('unique (payment_id)')
    expect(migration).toContain('unique (provider_idempotency_key)')
    expect(migration).toContain('provider_payment_intent_id text not null')
    expect(migration).toContain('provider_connected_account_id text not null')
    expect(migration).toContain('add column if not exists stripe_connected_account_id text')
    expect(migration).toContain("'refund_' || p_booking::text")
    expect(migration).not.toContain("'corevo_booking_refund_' || p_payment::text")
    expect(migration).toContain('revoke all on table private.payment_refund_jobs')
    expect(migration).not.toMatch(/grant [^;]*private\.payment_refund_jobs/)
  })

  it('exposes an SLA health gate for old queued or attempting jobs', () => {
    expect(migration).toContain("'overduepending', count(*) filter")
    expect(migration).toContain("j.status in ('queued', 'attempting')")
    expect(migration).toContain("statement_timestamp() - interval '60 minutes'")
  })

  it('fails migration preflight when a succeeded booking payment has no proven account snapshot', () => {
    expect(migration).toContain('legacy_succeeded_payment_account_snapshot_missing')
    expect(migration).toContain("p.status = 'succeeded'")
    expect(migration).toContain('p.booking_id is not null')
    expect(migration).toContain('p.stripe_connected_account_id is null')
    expect(migration).toContain('payments_succeeded_booking_account_required')
    expect(migration).toMatch(/check \([\s\S]*?booking_id is null[\s\S]*?status <> 'succeeded'[\s\S]*?stripe_connected_account_id is not null[\s\S]*?\)[\s\S]*?validate constraint payments_succeeded_booking_account_required/)
    expect(runtimeSql).toContain('refund_succeeded_snapshot_constraint_invalid')
  })

  it('fails closed on duplicate account-scoped payment intents and permanently enforces identity', () => {
    expect(migration).toContain('legacy_payment_intent_duplicate')
    expect(migration).toMatch(/group by p\.stripe_connected_account_id, p\.stripe_payment_intent_id[\s\S]*?having count\(\*\) > 1/)
    expect(migration).toContain('payments_account_payment_intent_key')
    expect(migration).toMatch(/unique index[\s\S]*?on public\.payments \(stripe_connected_account_id, stripe_payment_intent_id\)[\s\S]*?where stripe_connected_account_id is not null[\s\S]*?and stripe_payment_intent_id is not null/)
    expect(runtimeSql).toContain('refund_duplicate_payment_intent_constraint_invalid')
    const refundWebhook = migration.match(
      /create or replace function public\.record_payment_refund_webhook[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(refundWebhook).toContain('p.tenant_id = p_tenant')
    expect(refundWebhook).toContain('p.stripe_connected_account_id = p_connected_account')
    expect(refundWebhook).toContain('p.stripe_payment_intent_id = p_payment_intent')
    expect(refundWebhook).not.toContain('payment_connected_account_mismatch')
  })

  it('makes settled provider identity immutable without blocking atomic settlement or refund', () => {
    expect(migration).toContain('create trigger trg_guard_settled_payment_identity')
    expect(migration).toContain('create or replace function private.guard_settled_payment_identity')
    expect(migration).toContain("old.status in ('succeeded', 'refunded')")
    expect(migration).toContain('new.stripe_connected_account_id is distinct from old.stripe_connected_account_id')
    expect(migration).toContain('new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id')
    expect(migration).toContain("raise exception 'payment_provider_identity_immutable'")
    expect(runtimeSql).toContain('refund_settled_account_immutable_invalid')
    expect(runtimeSql).toContain('refund_settled_payment_intent_immutable_invalid')
    expect(runtimeSql).toContain('refund_settled_same_identity_refund_invalid')
  })

  it('binds a verified account to legacy pending or failed rows but never rewrites succeeded identity', () => {
    expect(migration).toContain("v_payment.status in ('pending', 'failed')")
    expect(migration).toContain('v_payment.stripe_connected_account_id is not null')
    expect(migration).toContain('stripe_connected_account_id = p_connected_account')
    expect(runtimeSql).toContain('refund_legacy_pending_account_bind_invalid')
    expect(runtimeSql).toContain('refund_legacy_failed_account_bind_invalid')
    expect(runtimeSql).toContain('refund_succeeded_snapshot_constraint_invalid')
  })

  it('finalizes customer rebooking atomically with a durable old-to-new carry map', () => {
    expect(migration).toContain('create table private.customer_booking_rebooks')
    expect(migration).toContain('create or replace function public.finalize_customer_booking_rebook')
    expect(migration).toContain("raise exception 'rebook_payment_not_settled'")
    expect(migration).toContain("raise exception 'rebook_refund_state_conflict'")
    expect(migration).toContain('update public.payments p')
    expect(migration).toContain('set booking_id = p_new_booking')
    expect(migration).toContain('insert into private.customer_booking_rebooks')
    expect(migration).toContain('create or replace function public.compensate_customer_booking_rebook')
    expect(migration).toContain("'outcome', 'preserved_finalized'")
    expect(migration).toContain("'outcome', 'compensated'")
    expect(migration).toContain("'outcome', 'not_safe'")
    expect(migration).toContain("'outcome', 'compensated_loser'")
    expect(concurrencyShell).toContain('compensated_loser')
    expect(runtimeSql).toContain('refund_rebook_before_duplicate_webhook_invalid')
    expect(runtimeSql).toContain('refund_webhook_before_rebook_invalid')
    expect(runtimeSql).toContain('refund_rebook_pending_invalid')
    expect(runtimeSql).toContain('refund_rebook_scope_invalid')
  })

  it('settles webshop payment identity atomically and gives checkout a stable provider key', () => {
    const settleOrder = migration.match(
      /create or replace function public\.confirm_shop_order_payment[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(settleOrder).toBeTruthy()
    expect(settleOrder).toContain('for update')
    expect(settleOrder).toContain("v_payment.status in ('pending', 'failed')")
    expect(settleOrder).toContain("v_payment.status = 'succeeded'")
    expect(settleOrder).toContain("raise exception 'payment_provider_identity_conflict'")
    expect(shopCheckoutAction).toContain('idempotencykey: `shop_checkout_${orderid}`')
    expect(runtimeSql).toContain('refund_shop_new_snapshot_invalid')
    expect(runtimeSql).toContain('refund_shop_exact_replay_invalid')
    expect(runtimeSql).toContain('refund_shop_second_payment_intent_invalid')
    expect(runtimeSql).toContain('refund_shop_legacy_null_fail_closed_invalid')
  })

  it('locks payment before refund job in both completion paths', () => {
    const complete = migration.match(
      /create or replace function public\.complete_payment_refund_job[\s\S]*?\n\$\$;/,
    )?.[0]
    const webhookRefund = migration.match(
      /create or replace function public\.record_payment_refund_webhook[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(complete).toBeTruthy()
    expect(webhookRefund).toBeTruthy()
    expect(complete).toContain('select p.* into v_payment')
    expect(complete).toContain('select j.* into v_job')
    expect(complete!.indexOf('select p.* into v_payment')).toBeLessThan(
      complete!.indexOf('select j.* into v_job'),
    )
    expect(webhookRefund!.indexOf('from public.payments')).toBeLessThan(
      webhookRefund!.indexOf('update private.payment_refund_jobs'),
    )
    expect(concurrencyShell).toContain('refund_completion_webhook_concurrency_invalid')
  })

  it('exposes only pinned service-role state-machine RPCs', () => {
    for (const rpc of rpcs) {
      const definition = migration.match(
        new RegExp(`create or replace function public\\.${rpc}[\\s\\S]*?\\n\\$\\$;`),
      )?.[0]
      expect(definition, rpc).toBeTruthy()
      expect(definition).toContain('security definer')
      expect(definition).toContain("set search_path = ''")
      expect(migration).toMatch(
        new RegExp(`revoke all on function public\\.${rpc}\\([\\s\\S]*?from public, anon, authenticated, service_role`),
      )
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${rpc}\\([\\s\\S]*?to service_role`),
      )
    }
    expect(migration).not.toMatch(/grant execute on function public\.(?:claim|begin|retry|complete|review|record)_payment_refund[\s\S]*?to (?:anon|authenticated)/)
  })

  it('serializes cancellation idempotency before mutation and binds conflicts to entity and customer', () => {
    const cancel = migration.match(
      /create function public\.customer_portal_cancel_booking[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(cancel).toBeTruthy()
    expect(cancel).toContain('pg_advisory_xact_lock')
    expect(cancel!.indexOf('pg_advisory_xact_lock')).toBeLessThan(cancel!.indexOf('update public.bookings'))
    expect(cancel).toContain('v_audit.entity_public_id = p_booking_public_id')
    expect(cancel).toContain('v_audit.customer_id = v_session.customer_id')
    expect(cancel).toContain("'idempotency_conflict'")
    expect(cancel).toMatch(/v_booking\.status = 'cancelled'[\s\S]*?insert into private\.customer_portal_audit/)
    expect(cancel).toContain('for update')
    expect(cancel).toContain('private.enqueue_booking_payment_refund')
    expect(cancel).toContain('insert into private.customer_portal_audit')
    expect(cancel).not.toContain('on conflict (tenant_id, event_type, idempotency_key)')
  })

  it('queues late-success refunds in the payment settlement transaction', () => {
    const settle = migration.match(
      /create or replace function public\.confirm_booking_payment[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(settle).toBeTruthy()
    expect(settle).toContain("v_booking_status = 'cancelled'")
    expect(settle).toContain("v_payment_status = 'succeeded'")
    expect(settle).toContain('private.enqueue_booking_payment_refund')
    expect(settle).toContain('p_connected_account')
    expect(settle).toContain('stripe_connected_account_id')
  })

  it('gates checkout atomically and never upserts terminal payments back to pending', () => {
    const prepare = migration.match(
      /create or replace function public\.prepare_booking_checkout_payment[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(prepare).toContain('for update')
    expect(prepare).toContain("v_booking_status <> 'pending'")
    expect(prepare).toContain('insert into public.payments')
    expect(prepare).toContain("v_existing.status = 'pending'")
    expect(prepare).toContain('v_existing.stripe_checkout_session_id = p_checkout_session')
    expect(checkoutAction).toMatch(/admin\.rpc\(\s*'prepare_booking_checkout_payment'/)
    expect(checkoutAction).not.toContain("from('payments').upsert")
    expect(checkoutAction).toContain('idempotencykey: `booking_checkout_${bookingid}`')
    expect(webhook).toContain('p_connected_account: account')
    expect(migration).toContain("raise exception 'payment_provider_identity_conflict'")
    expect(migration).toMatch(/v_payment\.status = 'succeeded'[\s\S]*?stripe_payment_intent_id is distinct from p_payment_intent/)
  })

  it('claims exact ids, terminalizes exhausted leases and blocks booking restoration', () => {
    const exactClaim = migration.match(
      /create or replace function public\.claim_payment_refund_job_by_id[\s\S]*?\n\$\$;/,
    )?.[0]
    expect(exactClaim).toContain('j.id = p_id')
    expect(exactClaim).not.toContain('claim_payment_refund_jobs(')
    expect(migration).toContain("last_error_code = 'retry_limit_reached'")
    expect(migration).toMatch(/status = 'attempting'[\s\S]*?attempt_count >= j\.max_attempts[\s\S]*?status = 'review_required'/)
    expect(migration).toContain('create trigger trg_guard_booking_refund_restoration')
    expect(migration).toContain("raise exception 'booking_refund_pending_or_completed'")
  })

  it('has executable runtime coverage for money and isolation cases', () => {
    for (const marker of [
      'refund_unpaid_invalid',
      'refund_succeeded_invalid',
      'refund_pending_late_success_invalid',
      'refund_cutoff_invalid',
      'refund_cross_tenant_invalid',
      'refund_idempotency_conflict_invalid',
      'refund_exactly_once_invalid',
      'refund_grant_invalid',
    ]) expect(runtimeSql).toContain(marker)
  })

  it('keeps a durable scheduled backup for the immediate exact-job accelerator', () => {
    expect(cronWorkflow).toContain('/api/cron/payment-refunds')
    expect(cronWorkflow).toContain('payment-refunds http $code')
  })
})
