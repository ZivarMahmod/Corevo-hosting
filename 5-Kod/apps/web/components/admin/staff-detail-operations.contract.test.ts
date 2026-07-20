import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('personkortets operativa ansvar', () => {
  it('äger bokningsbarhet, arbetstider, starttider och frånvaro via befintliga komponenter', () => {
    const detail = read('components/admin/StaffDetail.tsx')
    const required = ['<StaffBookability', '<WorkingHoursEditor', '<SlotManager', '<TimeOffManager']

    expect(required.filter((component) => !detail.includes(component))).toEqual([])
  })

  it('hämtar personens operativa schema genom befintliga dataläsningar', () => {
    const page = read('app/(admin)/admin/personal/[id]/page.tsx')
    const required = ['listWorkingHourSlots', 'listCurrentAndUpcomingStaffTimeOff']

    expect(page).toMatch(/list(?:All)?WorkingHours/)
    expect(required.filter((reader) => !page.includes(reader))).toEqual([])
  })

  it('släpper in både personaladmin och schemachef men skiljer deras kontroller', () => {
    const session = read('lib/auth/session.ts')
    const page = read('app/(admin)/admin/personal/[id]/page.tsx')
    const detail = read('components/admin/StaffDetail.tsx')

    expect(session).toContain('export async function requireAnyAdminArea')
    expect(session).toContain('areas.map((area) => hasAdminAreaPermission(area, user))')
    expect(page).toContain("requireAnyAdminArea(['personal', 'scheman'])")
    expect(page).toContain("hasAdminAreaPermission('personal', user)")
    expect(page).toContain('const canManageStaff = canAccessPersonal &&')
    expect(detail).toContain('canManageStaff ? (')
    expect(detail).toContain('const backHref = canManagePersonal')
    expect(detail).toContain("? '/admin/personal'")
  })

  it('hämtar personens globala och platsspecifika frånvaro utan att svälja databasfel', () => {
    const data = read('lib/admin/schedule-data.ts')
    const page = read('app/(admin)/admin/personal/[id]/page.tsx')

    expect(data).toContain('export async function listCurrentAndUpcomingStaffTimeOff')
    expect(data).toContain(".eq('staff_id', staffId)")
    expect(data).toContain('if (error) throw new Error(`listCurrentAndUpcomingStaffTimeOff:')
    expect(data).toContain('if (error) throw new Error(`listCurrentAndUpcomingTimeOff:')
    expect(page).toContain('listCurrentAndUpcomingStaffTimeOff(tenant.id, s.id, nowIso)')
    expect(page).not.toContain('upcomingTimeOff.filter')
  })

  it('visar tjänstens kanoniska duration på personkortet', () => {
    const page = read('app/(admin)/admin/personal/[id]/page.tsx')
    const roster = read('components/admin/StaffRoster.tsx')

    expect(page).toContain('durationMin: sv.duration_min')
    expect(roster).toMatch(/durationMin\??: number/)
    expect(roster).toContain('{svc.durationMin} min')
  })

  it('låter Scheman vara team- och platsöversikt utan personkortets redigerare', () => {
    const schedule = read('app/(admin)/admin/scheman/page.tsx')
    const operationalEditors = [
      '<StaffBookability',
      '<WorkingHoursEditor',
      '<SlotManager',
      '<TimeOffManager',
    ]

    expect(schedule).toContain('<LocationOpeningHours')
    expect(schedule).toContain('<ScheduleWeekBoard')
    expect(operationalEditors.filter((component) => schedule.includes(component))).toEqual([])
  })

  it('använder inte tenantens globala schemaåterställning från ett personkort', () => {
    const detail = read('components/admin/StaffDetail.tsx')

    expect(detail).toContain('<ScheduleLock hasBackup={false}>')
    expect(detail).not.toContain('Klipptider')
  })
})
