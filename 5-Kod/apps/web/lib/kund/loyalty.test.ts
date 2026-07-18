import { describe, it, expect } from 'vitest'
import { normalizeLoyaltyTotals, pointsPerVisit } from './loyalty'

// Pins the per-visit loyalty grouping (goal-17 /konto history). loyalty_ledger is
// append-only: several rows can share one booking_id (base earn + a bonus), and
// manual adjustments carry NO booking_id. The display row must sum per booking and
// drop the unattributable adjustments — these tests lock that invariant so a later
// edit can't silently start fabricating per-visit points or leaking adjustments in.

describe('pointsPerVisit', () => {
  it('returns [] for no rows (honest empty, never fabricated)', () => {
    expect(pointsPerVisit([])).toEqual([])
  })

  it('sums multiple ledger rows that share one booking_id', () => {
    const out = pointsPerVisit([
      { booking_id: 'b1', points_delta: 50 },
      { booking_id: 'b1', points_delta: 20 }, // bonus on the same visit
    ])
    expect(out).toEqual([{ bookingId: 'b1', pointsDelta: 70 }])
  })

  it('keeps separate booking_ids as separate visit rows', () => {
    const out = pointsPerVisit([
      { booking_id: 'b1', points_delta: 50 },
      { booking_id: 'b2', points_delta: 30 },
    ])
    expect(out).toContainEqual({ bookingId: 'b1', pointsDelta: 50 })
    expect(out).toContainEqual({ bookingId: 'b2', pointsDelta: 30 })
    expect(out).toHaveLength(2)
  })

  it('drops rows with a null booking_id (manual adjustments are not visit-attributable)', () => {
    const out = pointsPerVisit([
      { booking_id: null, points_delta: 100 }, // manual adjustment — excluded
      { booking_id: 'b1', points_delta: 40 },
    ])
    expect(out).toEqual([{ bookingId: 'b1', pointsDelta: 40 }])
  })

  it('preserves a net-zero booking (earned then redeemed on one visit)', () => {
    const out = pointsPerVisit([
      { booking_id: 'b1', points_delta: 50 },
      { booking_id: 'b1', points_delta: -50 },
    ])
    expect(out).toEqual([{ bookingId: 'b1', pointsDelta: 0 }])
  })

  it('preserves first-seen booking order for stable display', () => {
    const out = pointsPerVisit([
      { booking_id: 'b2', points_delta: 10 },
      { booking_id: 'b1', points_delta: 10 },
      { booking_id: 'b2', points_delta: 5 },
    ])
    expect(out.map((r) => r.bookingId)).toEqual(['b2', 'b1'])
  })
})

describe('normalizeLoyaltyTotals', () => {
  it('keeps spendable balance separate from outcome-aware lifetime', () => {
    expect(normalizeLoyaltyTotals({ balance: 0, lifetime: 50, entry_count: 3 })).toEqual({
      balance: 0,
      lifetime: 50,
      entryCount: 3,
    })
  })

  it('returns honest zeroes for a missing aggregate row', () => {
    expect(normalizeLoyaltyTotals(null)).toEqual({ balance: 0, lifetime: 0, entryCount: 0 })
  })
})
