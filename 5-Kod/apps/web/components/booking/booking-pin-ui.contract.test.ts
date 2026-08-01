import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./BookingWizard.tsx', import.meta.url)), 'utf8')

describe('booking wizard PIN gate', () => {
  it('starts, resends and finalizes through the verified actions', () => {
    expect(source).toContain('startBookingVerification')
    expect(source).toContain('resendBookingVerification')
    expect(source).toContain('cancelBookingVerification')
    expect(source).toContain('verifyAndCreateBooking')
    expect(source).not.toContain('createBooking,')
  })

  it('releases the verification hold before returning to editable contact details', () => {
    expect(source).toContain('await cancelBookingVerification({')
    expect(source).toMatch(/async function leaveVerification[\s\S]*?if \(!res\.ok\)[\s\S]*?setVerification\(null\)/)
  })

  it('renders exactly the live contact channel and a one-time-code field', () => {
    expect(source).toContain('getBookingContactModeAction')
    expect(source).toContain("contactMode === 'sms'")
    expect(source).toContain('autoComplete="one-time-code"')
    expect(source).toContain('inputMode="numeric"')
    expect(source).toContain('pin.length !== 4')
    expect(source).toContain('pattern="[0-9]{4}"')
    expect(source).toContain('maxLength={4}')
  })

  it('falls back to e-mail only when the server explicitly allows it', () => {
    expect(source).toMatch(
      /res\.reason === 'delivery_unavailable' && res\.channel === 'email'[\s\S]*?setContactMode\('email'\)/,
    )
    expect(source).not.toContain(
      "res.reason === 'delivery_unavailable' && verification.channel === 'sms'",
    )
  })

  it('does not call a booking successful before PIN finalize succeeds', () => {
    expect(source).toContain('verifyAndCreateBooking({')
    expect(source).toMatch(
      /res = await verifyAndCreateBooking\([\s\S]*?if \(res\.ok\) \{\s*await finishCreatedBooking\(res\)/,
    )
  })
})
