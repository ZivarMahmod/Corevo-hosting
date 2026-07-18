import { describe, expect, it } from 'vitest'
import { bookingStatusPresentation } from './confirmation-status'

describe('public booking status presentation', () => {
  it('never presents a pending request as confirmed', () => {
    const pending = bookingStatusPresentation('pending')

    expect(pending.heading).toContain('förfrågan')
    expect(pending.message).toContain('inte bekräftad')
    expect(pending.stamp).not.toBe('BEKRÄFTAD')
    expect(pending.canAddToCalendar).toBe(false)
    expect(pending.canManage).toBe(true)
  })

  it('offers calendar export only for a confirmed future booking', () => {
    expect(bookingStatusPresentation('confirmed').canAddToCalendar).toBe(true)

    for (const status of ['pending', 'cancelled', 'completed', 'no_show', 'unknown']) {
      expect(bookingStatusPresentation(status).canAddToCalendar).toBe(false)
    }
  })

  it('does not expose cancellation controls for terminal or unknown states', () => {
    expect(bookingStatusPresentation('confirmed').canManage).toBe(true)
    expect(bookingStatusPresentation('pending').canManage).toBe(true)
    expect(bookingStatusPresentation('cancelled').canManage).toBe(false)
    expect(bookingStatusPresentation('completed').canManage).toBe(false)
    expect(bookingStatusPresentation('no_show').canManage).toBe(false)
    expect(bookingStatusPresentation(undefined).canManage).toBe(false)
  })
})
