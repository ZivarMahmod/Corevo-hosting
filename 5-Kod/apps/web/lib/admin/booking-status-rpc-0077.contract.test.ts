import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = fs.readFileSync(path.join(WEB_ROOT, 'lib', 'admin', 'actions.ts'), 'utf8')
const statusAction = source.slice(
  source.indexOf('export async function setBookingStatus'),
  source.indexOf('\n}', source.indexOf("return { success: 'Status uppdaterad.' }")) + 2,
)

describe('setBookingStatus 0077', () => {
  it('skriver via platsfencad atomisk RPC och behåller efteråtgärderna', () => {
    expect(statusAction).toContain("rpc('set_admin_booking_status'")
    expect(statusAction).not.toContain("from('bookings').update")
    expect(statusAction).not.toContain('createAdminServiceClient')
    expect(statusAction).toContain('sendReviewNudgeForBooking')
    expect(statusAction).toContain('refundBookingPayment')
  })
})
