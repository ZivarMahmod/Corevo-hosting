import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendGiadaMessage = vi.fn()
const sendEmail = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/notifications/giada', () => ({
  sendGiadaMessage: (...args: unknown[]) => sendGiadaMessage(...args),
}))
vi.mock('@/lib/notifications/email', () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}))

import {
  bookingContactDigest,
  bookingPinDigest,
  deliverBookingPin,
  generateBookingPin,
  maskBookingContact,
  normalizeBookingContact,
} from './verification'

const ENV = { ...process.env }

beforeEach(() => {
  process.env.BOOKING_PIN_PEPPER = '0123456789abcdef0123456789abcdef'
  sendGiadaMessage.mockReset()
  sendEmail.mockReset()
})

afterEach(() => {
  process.env = { ...ENV }
})

describe('booking PIN crypto', () => {
  it('genererar alltid exakt sex siffror', () => {
    for (let i = 0; i < 100; i += 1) expect(generateBookingPin()).toMatch(/^\d{6}$/)
  })

  it('HMAC-binder PIN till session och kontakt till kanal', async () => {
    await expect(bookingPinDigest('session-a', '123456')).resolves.toMatch(/^[a-f0-9]{64}$/)
    await expect(bookingPinDigest('session-a', '123456')).resolves.not.toBe(
      await bookingPinDigest('session-b', '123456'),
    )
    await expect(bookingContactDigest('sms', '+46701234567')).resolves.not.toBe(
      await bookingContactDigest('email', '+46701234567'),
    )
  })

  it('vägrar arbeta utan en stark server-only pepper', async () => {
    delete process.env.BOOKING_PIN_PEPPER
    await expect(bookingPinDigest('session-a', '123456')).rejects.toThrow('booking_pin_pepper_missing')
  })
})

describe('booking contact', () => {
  it('normaliserar svenskt telefonnummer och e-post deterministiskt', () => {
    expect(normalizeBookingContact('sms', '070-123 45 67')).toBe('+46701234567')
    expect(normalizeBookingContact('email', ' KUND@Example.COM ')).toBe('kund@example.com')
    expect(normalizeBookingContact('sms', '123')).toBeNull()
    expect(normalizeBookingContact('email', 'fel')).toBeNull()
  })

  it('maskerar kontakt utan att lagra den i challenge-metadata', () => {
    expect(maskBookingContact('sms', '+46701234567')).toBe('+46 ••• •• 67')
    expect(maskBookingContact('email', 'kund@example.com')).toBe('k•••@example.com')
  })
})

describe('deliverBookingPin', () => {
  it('skickar SMS direkt med outbox-id som stabil idempotens', async () => {
    sendGiadaMessage.mockResolvedValue({ ok: true, id: 42, created: true })

    await expect(deliverBookingPin({
      channel: 'sms',
      contact: '+46701234567',
      pin: '123456',
      outboxId: 'outbox-1',
      tenantName: 'Demo',
    })).resolves.toEqual({ accepted: true, providerRef: 'giada:42' })
    expect(sendGiadaMessage).toHaveBeenCalledWith({
      to: '+46701234567',
      message: 'Demo: Din verifieringskod är 123456. Koden gäller i 5 minuter.',
      idempotencyKey: 'outbox:outbox-1',
    })
  })

  it('skickar e-post direkt utan att returnera PIN-koden', async () => {
    sendEmail.mockResolvedValue({ ok: true, id: 'mail-1' })

    const result = await deliverBookingPin({
      channel: 'email',
      contact: 'kund@example.com',
      pin: '123456',
      outboxId: 'outbox-2',
      tenantName: 'Demo & Co',
    })

    expect(result).toEqual({ accepted: true, providerRef: 'email:mail-1' })
    expect(JSON.stringify(result)).not.toContain('123456')
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'kund@example.com',
      subject: 'Din kod för bokningen hos Demo & Co',
      html: expect.stringContaining('123456'),
    }))
  })
})
