import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const REPO_CODE = path.resolve(WEB_ROOT, '..', '..')

describe('moveBooking resursfence', () => {
  it('använder den atomiska RPC:n med förväntad gammal start och personal', () => {
    const action = fs.readFileSync(path.join(WEB_ROOT, 'lib/admin/calendar-actions.ts'), 'utf8')

    expect(action).toContain("'reschedule_admin_booking'")
    expect(action).toContain("'reschedule_admin_absence_booking'")
    expect(action).toContain('bookingRpc.rpc(rpcName')
    expect(action).toContain('p_expected_start: input.expectedStartIso')
    expect(action).toContain('p_expected_staff: input.expectedStaffId')
    expect(action).not.toContain("createAdminServiceClient")
    expect(action).not.toMatch(/from\('bookings'\)[\s\S]{0,500}\.update\(/)
  })

  it('kräver ett uttryckligt kundnotisval och bevarar även nej som durable outbox-beslut', () => {
    const action = fs.readFileSync(path.join(WEB_ROOT, 'lib/admin/calendar-actions.ts'), 'utf8')

    expect(action).toContain('notifyCustomer: boolean')
    expect(action).toContain("typeof input.notifyCustomer !== 'boolean'")
    expect(action).toContain('allow: input.notifyCustomer')
    expect(action).toContain("skipReason: input.notifyCustomer ? undefined : 'actor_opted_out'")
  })

  it('har en atomisk DB-vakt som kontrollerar samma plats, stale state och audit', () => {
    const migration = fs.readFileSync(
      path.join(REPO_CODE, 'supabase/migrations/0077_atomic_location_admin_booking_flows.sql'),
      'utf8',
    )

    expect(migration).toContain('cross_location_reschedule_forbidden')
    expect(migration).toContain('p_expected_start is distinct from v_old_start')
    expect(migration).toContain('p_expected_staff is distinct from v_old_staff')
    expect(migration).toContain("'booking.rescheduled'")
  })
})
