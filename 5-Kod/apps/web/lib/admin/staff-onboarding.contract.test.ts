import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CODE_ROOT = path.resolve(WEB_ROOT, '..', '..')
const readWeb = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')
const readCode = (relative: string) => fs.readFileSync(path.join(CODE_ROOT, relative), 'utf8')

describe('personalens bokningsbara onboarding', () => {
  it('skapar personal, tjänstekopplingar och vardagsschema atomiskt', () => {
    const migration = readCode('supabase/migrations/0073_atomic_staff_schedule_admin.sql')
    const actions = readWeb('lib/admin/actions.ts')

    expect(migration).toContain('create or replace function public.create_staff_with_defaults')
    expect(migration).toContain('generate_series(1, 5)')
    expect(migration).toContain("time '09:00'")
    expect(migration).toContain("time '17:00'")
    expect(migration).toContain('insert into public.staff_services')
    expect(actions).toContain("rpc('create_staff_with_defaults'")
    expect(migration).toContain('create or replace function public.set_staff_active')
    expect(migration).toContain('and r.level = 3')
    expect(migration).toContain('and other_staff.active = true')
    expect(migration).toContain("set status = 'inactive'")
    expect(actions).toContain("rpc('set_staff_active'")
    expect(actions).toContain('removeInvitedStaffUser')
    expect(actions).toContain('if (metadataError)')
    expect(actions).toContain('if (linkErr || !linked)')
  })

  it('byter tjänster och återställer schemakopia i var sin DB-transaktion', () => {
    const migration = readCode('supabase/migrations/0073_atomic_staff_schedule_admin.sql')
    const actions = readWeb('lib/admin/actions.ts')
    const schedule = readWeb('lib/admin/schedule-actions.ts')

    expect(migration).toContain('create or replace function public.replace_staff_services')
    expect(migration).toContain('create or replace function public.restore_schedule_backup')
    expect(actions).toContain("rpc('replace_staff_services'")
    expect(schedule).toContain("rpc('restore_schedule_backup'")
    expect(schedule).not.toContain("from('working_hour_slots').delete()")
  })

  it('visar hela bokningsbarhetsregeln, inklusive schema', () => {
    const card = readWeb('components/admin/StaffBookability.tsx')
    const page = readWeb("app/(admin)/admin/scheman/page.tsx")

    expect(card).toContain('workingDays')
    expect(card).toContain('Schematider')
    expect(card).toContain("workingDays > 0")
    expect(page).toContain('workingDays={new Set(rows.map((row) => row.weekday)).size}')
  })
})
