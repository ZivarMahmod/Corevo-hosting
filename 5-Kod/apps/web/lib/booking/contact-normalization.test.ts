import { describe, expect, it } from 'vitest'

import { maskBookingContact, normalizeBookingContact } from './contact-normalization'

describe('booking contact normalization shared by client and server', () => {
  it('normaliserar och maskerar utan ett server-only beroende', () => {
    expect(normalizeBookingContact('sms', '070-123 45 67')).toBe('+46701234567')
    expect(normalizeBookingContact('email', ' KUND@Example.COM ')).toBe('kund@example.com')
    expect(normalizeBookingContact('sms', '123')).toBeNull()
    expect(normalizeBookingContact('email', 'fel')).toBeNull()
    expect(maskBookingContact('sms', '+46701234567')).toBe('+46 ••• •• 67')
    expect(maskBookingContact('email', 'kund@example.com')).toBe('k•••@example.com')
  })
})
