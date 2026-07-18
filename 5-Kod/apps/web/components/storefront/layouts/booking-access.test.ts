import { describe, expect, it } from 'vitest'
import { bookingModuleAccess } from './booking-access'

describe('booking module access', () => {
  it.each([
    ['off', 'hidden'],
    ['draft', 'hidden'],
    ['paused', 'paused'],
    ['live', 'live'],
  ] as const)('maps %s to %s', (state, expected) => {
    expect(bookingModuleAccess({ booking: state })).toBe(expected)
  })

  it('preserves the historical missing-row default as live', () => {
    expect(bookingModuleAccess({})).toBe('live')
  })
})
