import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')
const migration = fs.readFileSync(
  path.join(CODE_ROOT, 'supabase', 'migrations', '0093_public_booking_integrity.sql'),
  'utf8',
)
const staffWalkInMigration = fs.readFileSync(
  path.join(CODE_ROOT, 'supabase', 'migrations', '0094_atomic_staff_walk_in.sql'),
  'utf8',
)
const notificationRoutingMigration = fs.readFileSync(
  path.join(CODE_ROOT, 'supabase', 'migrations', '0100_notification_event_routing.sql'),
  'utf8',
)
const pinBookingMigration = fs.readFileSync(
  path.join(
    CODE_ROOT,
    'supabase',
    'migrations',
    '0118_pin_booking_verification.sql',
  ),
  'utf8',
)
const finalAvailabilityFence = fs.readFileSync(
  path.join(
    CODE_ROOT,
    'supabase',
    'migrations',
    '0077_atomic_location_admin_booking_flows.sql',
  ),
  'utf8',
)
const action = fs.readFileSync(path.join(WEB_ROOT, 'app', 'boka', 'actions.ts'), 'utf8')
const reminders = fs.readFileSync(
  path.join(WEB_ROOT, 'lib', 'notifications', 'reminders.ts'),
  'utf8',
)
const adminData = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'data.ts'), 'utf8')
const kundActions = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'kund', 'actions.ts'), 'utf8')
const personalCalendar = fs.readFileSync(
  path.join(WEB_ROOT, 'lib', 'personal', 'calendar.ts'),
  'utf8',
)
const personalActions = fs.readFileSync(
  path.join(WEB_ROOT, 'lib', 'personal', 'actions.ts'),
  'utf8',
)

describe('public booking write integrity', () => {
  it('uses a storefront-only DB contract and keeps the admin contract separate', () => {
    expect(migration).toContain('create or replace function public.create_storefront_booking')
    expect(migration).toContain('perform private.assert_booking_available(')
    expect(migration).toContain('perform private.assert_storefront_booking_start(')
    expect(migration).toContain('booking_not_explicit_slot')
    expect(migration).toContain('booking_not_on_slot_step')
    expect(migration).toContain(
      'grant execute on function public.create_storefront_booking',
    )
    expect(migration).toContain('to service_role')
    expect(migration).toContain(
      'revoke all on function public.create_public_booking',
    )
    expect(migration).toContain(
      'grant execute on function public.create_public_booking',
    )
    expect(migration).toMatch(
      /grant execute on function public\.create_public_booking\([\s\S]{0,150}\) to authenticated;/,
    )
    expect(migration).not.toMatch(
      /grant execute on function public\.create_public_booking[\s\S]{0,180}to service_role/,
    )
    expect(action).toContain("'finalize_verified_storefront_booking'")
    expect(action).not.toContain("rpc('create_storefront_booking_with_release'")
    expect(pinBookingMigration).toContain(
      'create or replace function public.finalize_verified_storefront_booking',
    )
    expect(pinBookingMigration).toContain('perform private.assert_storefront_booking_start(')
    expect(pinBookingMigration).toContain(
      'grant execute on function public.finalize_verified_storefront_booking',
    )
    expect(pinBookingMigration).toContain('to service_role')
    expect(action).not.toContain("writer.rpc('create_public_booking'")
    expect(kundActions).toContain("supabase.rpc('create_public_booking'")
    expect(finalAvailabilityFence).toContain(
      'create or replace function private.assert_booking_available',
    )
    expect(finalAvailabilityFence).toContain('booking_inside_min_notice')
    expect(finalAvailabilityFence).toContain('booking_outside_advance_window')
    expect(finalAvailabilityFence).toContain('booking_outside_location_opening_hours')
    expect(finalAvailabilityFence).toContain('booking_overlaps_time_off')
    expect(finalAvailabilityFence).toContain('booking_overlaps_reserved_time')
  })

  it('stores only the customer message in bookings.note', () => {
    expect(action).toContain('p_note: sanitizeBookingNote(input.note)')
    expect(action).not.toContain('const contactNote')
    expect(action).not.toContain('`Gäst: ${name}')
  })

  it('resolves reminder recipients from the tenant-scoped customer relation', () => {
    expect(reminders).toContain('queueBookingEvent({')
    expect(notificationRoutingMigration).toContain('v_booking.customer_id')
    expect(notificationRoutingMigration).toContain('where c.id = v_booking.customer_id')
    expect(notificationRoutingMigration).toContain('and c.tenant_id = p_tenant')
    expect(reminders).not.toContain('parseGuestEmail')
    expect(reminders).not.toContain('parseGuestPhone')
  })

  it('does not put raw customer phone or legacy contact notes in calendar payloads', () => {
    expect(adminData).toContain('customers(display_name, full_name, name_hidden, phone)')
    expect(adminData).toContain('contactVisibleCustomerIds.has(b.customer_id)')
    expect(adminData).toContain('note: sanitizeBookingNote(b.note)')
    expect(personalCalendar).toContain('const safeNote = sanitizeBookingNote(r.note)')
    expect(personalCalendar).not.toContain('parseGuestName(r.note)')
  })

  it('creates named walk-ins through an atomic tenant-bound customer relation', () => {
    expect(staffWalkInMigration).toContain(
      'create or replace function public.create_staff_walk_in',
    )
    expect(staffWalkInMigration).toContain('st.profile_id = (select auth.uid())')
    expect(staffWalkInMigration).toContain(
      'insert into public.customers (tenant_id, full_name, last_seen_at)',
    )
    expect(staffWalkInMigration).toContain(
      'customer_id, start_ts, end_ts, status, price_cents, note',
    )
    expect(staffWalkInMigration).toContain(
      "v_customer, v_start, v_end, 'confirmed', v_price, null",
    )
    expect(staffWalkInMigration).toMatch(
      /grant execute on function public\.create_staff_walk_in[\s\S]{0,120}to authenticated/,
    )
    expect(personalActions).toContain("rpc('create_staff_walk_in'")
    expect(personalActions).toContain('p_name: name || undefined')
    expect(personalActions).not.toContain('`Gäst: ${name}')
    expect(personalActions).not.toContain('note = name')
  })

  it('allows only a tightly bounded staff walk-in to bypass tenant notice settings', () => {
    expect(staffWalkInMigration).toContain('private.staff_walk_in_intents')
    expect(staffWalkInMigration).toContain('pg_catalog.txid_current()')
    expect(staffWalkInMigration).toContain('v_staff_walk_in boolean')
    expect(staffWalkInMigration).toContain('if not v_staff_walk_in then')
    expect(staffWalkInMigration).toContain("interval '4 hours'")
    expect(staffWalkInMigration).toContain("interval '30 minutes'")
    expect(staffWalkInMigration).toContain("date_trunc('minute', p_start)")
    expect(staffWalkInMigration).toContain('booking_inside_min_notice')
    expect(staffWalkInMigration).toContain('booking_overlaps_time_off')
    expect(staffWalkInMigration).toContain('booking_overlaps_reserved_time')
    expect(staffWalkInMigration).not.toContain(
      'create or replace function private.assert_storefront_booking_start',
    )
  })
})
