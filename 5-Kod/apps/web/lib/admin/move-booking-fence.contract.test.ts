import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const REPO_CODE = path.resolve(WEB_ROOT, '..', '..')

describe('moveBooking resursfence', () => {
  it('validerar samma tenant, tjänst och plats innan server action skriver', () => {
    const action = fs.readFileSync(path.join(WEB_ROOT, 'lib/admin/calendar-actions.ts'), 'utf8')

    expect(action).toContain("select('start_ts, end_ts, status, service_id, location_id')")
    expect(action).toContain("from('staff')")
    expect(action).toContain("from('staff_services')")
    expect(action).toContain("from('working_hours')")
  })

  it('har en atomisk DB-vakt som även stoppar direkt PostgREST-skrivning', () => {
    const migration = fs.readFileSync(
      path.join(REPO_CODE, 'supabase/migrations/0069_booking_resource_fence.sql'),
      'utf8',
    )

    expect(migration).toContain(
      'before insert or update of tenant_id, location_id, staff_id, service_id',
    )
    expect(migration).toContain('st.tenant_id = new.tenant_id')
    expect(migration).toContain('public.staff_services')
    expect(migration).toContain('public.working_hours')
    expect(migration).toContain('public.locations')
  })
})
