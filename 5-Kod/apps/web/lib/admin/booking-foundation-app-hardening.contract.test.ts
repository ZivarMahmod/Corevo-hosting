import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('booking foundation app hardening', () => {
  it('underkänner en seedad tid som inte finns bland tjänstens laddade slots', () => {
    const drawer = read('components/admin/NewBookingDrawer.tsx')

    expect(drawer).toContain('slotMatchesPicked')
    expect(drawer).toContain('slotLoadSeq')
    expect(drawer).toContain('if (slotLoadSeq.current !== sequence) return')
    expect(drawer).toMatch(/if \(!slotMatchesPicked\(picked, nextSlots\)\) setPicked\(null\)/)
    expect(drawer).toMatch(/readyToSave[\s\S]*slotMatchesPicked\(picked, slots\)/)
  })

  it('avbryter slotberäkningen om busy-RPC:n misslyckas', () => {
    const slots = read('lib/admin/calendar-slots.ts')

    expect(slots).toContain('error: busyError')
    expect(slots).toMatch(/if \(busyError\) throw new Error\('busy_intervals_unavailable'\)/)
  })

  it('materialiserar återkommande block i den valda platsens tidszon', () => {
    const actions = read('lib/admin/calendar-actions.ts')
    const createBlock = actions.slice(
      actions.indexOf('export async function createBlock'),
      actions.indexOf('\nexport async function removeBlock'),
    )

    expect(createBlock).toContain(".from('locations')")
    expect(createBlock).toContain(".select('timezone')")
    expect(createBlock).toContain(".eq('id', input.locationId)")
    expect(createBlock).toContain(".eq('tenant_id', tenant.id)")
    expect(createBlock).toContain('tz: location.timezone ?? tenant.timeZone')
  })

  it('visar beläggning även när kalendern har en exakt plats vald', () => {
    const board = read('components/admin/CalendarBoard.tsx')

    expect(board).toContain('const occupancy = occupancyPct(bookedMin, workedMin)')
    expect(board).not.toContain('const occupancy = locationId ? null')
  })

  it('bär frånvarokontexten genom ombokningen och rensar djuplänken', () => {
    const block = read('components/admin/BlockDrawer.tsx')
    const board = read('components/admin/CalendarBoard.tsx')
    const drawer = read('components/admin/BookingDrawer.tsx')
    const actions = read('lib/admin/calendar-actions.ts')

    expect(block).toContain('&absence=${existing.id}')
    expect(board).toContain("params.get('absence')")
    expect(board).toContain("sp.delete('absence')")
    expect(drawer).toContain('absenceTimeOffId')
    expect(actions).toContain("'reschedule_admin_absence_booking'")
  })
})
