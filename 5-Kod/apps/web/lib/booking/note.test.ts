import { describe, expect, it } from 'vitest'
import { sanitizeBookingNote } from './note'

describe('sanitizeBookingNote', () => {
  it('keeps a real customer message', () => {
    expect(sanitizeBookingNote('  Allergisk mot parfym  ')).toBe('Allergisk mot parfym')
  })

  it('removes the legacy contact prefix but preserves the message after the separator', () => {
    expect(
      sanitizeBookingNote(
        'Gäst: Anna Andersson <anna@example.com> 070-123 45 67 — Kommer fem minuter tidigt',
      ),
    ).toBe('Kommer fem minuter tidigt')
  })

  it('does not expose a legacy contact-only note', () => {
    expect(sanitizeBookingNote('Gäst: Anna <anna@example.com> 0701234567')).toBeNull()
  })

  it('keeps legitimate free text that merely starts with Gäst:', () => {
    expect(sanitizeBookingNote('Gäst: min syster följer med')).toBe(
      'Gäst: min syster följer med',
    )
    expect(sanitizeBookingNote('Gäst: skriv <inte en e-post> på kortet')).toBe(
      'Gäst: skriv <inte en e-post> på kortet',
    )
  })

  it('treats empty input as no note', () => {
    expect(sanitizeBookingNote('   ')).toBeNull()
    expect(sanitizeBookingNote(null)).toBeNull()
    expect(sanitizeBookingNote(undefined)).toBeNull()
  })
})
