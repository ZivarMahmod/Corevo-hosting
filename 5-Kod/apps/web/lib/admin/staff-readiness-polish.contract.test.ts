import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const readWeb = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('personalens readiness-feedback', () => {
  it('visar en osparad reservfärg som Automatisk och ger färgvalen 44 px klickyta', () => {
    const roster = readWeb('components/admin/StaffRoster.tsx')

    expect(roster).toContain("const automatic = member.color == null")
    expect(roster).toContain("{automatic ? 'Automatisk' : 'Vald färg'}")
    expect(roster).toContain('const chosen = !automatic &&')
    expect(roster).toContain('width: 44')
    expect(roster).toContain('height: 44')
  })

  it('förklarar varje readiness-vakt när aktivering stoppas', () => {
    const actions = readWeb('lib/admin/actions.ts')

    expect(actions).toContain("staff_activation_requires_confirmed_opening_hours")
    expect(actions).toContain('Bekräfta platsens öppettider')
    expect(actions).toContain("staff_activation_requires_working_hours")
    expect(actions).toContain('Lägg till arbetstider')
    expect(actions).toContain("staff_activation_requires_matching_service")
    expect(actions).toContain('Koppla minst en aktiv tjänst')
    expect(actions).toContain('staffActivationErrorMessage(error.message)')
  })

  it('lovar inte ett fast 09–17-schema efter en inbjudan', () => {
    const actions = readWeb('lib/admin/actions.ts')
    const inviteStart = actions.indexOf('export async function inviteStaff')
    const inviteSection = actions.slice(inviteStart)

    expect(inviteSection).not.toContain('vardagsschema 09–17')
    expect(inviteSection).toContain('Kontrollera tjänster, arbetstider och bokningsstatus')
  })
})
