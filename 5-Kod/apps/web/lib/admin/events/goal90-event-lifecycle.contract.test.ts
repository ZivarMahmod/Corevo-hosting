import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationUrl = new URL(
  '../../../../../supabase/migrations/20260729105500_goal90_event_lifecycle.sql',
  import.meta.url,
)
const migration = existsSync(migrationUrl) ? readFileSync(migrationUrl, 'utf8') : ''
const scopeMigration = readFileSync(
  new URL(
    '../../../../../supabase/migrations/20260729124000_goal90_content_scope_guard.sql',
    import.meta.url,
  ),
  'utf8',
)
const reviewMigration = readFileSync(
  new URL(
    '../../../../../supabase/migrations/20260729125000_goal90_review_corrections.sql',
    import.meta.url,
  ),
  'utf8',
)
describe('Goal 90 event lifecycle contract', () => {
  it('makes onsite registration idempotent under one tenant-scoped UUID', () => {
    expect(migration).toContain('idempotency_key uuid')
    expect(migration).toContain('event_registrations_tenant_idempotency_unique')
    expect(migration).toContain('p_idempotency_key uuid')
    expect(migration).toContain('idempotency_conflict')
  })

  it('enforces tenant-matching event relations and immutable history', () => {
    expect(migration).toContain('event_registrations_event_tenant_fkey')
    expect(migration).toContain('foreign key (event_id, tenant_id)')
    expect(migration).toContain('event_registration_history_is_immutable')
    expect(migration).toContain('event_has_registration_history')
  })

  it('locks and audits event/registration transitions with a durable outbox event', () => {
    expect(migration).toContain('public.set_tenant_event_status')
    expect(migration).toContain('public.set_event_registration_status')
    expect(migration.match(/for update/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(migration).toContain('insert into public.audit_log')
    expect(migration).toContain('insert into public.notifications_outbox')
    expect(migration).toContain("'routing'")
  })

  it('requires organization scope at both SECURITY DEFINER entry points', () => {
    expect(scopeMigration).toContain('private.require_goal90_content_admin')
    expect(scopeMigration).toContain('private.has_organization_scope()')
    expect(scopeMigration).toContain("'event_status_access_denied'")
    expect(scopeMigration).toContain("'event_registration_status_access_denied'")
  })

  it('fails closed before changing any paid registration', () => {
    expect(migration).toContain('event_paid_refund_required')
    expect(migration).toContain('registration_paid_refund_required')
  })

  it('checks capacity against the new reservation and clears restored cancellation state', () => {
    expect(reviewMigration).toContain('new.reserved_qty is distinct from old.reserved_qty')
    expect(reviewMigration).toContain('coalesce(new.reserved_qty, 0)')
    expect(reviewMigration).toContain('clear_goal90_restored_registration_cancellation')
    expect(reviewMigration).toContain('new.cancelled_at := null')
    expect(reviewMigration).toContain('new.cancelled_by := null')
    expect(reviewMigration).toContain('new.cancellation_reason := null')
  })
})
