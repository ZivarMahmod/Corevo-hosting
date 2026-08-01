import { describe, expect, it } from 'vitest'

import { maskBookingContact, normalizeBookingContact } from './contact-normalization'

describe('booking contact normalization shared by client and server', () => {
  it('normaliserar svensk mobil till E.164 och visar den lokalt', () => {
    expect(normalizeBookingContact('sms', '070-123 45 67', 'SE')).toBe('+46701234567')
    expect(normalizeBookingContact('sms', '+46 70 123 45 67', 'SE')).toBe('+46701234567')
    expect(normalizeBookingContact('email', ' KUND@Example.COM ')).toBe('kund@example.com')
    expect(maskBookingContact('sms', '+46701234567', 'SE')).toBe('070 ••• •• 67')
  })

  it('nekar fel land och felaktiga svenska mobilnummer', () => {
    expect(normalizeBookingContact('sms', '+45 12 34 56 78', 'SE')).toBeNull()
    expect(normalizeBookingContact('sms', '0701234567', 'DK')).toBeNull()
    expect(normalizeBookingContact('sms', '081234567', 'SE')).toBeNull()
    expect(normalizeBookingContact('sms', '0741234567', 'SE')).toBeNull()
    expect(normalizeBookingContact('sms', '0771234567', 'SE')).toBeNull()
    expect(normalizeBookingContact('sms', '0781234567', 'SE')).toBeNull()
    expect(normalizeBookingContact('sms', '123', 'SE')).toBeNull()
    expect(normalizeBookingContact('email', 'fel')).toBeNull()
    expect(maskBookingContact('email', 'kund@example.com')).toBe('k•••@example.com')
  })
})
