import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('Goal 81 booking matrix wiring', () => {
  it('loads location timezone and max advance rules into every shared wizard mount', () => {
    const page = read('../../app/boka/page.tsx')
    const loader = read('../storefront/wizard-services.ts')
    const wizard = read('./BookingWizard.tsx')

    expect(page).toContain('getWizardLocations')
    expect(loader).toContain('timezone')
    expect(loader).toContain('max_advance_days')
    expect(loader).toContain('maxAdvanceDays')
    expect(wizard).toContain('bookingDateWindow')
    expect(wizard).toContain('selectedLocation.timeZone')
    expect(wizard).toContain('selectedLocation.maxAdvanceDays')
  })

  it('keeps only the latest slot response and invalidates dependent resets', () => {
    const wizard = read('./BookingWizard.tsx')
    const rebook = read('../kund/RebookPanel.tsx')

    for (const source of [wizard, rebook]) {
      expect(source).toContain('slotRequestRef')
      expect(source).toContain('request !== slotRequestRef.current')
    }
    expect(wizard.match(/slotRequestRef\.current \+= 1/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
  })

  it('preserves the legacy booking location through slot read and replacement create', () => {
    const bookings = read('../../lib/kund/bookings.ts')
    const actions = read('../../lib/kund/actions.ts')
    const rebook = read('../kund/RebookPanel.tsx')

    expect(bookings).toContain('locationId: r.location_id')
    expect(rebook).toContain('getAvailableSlots(serviceId, null, d, locationId)')
    expect(actions).toContain('p_location: old.locationId')
  })

  it('normalizes compact and inline contact before starting verification', () => {
    const wizard = read('./BookingWizard.tsx')

    expect(wizard).toContain("from '@/lib/booking/contact-normalization'")
    expect(wizard).toContain('normalizeBookingContact(contactMode, selectedContact())')
    expect(wizard).toContain("'Skriv ett giltigt mobilnummer.'")
    expect(wizard).toContain("'Skriv en giltig e-postadress.'")
  })

  it('uses the same four-digit PIN contract in compact and inline', () => {
    const wizard = read('./BookingWizard.tsx')

    expect(wizard).not.toContain('pin.length !== 6')
    expect(wizard).not.toContain('Fyll i 6 siffror')
    expect(wizard.match(/pin\.length !== 4/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})
