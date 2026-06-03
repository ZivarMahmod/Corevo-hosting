import { describe, it, expect } from 'vitest'
import { platformMonth, monthRangeUtc } from './metrics'

// The Översikt "denna månad" window is resolved in Europe/Stockholm, not the
// server's UTC, so the month flips at LOCAL midnight and the booking count lines
// up with billingUnderlag's bounds. These pin the timezone edge.

describe('platformMonth', () => {
  it('resolves the calendar month in Europe/Stockholm', () => {
    // 2026-06-15 12:00 UTC is solidly inside June in Stockholm.
    expect(platformMonth(new Date('2026-06-15T12:00:00Z'))).toEqual({ year: 2026, month: 6 })
  })
  it('a UTC instant just before local midnight still reads the local month', () => {
    // 2026-06-30 23:30 UTC = 2026-07-01 01:30 CEST → July locally, not June.
    expect(platformMonth(new Date('2026-06-30T23:30:00Z'))).toEqual({ year: 2026, month: 7 })
  })
  it('handles the December → January year rollover', () => {
    // 2026-12-31 23:30 UTC = 2027-01-01 00:30 CET → January 2027 locally.
    expect(platformMonth(new Date('2026-12-31T23:30:00Z'))).toEqual({ year: 2027, month: 1 })
  })
})

describe('monthRangeUtc (overview window)', () => {
  it('June 2026 spans the local-midnight UTC bounds', () => {
    const { fromUtc, toUtc } = monthRangeUtc(2026, 6)
    // CEST (UTC+2) in June → local midnight is 22:00 UTC the prior day.
    expect(fromUtc).toBe('2026-05-31T22:00:00.000Z')
    expect(toUtc).toBe('2026-06-30T22:00:00.000Z')
  })
})
