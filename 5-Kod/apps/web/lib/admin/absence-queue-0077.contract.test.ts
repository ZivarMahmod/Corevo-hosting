import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')
const actions = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'calendar-actions.ts'), 'utf8')
const migration = fs.readFileSync(
  path.join(CODE_ROOT, 'supabase', 'migrations', '0077_atomic_location_admin_booking_flows.sql'),
  'utf8',
)

describe('absence impact queue 0077', () => {
  it('förhandsvisar och läser bara en smal platsfencad bokningsprojektion', () => {
    expect(migration).toContain('create or replace function public.preview_admin_time_off_impacts(')
    expect(migration).toContain('create or replace function public.get_admin_time_off_impacts(')
    expect(migration).toContain('perform private.require_location_admin(')
    expect(migration).not.toMatch(/grant\s+select\s+on\s+public\.audit_log\s+to\s+authenticated/i)
    expect(actions).toContain("rpc('preview_admin_time_off_impacts'")
    expect(actions).toContain("rpc('get_admin_time_off_impacts'")
  })

  it('loggar en validerad resolution med serverägd tenant och aktör', () => {
    expect(migration).toContain('create or replace function public.mark_admin_time_off_booking_handled(')
    expect(migration).toContain("'absence.booking_handled'")
    expect(migration).toContain("p_resolution not in ('contacted', 'rescheduled', 'cancelled', 'handled')")
    expect(migration).toContain("'time_off_id', p_time_off")
    expect(migration).toContain("'booking_id', p_booking")
    expect(actions).toContain("rpc('mark_admin_time_off_booking_handled'")
  })
})
