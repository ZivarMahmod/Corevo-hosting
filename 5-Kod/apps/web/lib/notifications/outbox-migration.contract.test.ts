import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/0092_durable_notifications_outbox.sql',
  ),
  'utf8',
)

describe('0092 durable notification outbox migration', () => {
  it('backs every related id with a same-tenant database invariant', () => {
    expect(migration).toContain('customer_notification_prefs_customer_tenant_fkey')
    expect(migration).toContain('push_subscriptions_customer_tenant_fkey')
    expect(migration).toContain('enforce_notification_outbox_tenant_refs')
    expect(migration).toContain("raise exception 'notifications_outbox_customer_tenant_mismatch'")
    expect(migration).toContain("raise exception 'notifications_outbox_booking_tenant_mismatch'")
    expect(migration).toContain("raise exception 'notifications_outbox_staff_tenant_mismatch'")
  })

  it('owns idempotent enqueue, skip-locked claim and lease-token CAS in the database', () => {
    expect(migration).toContain('create or replace function public.enqueue_notification')
    expect(migration).toContain('notifications_outbox_delivery_unique')
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain('create or replace function public.begin_notification_delivery')
    expect(migration).toContain('create or replace function public.ack_notification_outbox')
    expect(migration).toContain('create or replace function public.retry_notification_outbox')
    expect(migration).toMatch(/lease_token\s*=\s*p_lease_token/i)
    expect(migration).toContain("status in ('routing','queued','attempting','delivery_started','sent','delivered','failed','skipped','simulated')")
    expect(migration).toContain('notifications_outbox_routing_unique')
    expect(migration).toContain('where chosen_channel is null')
    expect(migration).toContain("set status = 'delivery_started'")
    expect(migration).toContain("and lease_expires_at > now()")
    expect(migration).toContain("last_error = 'lease_expired_after_max_attempts'")
    expect(migration).toContain("case when attempt_count >= max_attempts then 'failed' else 'queued' end")
    expect(migration).toContain("p_status not in ('sent', 'delivered', 'failed', 'skipped', 'simulated')")
    expect(migration).toContain('and o.chosen_channel is not null')
    expect(migration).toContain('parts integer')
    expect(migration).toContain('p_parts integer')
    expect(migration).toContain('parts = coalesce(p_parts, parts)')
  })

  it('exposes mutation RPCs only to service_role', () => {
    expect(migration.match(/grant execute on function public\.(?:enqueue_notification|claim_notification_outbox|begin_notification_delivery|ack_notification_outbox|retry_notification_outbox|scrub_notification_outbox_customer)/g)).toHaveLength(6)
    expect(migration).toContain('from public, anon, authenticated')
  })

  it('makes GDPR scrub cancel active rows and invalidate late CAS', () => {
    expect(migration).toContain('create or replace function public.scrub_notification_outbox_customer')
    expect(migration).toContain("status = case when status in ('routing', 'queued', 'attempting', 'delivery_started') then 'skipped' else status end")
    expect(migration).toContain("skip_reason = case when status in ('routing', 'queued', 'attempting', 'delivery_started') then 'gdpr_erased' else skip_reason end")
    expect(migration).toContain('lease_token = null')
    expect(migration).toContain("payload = '{}'::jsonb")
    expect(migration).toContain('booking_id = any')
  })

  it('kan inte claima routing-rader innan kanal och samtycke har lösts', () => {
    const claim = migration.match(
      /create or replace function public\.claim_notification_outbox[\s\S]*?as \$\$([\s\S]*?)\$\$;/,
    )?.[1]
    expect(claim).toBeTruthy()
    expect(claim).toContain("o.status = 'queued'")
    expect(claim).toContain("o.status = 'attempting'")
    expect(claim).not.toContain("o.status = 'routing'")
  })

  it('sanitizes free-text outcome fields at the database boundary too', () => {
    expect(migration).toContain("new.skip_reason := 'delivery_reason'")
    expect(migration).toContain("new.last_error := 'delivery_error'")
    expect(migration).toContain('new.provider_ref := null')
  })
})
