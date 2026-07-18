import { describe, expect, it } from 'vitest'
import { classifyBookingOutcome, isOutcomeReady } from './outcome'

describe('bokningsutfall följer verklig sluttid', () => {
  const now = new Date('2026-07-18T12:00:00.000Z')

  it('kan inte avgöras medan behandlingen fortfarande pågår', () => {
    expect(isOutcomeReady('2026-07-18T12:30:00.000Z', now)).toBe(false)
    expect(classifyBookingOutcome('confirmed', '2026-07-18T12:30:00.000Z', now)).toBe(
      'upcoming',
    )
  })

  it('gör en passerad aktiv bokning explicit olöst, aldrig genomförd', () => {
    expect(isOutcomeReady('2026-07-18T11:59:59.000Z', now)).toBe(true)
    expect(classifyBookingOutcome('pending', '2026-07-18T11:59:59.000Z', now)).toBe(
      'unresolved',
    )
  })

  it('gör en pågående cancelled historisk och inte återställningsbar via aktivt flöde', () => {
    expect(classifyBookingOutcome('cancelled', '2026-07-18T12:30:00.000Z', now)).toBe(
      'cancelled',
    )
  })

  it.each([
    ['completed', 'completed'],
    ['no_show', 'no_show'],
    ['cancelled', 'cancelled'],
  ] as const)('behåller det registrerade utfallet %s', (status, expected) => {
    expect(classifyBookingOutcome(status, '2026-07-19T12:00:00.000Z', now)).toBe(expected)
  })
})
