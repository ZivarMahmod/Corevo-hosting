import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')
const MIGRATION = path.join(
  CODE_ROOT,
  'supabase',
  'migrations',
  '0078_booking_foundation_ship_hardening.sql',
)
const PERSONAL_ACTIONS = path.join(WEB_ROOT, 'lib', 'personal', 'actions.ts')

const read = (file: string) => fs.readFileSync(file, 'utf8').toLowerCase()

describe('0078 booking foundation ship hardening', () => {
  it('fences raw busy intervals to the authenticated tenant and accessible locations', () => {
    const sql = read(MIGRATION)

    expect(sql).toContain('create or replace function public.get_busy_intervals(')
    expect(sql).toContain("raise exception 'busy_intervals_forbidden'")
    expect(sql).toContain('private.can_access_location(st.location_id)')
    expect(sql).toContain('private.role_level()) < 3')
  })

  it('limits anonymous availability work by total pair count and a short window', () => {
    const sql = read(MIGRATION)

    expect(sql).toContain('cardinality(p_staff_ids) * pg_catalog.cardinality(p_starts) > 1000')
    expect(sql).toContain("v_max_start - v_min_start > interval '2 days'")
  })

  it('keeps confirmed location hours non-empty and closes direct writes', () => {
    const sql = read(MIGRATION)

    expect(sql).toContain('jsonb_array_length(p_hours) not between 1 and 28')
    expect(sql).toContain('drop policy if exists location_opening_hours_write')
    expect(sql).toContain(
      'revoke insert, update, delete on public.location_opening_hours from authenticated',
    )
  })

  it('enforces readiness and account sync even for direct staff updates', () => {
    const sql = read(MIGRATION)

    expect(sql).toContain('create or replace function private.enforce_staff_activation_readiness()')
    expect(sql).toContain('before insert or update of active')
    expect(sql).toContain('create or replace function private.sync_staff_account_status()')
    expect(sql).toContain('after insert or update of active')
  })

  it('prevents authenticated callers from re-binding customer identities', () => {
    const sql = read(MIGRATION)

    expect(sql).toContain('create or replace function private.protect_customer_auth_binding()')
    expect(sql).toContain("raise exception 'customer_auth_binding_immutable'")
    expect(sql).toContain("current_setting('request.jwt.claim.role', true)")
  })

  it('routes staff time off through narrow audited RPCs', () => {
    const sql = read(MIGRATION)
    const actions = read(PERSONAL_ACTIONS)

    expect(sql).toContain('create or replace function public.create_my_time_off(')
    expect(sql).toContain('create or replace function public.delete_my_time_off(')
    expect(sql).toContain('revoke insert, update, delete on public.time_off from authenticated')
    expect(sql).toContain("'time_off.created_by_staff'")
    expect(sql).toContain("'time_off.deleted_by_staff'")
    expect(actions).toContain("rpc('create_my_time_off'")
    expect(actions).toContain("rpc('delete_my_time_off'")
    expect(actions).not.toContain("from('time_off').insert")
  })

  it('returns the complete absence work queue without a silent 100-row cap', () => {
    const sql = read(MIGRATION)

    expect(sql).toContain('create or replace function public.preview_admin_time_off_impacts(')
    expect(sql).toContain('create or replace function public.get_admin_time_off_impacts(')
    expect(sql).not.toMatch(/get_admin_time_off_impacts[\s\S]*?limit 100;/)
    expect(sql).toContain('order by (h.resolution is not null), b.start_ts')
  })

  it('reschedules an absence booking and records its queue resolution atomically', () => {
    const sql = read(MIGRATION)

    expect(sql).toContain('create or replace function public.reschedule_admin_absence_booking(')
    expect(sql).toContain("'absence.booking_handled'")
    expect(sql).toContain("'resolution', 'rescheduled'")
    expect(sql).toContain('public.reschedule_admin_booking(')
  })
})
