import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/0100_notification_event_routing.sql'),
  'utf8',
)
const outboxMigration = readFileSync(
  resolve(import.meta.dirname, '../../../../supabase/migrations/0092_durable_notifications_outbox.sql'),
  'utf8',
)

describe('0100 notification event routing', () => {
  it('is service-only, tenant-bound and locks the booking before routing', () => {
    expect(migration).toContain('create or replace function public.route_booking_notification')
    expect(migration).toContain('set search_path = \'\'')
    expect(migration).toMatch(/from public\.bookings b[\s\S]*?where b\.id = p_booking[\s\S]*?b\.tenant_id = p_tenant[\s\S]*?for (?:no key )?update/i)
    expect(migration).toContain('revoke all on function public.route_booking_notification')
    expect(migration).toContain('grant execute on function public.route_booking_notification')
    expect(migration).toContain('to service_role')
    expect(migration).not.toMatch(/to (?:anon|authenticated)/)
  })

  it('rechecks completion, current marketing consent and type opt-in in the locked transaction', () => {
    expect(migration).toContain("p_type_opt_in = 'recommendations'")
    expect(migration).toContain('v_prefs.marketing_consent')
    expect(migration).toContain('v_prefs.want_recommendations')
    expect(migration).toContain('p_expected_statuses')
    expect(migration).toContain("v_booking.status = any(p_expected_statuses)")
  })

  it('chooses only a currently available channel and records terminal skips durably', () => {
    expect(migration).toContain('from public.push_subscriptions')
    expect(migration).toContain("v_settings ->> 'sms_enabled'")
    expect(migration).toContain("v_status := 'skipped'")
    expect(migration).toContain("v_status := 'queued'")
    expect(migration).toContain('notifications_outbox_routing_unique')
  })

  it('uses an advisory transaction lock plus status CAS for idempotence and no-show races', () => {
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock')
    expect(migration).toContain("v_existing.status not in ('routing', 'skipped')")
    expect(migration).toContain("status in ('routing', 'skipped')")
    expect(migration).toContain("v_reason := 'booking_outcome_changed'")
  })

  it('preserves every U4 terminal routing code through the durable-outbox sanitizer', () => {
    for (const code of ['actor_opted_out', 'tenant_disabled', 'customer_missing']) {
      expect(outboxMigration).toContain(`'${code}'`)
    }
  })

  it('forces transactional email only for mandatory request, confirmation and cancellation', () => {
    expect(migration).toMatch(
      /p_event_type in \('booking_request_received',\s*'booking_confirmation',\s*'booking_cancelled'\)[\s\S]*?v_customer\.email is not null/,
    )
  })
})
