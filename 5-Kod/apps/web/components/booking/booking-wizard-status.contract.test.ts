import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(webRoot, path), 'utf8')

describe('BookingWizard status contract', () => {
  it('carries the atomic DB status into the embedded completion step', () => {
    const action = read('app/boka/actions.ts')
    const wizard = read('components/booking/BookingWizard.tsx')

    expect(action).toContain("const bookingStatus = row.booking_status === 'confirmed'")
    expect(action).toContain('finalize_verified_storefront_booking')
    expect(wizard).toContain('setBookingStatus(res.bookingStatus)')
    expect(wizard).toContain('const bookingPresentation = bookingStatusPresentation(bookingStatus)')
    expect(wizard).toContain('{bookingPresentation.heading}')
    expect(wizard).toContain('{bookingPresentation.stamp}')
    expect(wizard).toContain('bookingPresentation.canAddToCalendar')
    expect(wizard).not.toContain('Din tid är bokad.')
  })

  it('uses a real tenant-bound same-tab link for the step-five book-again action', () => {
    const wizard = read('components/booking/BookingWizard.tsx')

    expect(wizard).toContain('buildTenantBookingPath')
    expect(wizard).toMatch(/<Link[^>]+href=\{bookAgainPath\}[^>]*>/)
    expect(wizard).toContain('Boka en tid till')
    expect(wizard).not.toMatch(/<button[^>]+onClick=\{resetWizard\}[\s\S]{0,120}Boka en till tid/)
  })
})
