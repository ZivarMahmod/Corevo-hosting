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
    expect(actions).toContain('compensateAdminStaffInvite')
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
    const page = readWeb('app/(admin)/admin/scheman/page.tsx')

    expect(card).toContain('workingDays')
    expect(card).toContain('Arbetstider')
    expect(card).toContain('workingHoursCount: workingDays')
    expect(page).toContain('workingDays={new Set(rows.map((row) => row.weekday)).size}')
  })

  it('validerar vald aktiv plats innan personal skapas eller auth-inbjudan skickas', () => {
    const actions = readWeb('lib/admin/actions.ts')
    const createStart = actions.indexOf('export async function createStaff')
    const inviteStart = actions.indexOf('export async function inviteStaff')
    const inviteAuth = actions.indexOf('inviteUserByEmail', inviteStart)

    expect(actions).toContain('async function resolveActiveStaffLocation')
    expect(actions.slice(createStart, inviteStart)).toContain("fd.get('location_id')")
    expect(actions.slice(createStart, inviteStart)).toContain('p_location: locationId')
    expect(actions.slice(inviteStart, inviteAuth)).toContain("fd.get('location_id')")
    expect(actions.slice(inviteStart, inviteAuth)).toContain('resolveActiveStaffLocation')
    expect(actions.slice(inviteStart)).toContain('p_location: locationId')
  })

  it('verifierar exakt personalrad och kompenserar invite-fel utan att radera en vinnare', () => {
    const adminActions = readWeb('lib/admin/actions.ts')
    const platformActions = readWeb('lib/platform/actions/people.ts')
    const adminStart = adminActions.indexOf('export async function inviteStaff')
    const adminEnd = adminActions.indexOf('// ── Working hours', adminStart)
    const adminInvite = adminActions.slice(adminStart, adminEnd)
    const platformStart = platformActions.indexOf('export async function inviteTenantStaff')
    const platformEnd = platformActions.indexOf('export async function updateTenantStaff', platformStart)
    const platformInvite = platformActions.slice(platformStart, platformEnd)

    expect(adminInvite.indexOf('findStaffInviteBinding')).toBeLessThan(
      adminInvite.indexOf('inviteUserByEmail'),
    )
    expect(adminInvite).toContain(".is('profile_id', null)")
    expect(adminInvite).toContain('compensateAdminStaffInvite')
    expect(adminInvite).toContain('manual_cleanup_required')
    expect(adminInvite).toContain('binding.authBoundStaffId && binding.authBoundStaffId !== staffId')

    expect(platformInvite.indexOf('findStaffInviteBinding')).toBeLessThan(
      platformInvite.indexOf('inviteUserByEmail'),
    )
    expect(platformInvite).toContain('compensatePlatformStaffInvite')
    expect(platformInvite).toContain('manual_cleanup_required')
    expect(platformInvite).toContain('binding.authBoundStaffId && binding.authBoundStaffId !== staffId')
    expect(platformInvite).toContain('if (metadataError)')
    expect(platformInvite).toContain('if (uErr)')
    expect(platformInvite).toContain('if (linkErr || !linked)')
    expect(platformInvite).toContain('if (insErr)')
  })

  it('erbjuder platsval i båda flödena för ny personal', () => {
    const roster = readWeb('components/admin/StaffRoster.tsx')
    const page = readWeb('app/(admin)/admin/personal/page.tsx')

    expect(roster).toContain('export function AddStaffButton({')
    expect(roster).toContain('defaultLocationId')
    expect(roster.match(/name="location_id"/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(page).toContain('<AddStaffButton')
    expect(page).toContain('locations={activeLocations}')
    expect(page).toContain('const defaultStaffLocationId = activeLocations.some')
    expect(page).toContain('defaultLocationId={defaultStaffLocationId}')
  })

  it('fencar tjänster till aktiva globala eller personalens plats', () => {
    const actions = readWeb('lib/admin/actions.ts')
    const start = actions.indexOf('export async function setStaffServices')
    const end = actions.indexOf('export async function inviteStaff', start)
    const section = actions.slice(start, end)

    expect(section).toContain(".select('id, location_id')")
    expect(section).toContain(".eq('active', true)")
    expect(section).toContain('location_id.is.null')
    expect(section).toContain('member.location_id')
  })

  it('visar samma prioriterade readiness på Personal och Schema', () => {
    const roster = readWeb('components/admin/StaffRoster.tsx')
    const detail = readWeb('components/admin/StaffDetail.tsx')
    const bookability = readWeb('components/admin/StaffBookability.tsx')
    const page = readWeb('app/(admin)/admin/personal/page.tsx')

    expect(page).toContain('listLocationOpeningHours')
    expect(page).toContain('listAllWorkingHours')
    expect(page).toContain('staffReadiness({')
    expect(roster).toContain('readiness: StaffReadiness')
    expect(roster).toContain('member.readiness.label')
    // Plats-väljaren + reparationsvägen bor nu på detaljsidan (drawern ersatt).
    expect(detail).toContain('locations.length > 0 && (locations.length > 1 || !member.locationId)')
    expect(roster).toContain('Välj plats innan du kopplar tjänster.')
    expect(bookability).toContain('staffReadiness({')
    expect(bookability).toContain('openingHoursConfirmed')
    expect(bookability).toContain('locationId')
    expect(bookability).toContain('Inga aktiva tjänster finns för den valda platsen')
  })
})
