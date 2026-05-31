import { describe, it, expect } from 'vitest'
import { zonedTimeToUtc, weekdayOf } from './tz'

describe('zonedTimeToUtc (Europe/Stockholm)', () => {
  it('winter wall time is CET (UTC+1)', () => {
    // 2026-01-15 09:00 local → 08:00Z
    expect(zonedTimeToUtc('2026-01-15', '09:00', 'Europe/Stockholm').toISOString()).toBe(
      '2026-01-15T08:00:00.000Z',
    )
  })

  it('summer wall time is CEST (UTC+2)', () => {
    // 2026-07-15 09:00 local → 07:00Z
    expect(zonedTimeToUtc('2026-07-15', '09:00', 'Europe/Stockholm').toISOString()).toBe(
      '2026-07-15T07:00:00.000Z',
    )
  })

  it('spring-forward day (last Sun of March) already on CEST by 09:00', () => {
    // 2026-03-29 is the DST start; 09:00 local → CEST (+2) → 07:00Z
    expect(zonedTimeToUtc('2026-03-29', '09:00', 'Europe/Stockholm').toISOString()).toBe(
      '2026-03-29T07:00:00.000Z',
    )
  })

  it('fall-back day (last Sun of October) on CET by 09:00', () => {
    // 2026-10-25 is the DST end; 09:00 local → CET (+1) → 08:00Z
    expect(zonedTimeToUtc('2026-10-25', '09:00', 'Europe/Stockholm').toISOString()).toBe(
      '2026-10-25T08:00:00.000Z',
    )
  })

  it('handles midnight without rolling to the next day', () => {
    expect(zonedTimeToUtc('2026-07-15', '00:00', 'Europe/Stockholm').toISOString()).toBe(
      '2026-07-14T22:00:00.000Z',
    )
  })
})

describe('weekdayOf', () => {
  it('returns 0..6 with 0 = Sunday (matches working_hours.weekday)', () => {
    expect(weekdayOf('2026-01-01')).toBe(4) // Thursday
    expect(weekdayOf('2026-06-01')).toBe(1) // Monday
    expect(weekdayOf('2026-05-31')).toBe(0) // Sunday
  })

  it('is timezone-stable (a calendar date is a date)', () => {
    // Noon-anchored so a DST boundary can't shift the weekday.
    expect(weekdayOf('2026-03-29')).toBe(0) // Sunday
    expect(weekdayOf('2026-10-25')).toBe(0) // Sunday
  })
})
