import { describe, it, expect } from 'vitest'
import {
  ALLOWED_FROM,
  BOOKING_STATUSES,
  cancellationTrace,
  relativeVisitSv,
  isInactiveSince,
  restoreBlockedByRefund,
} from './format'

// Pins the admin status-transition contract (VÅG 2). The verify that found the
// original gaps was a code-read; this locks the invariant so a future edit to
// ALLOWED_FROM can't silently re-open them.
describe('ALLOWED_FROM status-transition matrix', () => {
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

  it('corrects completed only directly to no_show', () => {
    expect(ALLOWED_FROM.no_show).toContain('completed')
    for (const target of ['pending', 'confirmed', 'cancelled'] as const) {
      expect(ALLOWED_FROM[target]).not.toContain('completed')
    }
  })

  it('corrects no_show only directly to completed', () => {
    expect(ALLOWED_FROM.completed).toContain('no_show')
    for (const target of ['pending', 'confirmed', 'cancelled'] as const) {
      expect(ALLOWED_FROM[target]).not.toContain('no_show')
    }
  })

  it('never lists a status as a source of itself (same-status save is a no-op, not a transition)', () => {
    for (const target of BOOKING_STATUSES) {
      expect(ALLOWED_FROM[target]).not.toContain(target)
    }
  })

  it('does not reopen a terminal outcome through cancelled', () => {
    expect(ALLOWED_FROM.cancelled).not.toContain('completed')
    expect(ALLOWED_FROM.cancelled).not.toContain('no_show')
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

describe('relativeVisitSv', () => {
  const NOW = new Date('2026-07-15T12:00:00Z')
  const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString()
  it('idag / igår / dagar / veckor / månader', () => {
    expect(relativeVisitSv(daysAgo(0), NOW)).toBe('idag')
    expect(relativeVisitSv(daysAgo(1), NOW)).toBe('igår')
    expect(relativeVisitSv(daysAgo(3), NOW)).toBe('3 dgr sedan')
    expect(relativeVisitSv(daysAgo(21), NOW)).toBe('3 v sedan')
    expect(relativeVisitSv(daysAgo(122), NOW)).toBe('4 mån sedan')
  })
  it('null → aldrig, skräp → —', () => {
    expect(relativeVisitSv(null, NOW)).toBe('aldrig')
    expect(relativeVisitSv('inte-ett-datum', NOW)).toBe('—')
  })
})

describe('isInactiveSince', () => {
  const NOW = new Date('2026-07-15T12:00:00Z')
  it('>90 dgr = inaktiv, null = inaktiv, färskt = ej', () => {
    expect(isInactiveSince(new Date(NOW.getTime() - 100 * 86_400_000).toISOString(), 90, NOW)).toBe(true)
    expect(isInactiveSince(new Date(NOW.getTime() - 10 * 86_400_000).toISOString(), 90, NOW)).toBe(false)
    expect(isInactiveSince(null, 90, NOW)).toBe(true)
  })
})
