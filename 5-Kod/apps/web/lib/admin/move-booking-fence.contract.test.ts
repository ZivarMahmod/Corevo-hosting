import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO_CODE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

describe('moveBooking resursfence', () => {
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
