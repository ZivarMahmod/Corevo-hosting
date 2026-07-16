import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const publicActions = fs.readFileSync(path.join(WEB_ROOT, 'app', 'boka', 'actions.ts'), 'utf8')
const adminSlots = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'calendar-slots.ts'), 'utf8')
const locationRules = fs.readFileSync(
  path.join(WEB_ROOT, 'lib', 'booking', 'location-rules.ts'),
  'utf8',
)

describe('location-aware availability wiring', () => {
  it.each([
    ['publik', publicActions],
    ['admin', adminSlots],
  ])('%s skär personalens arbetstid mot bekräftade platsöppettider', (_name, source) => {
    expect(source).toContain('intersectWorkingWindows')
    expect(source).toContain('loadLocationAvailability')
  })

  it('den delade läsningen returnerar bara bekräftade platsöppettider', () => {
    expect(locationRules).toContain("from('location_opening_hours')")
    expect(locationRules).toContain(".not('confirmed_at', 'is', null)")
  })

  it.each([
    ['publik', publicActions],
    ['admin', adminSlots],
  ])('%s använder service, personal, plats och sist 15 minuter', (_name, source) => {
    expect(source).toMatch(
      /service\.slot_step_min\s*\?\?\s*stepByStaff\.get\([^)]*\)\s*\?\?\s*location\.slot_step_min\s*\?\?\s*(?:SLOT_STEP_MIN|DEFAULT_STEP_MIN)/,
    )
  })

  it('publik availability validerar vald plats och platsspecifik tjänst', () => {
    expect(locationRules).toContain(".select('id, timezone, slot_step_min, min_notice_min, max_advance_days')")
    expect(publicActions).toContain(".select('duration_min, slot_step_min, buffer_min, location_id')")
    expect(publicActions).toContain('service.location_id !== loc')
  })

  it.each([
    ['publik', publicActions],
    ['admin', adminSlots],
  ])('%s filtrerar varje start mot den exakta bokningshorisonten', (_name, source) => {
    expect(source).toContain('maximumStart')
    expect(source).toMatch(/(?:s <= maximumStart|d > maximumStart)/)
  })

  it('platsregel-läsningen är fail-closed vid databasfel', () => {
    expect(locationRules).toContain('locationResult.error')
    expect(locationRules).toContain('hoursResult.error')
  })
})
