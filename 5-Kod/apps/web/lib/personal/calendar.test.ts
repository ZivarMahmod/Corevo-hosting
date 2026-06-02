import { describe, it, expect } from 'vitest'
import { dayRangeUtc, weekRangeUtc } from './calendar'

// Defensive guard: a broken tenant timezone (invalid IANA id) or a malformed
// date string both make the underlying zonedTimeToUtc throw RangeError. These
// functions must never let that bubble into the personal view as a crash —
// they fall back to a well-formed UTC range instead. (Normal flow never hits
// this; todayInTz always yields a valid string. This is a cheap safety net.)

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

describe('dayRangeUtc — defensive guard', () => {
  it('does not throw on a broken tenant timezone, returns a valid ISO range', () => {
    let range: { fromUtc: string; toUtc: string } | undefined
    expect(() => {
      range = dayRangeUtc('2026-06-02', 'Not/AZone')
    }).not.toThrow()
    expect(range!.fromUtc).toMatch(ISO_RE)
    expect(range!.toUtc).toMatch(ISO_RE)
    expect(new Date(range!.fromUtc).getTime()).toBeLessThan(new Date(range!.toUtc).getTime())
  })

  it('does not throw on a malformed date string', () => {
    let range: { fromUtc: string; toUtc: string } | undefined
    expect(() => {
      range = dayRangeUtc('not-a-date', 'Europe/Stockholm')
    }).not.toThrow()
    expect(range!.fromUtc).toMatch(ISO_RE)
    expect(range!.toUtc).toMatch(ISO_RE)
  })

  it('still returns the correct range for a valid tz (no regression)', () => {
    // 2026-06-02 is CEST (+2), so local midnight is 22:00Z the day before.
    const { fromUtc, toUtc } = dayRangeUtc('2026-06-02', 'Europe/Stockholm')
    expect(fromUtc).toBe('2026-06-01T22:00:00.000Z')
    expect(toUtc).toBe('2026-06-02T22:00:00.000Z')
  })
})

describe('weekRangeUtc — defensive guard', () => {
  it('does not throw on a broken tenant timezone, returns a valid ISO range', () => {
    let range: { fromUtc: string; toUtc: string } | undefined
    expect(() => {
      range = weekRangeUtc('2026-06-01', 'Not/AZone')
    }).not.toThrow()
    expect(range!.fromUtc).toMatch(ISO_RE)
    expect(range!.toUtc).toMatch(ISO_RE)
    expect(new Date(range!.fromUtc).getTime()).toBeLessThan(new Date(range!.toUtc).getTime())
  })

  it('does not throw on a malformed date string', () => {
    expect(() => weekRangeUtc('garbage', 'Europe/Stockholm')).not.toThrow()
  })

  it('still spans 7 days for a valid tz (no regression)', () => {
    const { fromUtc, toUtc } = weekRangeUtc('2026-06-01', 'Europe/Stockholm')
    const days = (new Date(toUtc).getTime() - new Date(fromUtc).getTime()) / 86_400_000
    expect(days).toBe(7)
  })
})
