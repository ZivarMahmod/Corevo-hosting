import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')

describe('bokningens atomiska tillgänglighetsvakt', () => {
  it('verifierar veckodag, arbetstidsfönster, explicita starter och frånvaro i DB', () => {
    const sql = fs.readFileSync(
      path.join(CODE_ROOT, 'supabase', 'migrations', '0072_booking_availability_fence.sql'),
      'utf8',
    )

    expect(sql).toContain('create or replace function private.assert_booking_available')
    expect(sql).toContain('extract(dow from v_local_start)')
    expect(sql).toContain('public.working_hours')
    expect(sql).toContain('public.working_hour_slots')
    expect(sql).toContain('public.time_off')
    expect(sql).toContain('booking_outside_working_hours')
    expect(sql).toContain('booking_not_explicit_slot')
    expect(sql).toContain('booking_not_on_slot_step')
    expect(sql).toContain('if not v_admin then')
    expect(sql).toContain("coalesce((select auth.role()), '') = 'service_role'")
    expect(sql).toContain('booking_duration_snapshot_immutable')
    expect(sql).toContain('invalid_booking_price')
    expect(sql).toContain('invalid_booking_customer')
    expect(sql).toContain('historical_booking_schedule_read_only')
    expect(sql).toContain('coalesce(bsvc.buffer_min, bst.buffer_min, 0)')
    expect(sql).toContain('create or replace function public.get_busy_intervals')
    expect(sql).toContain('b.end_ts + make_interval(mins => coalesce(svc.buffer_min, st.buffer_min, 0))')
    expect(sql).toContain('booking_overlaps_time_off')
    expect(sql).toContain('booking_overlaps_reserved_time')
    expect(sql).toContain('coalesce(svc.slot_step_min, st.slot_step_min, 15)')
    expect(sql).toContain('coalesce(svc.buffer_min, st.buffer_min, 0)')
    expect(sql).toContain('pg_advisory_xact_lock')
    expect(sql).toContain(
      'before insert or update of tenant_id, location_id, staff_id, service_id,',
    )
    expect(sql).toContain('customer_id, customer_profile_id, start_ts, end_ts, status')
    expect(sql).toContain('create or replace function public.confirm_booking_payment')
    expect(sql).toContain(
      'grant execute on function public.confirm_booking_payment(uuid,uuid,text) to service_role',
    )
  })

  it('tillåter historiska statusändringar men vaktar aktiva resurser och FSM', () => {
    const sql = fs.readFileSync(
      path.join(CODE_ROOT, 'supabase', 'migrations', '0072_booking_availability_fence.sql'),
      'utf8',
    )

    expect(sql).toContain("if new.status in ('pending', 'confirmed') then")
    expect(sql).toContain('create or replace function private.guard_authenticated_booking_update')
    expect(sql).toContain('future_booking_cannot_be_no_show')
    expect(sql).toContain('future_booking_cannot_be_completed')
    expect(sql).toContain('historical_booking_insert_forbidden')
    expect(sql).toContain('refunded_booking_cannot_be_restored')
    expect(sql).toContain('cancellation_trace_required')
  })

  it('visar begripliga adminfel och erbjuder inte passerade tider', () => {
    const actions = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'calendar-actions.ts'), 'utf8')

    expect(actions).toContain('availabilityFenceMessage')
    expect(actions).toContain('Tiden ligger utanför medarbetarens arbetstid.')
    expect(actions).toContain('Tiden överlappar en blockering eller frånvaro.')
    expect(actions).toContain('now: new Date()')
    expect(actions).not.toContain('now: new Date(0)')
  })

  it('same-tenant-vaktar även personal och plats på frånvaro', () => {
    const sql = fs.readFileSync(
      path.join(CODE_ROOT, 'supabase', 'migrations', '0072_booking_availability_fence.sql'),
      'utf8',
    )

    expect(sql).toContain('create or replace function private.enforce_time_off_resource_fence')
    expect(sql).toContain('invalid_time_off_staff')
    expect(sql).toContain('invalid_time_off_location')
    expect(sql).toContain('create trigger trg_time_off_resource_fence')
  })

  it('ger bara adminundantaget till en admin i samma tenant', () => {
    const sql = fs.readFileSync(
      path.join(CODE_ROOT, 'supabase', 'migrations', '0075_same_tenant_booking_admin_fence.sql'),
      'utf8',
    )

    expect(sql).toContain('private.tenant_id() = p_tenant')
    expect(sql).toContain("coalesce((select auth.role()), '') = 'service_role'")
    expect(sql).toContain('coalesce((select private.role_level()), 0) >= 3')
  })
})
