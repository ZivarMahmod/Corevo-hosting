import { describe, expect, it } from 'vitest'
import { bookingModeFromState } from '@/lib/admin/booking-mode'

describe('binary booking module status', () => {
  it('maps only live to on', () => {
    expect(bookingModeFromState(undefined)).toBe('av')
    expect(bookingModeFromState('live')).toBe('pa')
    expect(bookingModeFromState('off')).toBe('av')
  })
})
