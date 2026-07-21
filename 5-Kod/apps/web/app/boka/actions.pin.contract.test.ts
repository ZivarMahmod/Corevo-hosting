import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./actions.ts', import.meta.url)), 'utf8')

describe('public booking PIN action contract', () => {
  it('exposes mode, start, resend and verify actions', () => {
    expect(source).toContain('export async function getBookingContactModeAction')
    expect(source).toContain('export async function startBookingVerification')
    expect(source).toContain('export async function resendBookingVerification')
    expect(source).toContain('export async function cancelBookingVerification')
    expect(source).toContain('export async function verifyAndCreateBooking')
  })

  it('starts and records delivery through the private service-role contract', () => {
    expect(source).toMatch(/\.rpc\(\s*'start_booking_verification'/)
    expect(source).toContain('dispatchNotificationOutboxById(row.pin_outbox_id')
    expect(source).toContain('deliverBookingPin({')
    expect(source).toMatch(/\.rpc\(\s*'record_booking_verification_delivery'/)
    expect(source).toMatch(/\.rpc\(\s*'release_slot_hold'/)
    expect(source).toMatch(/\.rpc\(\s*'cancel_booking_verification'/)
    expect(source).toContain('safeReleaseSlotHold')
    expect(source).toContain('booking_verification.delivery_record_failed')
  })

  it('only creates the booking through the verified finalize contract', () => {
    expect(source).toMatch(/\.rpc\(\s*'finalize_verified_storefront_booking'/)
    expect(source).toContain('dispatchNotificationOutboxById(row.outbox_id')
    expect(source).toContain('deliverImmediateBookingOutbox')
    expect(source).not.toContain("rpc('create_storefront_booking_with_release'")
    expect(source).not.toContain('export async function createBooking')
    expect(source).toContain('booking_finalize.rpc_transport_failed')
  })

  it('uses fail-closed, separate start/resend/verify rate limits', () => {
    expect(source).toContain('LIMITS.bookingPinStart')
    expect(source).toContain('LIMITS.bookingPinResend')
    expect(source).toContain('LIMITS.bookingPinVerify')
    expect(source).toContain('checkRateLimitFailClosed')
    expect(source).toContain("rateLimitKey(bucket, ctx.tenantId, 'ip', ip)")
    expect(source).toContain("rateLimitKey(bucket, ctx.tenantId, 'target', limiterPart)")
  })
})
