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
  '0077_atomic_location_admin_booking_flows.sql',
)

const readMigration = () => fs.readFileSync(MIGRATION, 'utf8')

describe('0077 atomiska platsadminflöden', () => {
  it('utökar den enda befintliga availability-vakten med platsens regler', () => {
    const sql = readMigration()

    expect(sql).toContain('create or replace function private.assert_booking_available(')
    expect(sql).toContain('coalesce(svc.slot_step_min, st.slot_step_min, l.slot_step_min, 15)')
    expect(sql).toContain('l.min_notice_min')
    expect(sql).toContain('l.max_advance_days')
    expect(sql).toContain('public.location_opening_hours')
    expect(sql).toContain('public.location_closures')
    expect(sql).toContain('booking_outside_location_opening_hours')
    expect(sql).toContain('booking_overlaps_location_closure')
  })

  it('lägger platsstängningar i samma upptagen-readmodell och ger publiken bara bokningsbara starter', () => {
    const sql = readMigration()

    expect(sql).toContain('create or replace function public.get_busy_intervals(')
    expect(sql).toMatch(
      /from public\.location_closures lc[\s\S]*join public\.staff st[\s\S]*st\.location_id = lc\.location_id/,
    )
    expect(sql).toContain('create or replace function public.get_public_bookable_starts(')
    expect(sql).toContain('perform private.assert_booking_available(')
    expect(sql).toMatch(
      /revoke all on function public\.get_busy_intervals[\s\S]{0,250}from public, anon, authenticated, service_role;[\s\S]{0,180}to authenticated/,
    )
    expect(sql).not.toMatch(
      /grant execute on function public\.get_busy_intervals[\s\S]{0,180}to anon/,
    )
    expect(sql).toMatch(
      /grant execute on function public\.get_public_bookable_starts[\s\S]{0,220}to anon/,
    )
  })

  it('skapar eller länkar kund och bokning atomiskt inom vald plats', () => {
    const sql = readMigration()

    expect(sql).toContain('create or replace function public.create_admin_booking(')
    expect(sql).toContain('perform private.require_location_admin(v_location)')
    expect(sql).toContain('private.can_access_customer(p_customer_id)')
    expect(sql).toContain('pg_catalog.pg_advisory_xact_lock')
    expect(sql).toContain('public.create_public_booking(')
    expect(sql).toContain('insert into public.customers')
    expect(sql).toMatch(
      /update public\.bookings[\s\S]*customer_id = v_customer_id[\s\S]*status = 'confirmed'/,
    )
  })

  it('ombokar bara en aktiv bokning inom samma plats och med stale-vakt', () => {
    const sql = readMigration()

    expect(sql).toContain('create or replace function public.reschedule_admin_booking(')
    expect(sql).toContain('for update')
    expect(sql).toContain('perform private.require_location_admin(v_current_location)')
    expect(sql).toContain('p_location is distinct from v_current_location')
    expect(sql).toContain('cross_location_reschedule_forbidden')
    expect(sql).toContain('p_expected_start is distinct from v_old_start')
    expect(sql).toContain('p_expected_staff is distinct from v_old_staff')
    expect(sql).toContain('booking_changed_concurrently')
    expect(sql).toContain("'booking.rescheduled'")
    expect(sql).toContain('p_service is distinct from v_service')
    expect(sql).toContain("v_status not in ('pending', 'confirmed')")
    expect(sql).toContain('set location_id = p_location')
    expect(sql).toContain('staff_id = p_staff')
    expect(sql).toContain('start_ts = p_start')
  })

  it('serialiserar statusåtgärder och låter den befintliga FSM-vakten avgöra övergången', () => {
    const sql = readMigration()

    expect(sql).toContain('create or replace function public.set_admin_booking_status(')
    expect(sql).toContain('for update')
    expect(sql).toContain('perform private.require_location_admin(v_location)')
    expect(sql).toContain("cancelled_by = 'business'")
    expect(sql).toContain('cancelled_at = pg_catalog.statement_timestamp()')
    expect(sql).toContain('cancelled_by = null')
    expect(sql).toContain('cancelled_at = null')
    expect(sql).not.toContain('disable trigger')
  })

  it('skapar och tar bort strukturerad time_off med plats- och personalvakt', () => {
    const sql = readMigration()

    expect(sql).toContain('create or replace function public.create_admin_time_off(')
    expect(sql).toContain('create or replace function public.delete_admin_time_off(')
    expect(sql).toContain("p_kind not in ('break', 'leave', 'sick', 'other')")
    expect(sql).toContain('st.location_id = p_location')
    expect(sql).toContain('insert into public.time_off')
    expect(sql).toContain('kind, reason, series_id')
    expect(sql).toContain('delete from public.time_off')
    expect(sql).toContain("'time_off.created'")
    expect(sql).toContain("'time_off.deleted'")
  })

  it('exponerar endast de smala admin-RPC:erna för authenticated', () => {
    const sql = readMigration()

    expect(sql.match(/security definer/g)?.length).toBeGreaterThanOrEqual(5)
    expect(sql.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(5)
    expect(sql).toContain('from public, anon, authenticated, service_role')
    expect(sql).toContain('to authenticated')
    expect(sql).not.toMatch(
      /grant execute on function public\.(?:create_admin_booking|reschedule_admin_booking|set_admin_booking_status|create_admin_time_off|delete_admin_time_off)[\s\S]{0,300}to (?:anon|service_role)/,
    )
  })
})
