import { describe, expect, it } from 'vitest'
import { bookingModuleAccess } from './booking-access'

describe('booking module access', () => {
  it.each([
    ['off', 'hidden'],
    ['live', 'live'],
  ] as const)('maps %s to %s', (state, expected) => {
    expect(bookingModuleAccess({ booking: state })).toBe(expected)
  })

  it('treats a missing row as hidden', () => {
    expect(bookingModuleAccess({})).toBe('hidden')
  })
})
