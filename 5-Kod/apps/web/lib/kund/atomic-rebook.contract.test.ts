import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const actions = readFileSync(new URL('./actions.ts', import.meta.url), 'utf8')

describe('customer rebook payment rail', () => {
  it('uses one atomic DB finalizer instead of best-effort payment carry', () => {
    expect(actions).toContain("admin.rpc('finalize_customer_booking_rebook'")
    expect(actions).not.toContain('carryBookingPayment(')
    expect(actions).not.toContain(".from('payments')")
  })

  it('reconciles ambiguity through the DB and never directly cancels a mapped booking', () => {
    expect(actions).toContain('finalizeCustomerRebookSafely')
    expect(actions).toContain("admin.rpc('compensate_customer_booking_rebook'")
    const rebookAction = actions.slice(actions.indexOf('export async function rebookBooking'))
    expect(rebookAction).not.toContain(".from('bookings')")
  })
})
