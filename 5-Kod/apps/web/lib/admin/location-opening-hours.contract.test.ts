import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function source(relativePath: string) {
  return fs.readFileSync(path.join(WEB_ROOT, relativePath), 'utf8')
}

describe('admin location opening hours contract', () => {
  it('reads one exact location and fails loudly on data errors', () => {
    const data = source('lib/admin/schedule-data.ts')

    expect(data).toContain('export async function listLocationOpeningHours')
    expect(data).toContain(".from('location_opening_hours')")
    expect(data).toContain(".eq('tenant_id', tenantId)")
    expect(data).toContain(".eq('location_id', locationId)")
    expect(data).toContain('listLocationOpeningHours:')
  })

  it('saves hours and booking rules through the atomic migration RPC', () => {
    const actions = source('lib/admin/schedule-actions.ts')

    expect(actions).toContain('export async function saveLocationBookingSettings')
    expect(actions).toContain("'save_location_booking_settings'")
    expect(actions).toContain('p_location: locationId')
    expect(actions).toContain('p_hours: hours')
    expect(actions).toContain("revalidatePath('/admin/scheman')")
    expect(actions).toContain("revalidatePath('/personal/arbetstider')")
    expect(actions).toContain("revalidatePath('/boka')")
  })

  it('renders all seven days, preserves split intervals and explains confirmation', () => {
    const component = source('components/admin/LocationOpeningHours.tsx')

    for (const day of ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']) {
      expect(component).toContain(day)
    }
    expect(component).toContain('useActionState')
    expect(component).toContain('Lägg till pass')
    expect(component).toContain('Importerade tider')
    expect(component).toContain('name="weekday"')
    expect(component).toContain('name="start_time"')
    expect(component).toContain('name="end_time"')
    expect(component).toContain('name="slot_step_min"')
    expect(component).toContain('name="min_notice_min"')
    expect(component).toContain('name="max_advance_days"')
  })

  it('mounts the location editor before the staff schedule surfaces', () => {
    const page = source('app/(admin)/admin/scheman/page.tsx')

    expect(page).toContain("import { LocationOpeningHours } from '@/components/admin/LocationOpeningHours'")
    expect(page).toContain('listLocationOpeningHours')
    expect(page).toContain('<LocationOpeningHours')
    expect(page.indexOf('<LocationOpeningHours')).toBeLessThan(page.indexOf('<ScheduleWeekBoard'))
  })
})
