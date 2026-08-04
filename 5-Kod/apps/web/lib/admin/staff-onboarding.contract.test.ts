import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const readCode = (relative: string) => fs.readFileSync(path.join(CODE_ROOT, relative), 'utf8')

describe('personalens bokningsbara onboarding', () => {
  it('skapar personal, tjänstekopplingar och vardagsschema atomiskt', () => {
    const migration = readCode('supabase/migrations/0073_atomic_staff_schedule_admin.sql')

    expect(migration).toContain('create or replace function public.create_staff_with_defaults')
    expect(migration).toContain('generate_series(1, 5)')
    expect(migration).toContain("time '09:00'")
    expect(migration).toContain("time '17:00'")
    expect(migration).toContain('insert into public.staff_services')
    expect(migration).toContain('create or replace function public.set_staff_active')
    expect(migration).toContain('and r.level = 3')
    expect(migration).toContain('and other_staff.active = true')
    expect(migration).toContain("set status = 'inactive'")
  })

  it('byter tjänster och återställer schemakopia i var sin DB-transaktion', () => {
    const migration = readCode('supabase/migrations/0073_atomic_staff_schedule_admin.sql')

    expect(migration).toContain('create or replace function public.replace_staff_services')
    expect(migration).toContain('create or replace function public.restore_schedule_backup')
  })
})
