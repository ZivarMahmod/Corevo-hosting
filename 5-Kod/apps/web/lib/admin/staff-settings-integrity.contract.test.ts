import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const readWeb = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('personalinställningarnas integritet', () => {
  it('skiljer bokningshistorik från personal som faktiskt kan tas bort', () => {
    const data = readWeb('lib/admin/data.ts')
    const page = readWeb('app/(admin)/admin/personal/page.tsx')
    const roster = readWeb('components/admin/StaffRoster.tsx')

    expect(data).toContain('bookings(count)')
    expect(data).toContain('includeBookingCount = false')
    expect(page).toContain('listStaff(tenant.id, { includeBookingCount: true })')
    expect(data).toContain('bookingCount: bookings?.[0]?.count ?? 0')
    expect(page).toContain('bookingCount: s.bookingCount')
    expect(roster).toContain('bookingCount: number')
    expect(roster).toContain('if (member.bookingCount > 0)')
    expect(roster).toContain('Bokningshistoriken ska bevaras')
  })

  it('visar inte ett påhittat Om-fält utan stöd i datamodellen', () => {
    const roster = readWeb('components/admin/StaffRoster.tsx')

    expect(roster).not.toContain('Ingen presentation sparad ännu')
    expect(roster).not.toContain('En bio-text per medarbetare finns inte i datamodellen')
  })

  it('skickar inte oförändrat namn eller oförändrad plats som fel', () => {
    const actions = readWeb('lib/admin/actions.ts')
    const roster = readWeb('components/admin/StaffRoster.tsx')

    expect(actions).toContain('if (Object.keys(patch).length === 0) return {}')
    expect(roster).toContain("const [name, setName] = useState(member.title ?? '')")
    expect(roster).toContain('disabled={namePending || !nameDirty}')
    expect(roster).toContain(
      "const [locationId, setLocationId] = useState(member.locationId ?? '')",
    )
    expect(roster).toContain('disabled={pending || !locationDirty}')
  })

  it('skickar alltid den valda kalenderfärgen till serveråtgärden', () => {
    const roster = readWeb('components/admin/StaffRoster.tsx')

    expect(roster).toContain('<input type="hidden" name="color" value={c} />')
    expect(roster).toContain('disabled={pending || chosen}')
  })

  it('djuplänkar till rätt person och plats utan att falla tillbaka till fel person', () => {
    const detail = readWeb('components/admin/StaffDetail.tsx')
    const schedule = readWeb('app/(admin)/admin/scheman/page.tsx')

    expect(detail).toContain('&plats=${member.locationId}')
    expect(schedule).toContain('sp.plats')
    expect(schedule).toContain('requestedTenantStaff')
    expect(schedule).toContain('!sp.plats && requestedTenantStaff?.location_id')
    expect(schedule).toContain('if (sp.staff && !requestedStaff) notFound()')
    expect(schedule).toContain('const selected = requestedStaff ?? staff[0]!')
  })
})
