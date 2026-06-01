import { describe, it, expect } from 'vitest'
import { parseGuestEmail, parseGuestName } from './parse'

// The guest-contact note seam (G04): `Gäst: <name> <email> <phone> [— note]`.
// The webhook + reminder pipeline parse the recipient back out of it, so the
// parser is load-bearing for G10 notifications.
describe('parseGuestEmail', () => {
  it('extracts the email from a standard guest note', () => {
    expect(parseGuestEmail('Gäst: Anna Andersson <anna@example.com> 0701234567')).toBe('anna@example.com')
  })
  it('extracts even with a trailing free-text note', () => {
    expect(parseGuestEmail('Gäst: Bo <bo.k@salong.se> 070 — kommer 5 min sent')).toBe('bo.k@salong.se')
  })
  it('returns null when there is no email', () => {
    expect(parseGuestEmail('Gäst: Anna 0701234567')).toBeNull()
    expect(parseGuestEmail(null)).toBeNull()
    expect(parseGuestEmail(undefined)).toBeNull()
    expect(parseGuestEmail('')).toBeNull()
  })
})

describe('parseGuestName', () => {
  it('extracts the name before the email bracket', () => {
    expect(parseGuestName('Gäst: Anna Andersson <anna@example.com> 0701234567')).toBe('Anna Andersson')
  })
  it('returns null when the note is not a guest note', () => {
    expect(parseGuestName('Ombokad av kund')).toBeNull()
    expect(parseGuestName(null)).toBeNull()
  })
})
