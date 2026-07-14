import { describe, it, expect } from 'vitest'
import {
  ALLOWED_FROM,
  BOOKING_STATUSES,
  cancellationTrace,
  restoreBlockedByRefund,
  type BookingStatus,
} from './format'

// Pins the admin status-transition contract (VÅG 2). The verify that found the
// original gaps was a code-read; this locks the invariant so a future edit to
// ALLOWED_FROM can't silently re-open them.
describe('ALLOWED_FROM status-transition matrix', () => {
  const sources = (Object.values(ALLOWED_FROM) as BookingStatus[][]).flat()

  it('has an entry for every booking status', () => {
    for (const s of BOOKING_STATUSES) expect(ALLOWED_FROM[s]).toBeDefined()
  })

  it('lets a cancelled booking be restored — but ONLY back to `confirmed`', () => {
    // B-24 (ångraloggen): en felavbokad tid ska gå att få tillbaka. Restore landar
    // i `confirmed` — den enda status där tiden faktiskt är bokad igen. Att också
    // öppna cancelled→completed/no_show vore att låta ett ångra-klick påstå att ett
    // besök ägt rum. Refund-invarianten lever kvar i setBookingStatus (matrisen ser
    // inte pengar): en ÅTERBETALD bokning går aldrig att återställa.
    expect(ALLOWED_FROM.confirmed).toContain('cancelled')
    for (const target of ['pending', 'completed', 'no_show'] as const) {
      expect(ALLOWED_FROM[target]).not.toContain('cancelled')
    }
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

// B-26: avboka/återställ-semantiken, extraherad ur setBookingStatus just för att
// kunna låsas utan databas. Pengarna styr — inte klicket.
describe('restoreBlockedByRefund (refund-vakten)', () => {
  it('vägrar väcka en ÅTERBETALD avbokning', () => {
    expect(restoreBlockedByRefund('cancelled', 'refunded')).toBe(true)
  })

  it('släpper igenom en avbokning utan betalning (betalar på plats)', () => {
    expect(restoreBlockedByRefund('cancelled', null)).toBe(false)
    expect(restoreBlockedByRefund('cancelled', undefined)).toBe(false)
  })

  it('släpper igenom en avbokning vars betalning inte återbetalats', () => {
    expect(restoreBlockedByRefund('cancelled', 'succeeded')).toBe(false)
  })

  it('gäller BARA avbokade — en completed med refund blockeras inte av den här vakten', () => {
    expect(restoreBlockedByRefund('completed', 'refunded')).toBe(false)
  })
})

describe('cancellationTrace (ångraloggens spår)', () => {
  const NOW = new Date('2026-07-14T12:00:00.000Z')

  it('stämplar när+vem vid avbokning', () => {
    expect(cancellationTrace('confirmed', 'cancelled', NOW)).toEqual({
      cancelled_at: NOW.toISOString(),
      cancelled_by: 'business',
    })
  })

  it('NOLLAR spåret vid återställning — annars spökar bokningen kvar i ångraloggen', () => {
    expect(cancellationTrace('cancelled', 'confirmed', NOW)).toEqual({
      cancelled_at: null,
      cancelled_by: null,
    })
  })

  it('rör inte spåret för övergångar som inte passerar cancelled', () => {
    expect(cancellationTrace('pending', 'confirmed', NOW)).toEqual({})
    expect(cancellationTrace('confirmed', 'completed', NOW)).toEqual({})
  })
})
