import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('dagvyns tredagarsdata', () => {
  it('batchar bokningar, blockeringar och scheman för föregående, aktuell och nästa dag', () => {
    const page = read('app/(admin)/admin/bokningar/page.tsx')
    const data = read('lib/admin/data.ts')

    expect(page).toContain('calendarDayTriplet(date)')
    expect(page).toContain('staffDays(tenant.id, weekdays, locationId)')
    expect(page).toContain('dayNeighbors')
    expect(data).toContain('export async function staffDays(')
    expect(data).toContain('staffDays(tenantId, [weekday], locationId)')
  })
})
