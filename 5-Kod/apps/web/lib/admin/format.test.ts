import { describe, it, expect } from 'vitest'
import { ALLOWED_FROM, BOOKING_STATUSES, type BookingStatus } from './format'

// Pins the admin status-transition contract (VÅG 2). The verify that found the
// original gaps was a code-read; this locks the invariant so a future edit to
// ALLOWED_FROM can't silently re-open them.
describe('ALLOWED_FROM status-transition matrix', () => {
  const sources = (Object.values(ALLOWED_FROM) as BookingStatus[][]).flat()

  it('has an entry for every booking status', () => {
    for (const s of BOOKING_STATUSES) expect(ALLOWED_FROM[s]).toBeDefined()
  })

  it('keeps `cancelled` as the only NON-revivable terminal — never a source', () => {
    // Cancelling moves money (refund); reviving a refunded booking would desync
    // Stripe. So no target may be reached FROM `cancelled`.
    expect(sources).not.toContain('cancelled')
  })

  it('lets `completed` be corrected — it appears as a source', () => {
    expect(sources).toContain('completed')
  })

  it('lets `no_show` be corrected — it appears as a source', () => {
    expect(sources).toContain('no_show')
  })

  it('never lists a status as a source of itself (same-status save is a no-op, not a transition)', () => {
    for (const target of BOOKING_STATUSES) {
      expect(ALLOWED_FROM[target]).not.toContain(target)
    }
  })

  it('completed→cancelled is reachable (paid+completed booking can be cancelled+refunded)', () => {
    expect(ALLOWED_FROM.cancelled).toContain('completed')
  })
})
