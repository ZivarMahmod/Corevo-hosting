import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./BookingWizard.tsx', import.meta.url)), 'utf8')

describe('booking wizard PIN gate', () => {
  it('starts, resends and finalizes through the verified actions', () => {
    expect(source).toContain('startBookingVerification')
    expect(source).toContain('resendBookingVerification')
    expect(source).toContain('verifyAndCreateBooking')
    expect(source).not.toContain('createBooking,')
  })

  it('renders exactly the live contact channel and a one-time-code field', () => {
    expect(source).toContain('getBookingContactModeAction')
    expect(source).toContain("contactMode === 'sms'")
    expect(source).toContain('autoComplete="one-time-code"')
    expect(source).toContain('inputMode="numeric"')
  })

  it('does not call a booking successful before PIN finalize succeeds', () => {
    expect(source).toContain('verifyAndCreateBooking({')
    expect(source).toMatch(
      /res = await verifyAndCreateBooking\([\s\S]*?if \(res\.ok\) \{\s*await finishCreatedBooking\(res\)/,
    )
  })
})
