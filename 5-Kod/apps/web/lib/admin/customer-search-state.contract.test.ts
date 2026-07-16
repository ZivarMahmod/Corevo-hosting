import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('kundsökningen i Ny bokning', () => {
  it('skiljer väntar, tom träff och serverfel från varandra', () => {
    const action = read('lib/admin/calendar-actions.ts')
    const drawer = read('components/admin/NewBookingDrawer.tsx')

    expect(action).toContain('export type CustomerSearchResult')
    expect(action).toContain("return { hits: [], error: 'Kundsökningen gick inte att genomföra.' }")
    expect(drawer).toContain("type CustomerSearchStatus = 'idle' | 'debouncing' | 'searching' | 'settled' | 'error'")
    expect(drawer).toContain('customerSearchSeq.current')
    expect(drawer).toContain("customerSearchStatus === 'settled'")
    expect(drawer).toContain("customerSearchStatus === 'searching'")
    expect(drawer).toContain("customerSearchStatus === 'debouncing'")
  })

  it('kan inte spara en ny kund innan sökningen säkert är klar', () => {
    const drawer = read('components/admin/NewBookingDrawer.tsx')

    expect(drawer).toContain('const customerResolved = Boolean(chosen) || customerSearchStatus ===')
    expect(drawer).toContain('slotMatchesPicked(picked, slots) &&')
    expect(drawer).toContain('customerResolved &&')
    expect(drawer).toContain('customerQuery.trim().length >= 2')
    expect(drawer).not.toContain('hits.length === 0 && !slotsLoading')
  })
})
