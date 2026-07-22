import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
const wizard = readFileSync(
  new URL('../../components/booking/BookingWizard.tsx', import.meta.url),
  'utf8',
)

describe('/boka tenant-bound preselection wiring', () => {
  it('revalidates query context against active tenant rows before passing it to the wizard', () => {
    expect(page).toContain('resolveBookingSearchParams')
    expect(page).toContain('searchParams: sp')
    expect(page).toContain('locations,')
    expect(page).toContain('services: wizardServices')
    expect(page).toContain('locationId: s.location_id')
    expect(page).toContain('preselectLocationId={preselection.locationId}')
    expect(page).toContain('preselectServiceId={preselection.serviceId}')
  })

  it('resets incompatible location/service state to a renderable wizard step', () => {
    expect(wizard).toContain('resolveLocationSelection')
    expect(wizard).toContain('if (!compact) setStep(next.step)')
    expect(wizard).toContain('servicesAvailableAtLocation(services, locationId)')
  })
})
