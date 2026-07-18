import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(webRoot, path), 'utf8')

describe('BookingWizard status contract', () => {
  it('carries the atomic DB status into the embedded completion step', () => {
    const action = read('app/boka/actions.ts')
    const wizard = read('components/booking/BookingWizard.tsx')

    expect(action).toContain("bookingStatus: rpcRow.booking_status === 'confirmed'")
    expect(wizard).toContain('setBookingStatus(res.bookingStatus)')
    expect(wizard).toContain('const bookingPresentation = bookingStatusPresentation(bookingStatus)')
    expect(wizard).toContain('{bookingPresentation.heading}')
    expect(wizard).toContain('{bookingPresentation.stamp}')
    expect(wizard).toContain('bookingPresentation.canAddToCalendar')
    expect(wizard).not.toContain('Din tid är bokad.')
  })
})
