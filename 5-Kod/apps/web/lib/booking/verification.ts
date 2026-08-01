import 'server-only'

import { sendEmail } from '@/lib/notifications/email'
import { sendGiadaMessage } from '@/lib/notifications/giada'
import type { BookingVerificationChannel } from './contact-normalization'

export {
  maskBookingContact,
  normalizeBookingContact,
} from './contact-normalization'
export type { BookingVerificationChannel } from './contact-normalization'

const UINT32_SPACE = 0x1_0000_0000

export function generateBookingPin(digits: 4 | 6 = 4): string {
  const pinSpace = digits === 4 ? 10_000 : 1_000_000
  const uint32PinLimit = UINT32_SPACE - (UINT32_SPACE % pinSpace)
  const value = new Uint32Array(1)
  do crypto.getRandomValues(value)
  while (value[0]! >= uint32PinLimit)
  return String(value[0]! % pinSpace).padStart(digits, '0')
}

function pepper(): string {
  const value = process.env.BOOKING_PIN_PEPPER ?? ''
  if (value.length < 32) throw new Error('booking_pin_pepper_missing')
  return value
}

async function hmac(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function bookingPinDigest(sessionToken: string, pin: string): Promise<string> {
  return hmac(`booking-pin:${sessionToken}:${pin}`)
}

export function bookingContactDigest(
  channel: BookingVerificationChannel,
  normalizedContact: string,
): Promise<string> {
  return hmac(`booking-contact:${channel}:${normalizedContact}`)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export async function deliverBookingPin(input: {
  channel: BookingVerificationChannel
  contact: string
  pin: string
  outboxId: string
  tenantName: string
  expiresAt: string
}): Promise<{ accepted: true; providerRef?: string } | { accepted: false; reason: string }> {
  const tenantName = input.tenantName.trim() || 'Corevo'
  if (input.channel === 'sms') {
    const result = await sendGiadaMessage({
      to: input.contact,
      message: `${tenantName}: Din verifieringskod är ${input.pin}. Koden gäller i 5 minuter.`,
      idempotencyKey: `outbox:${input.outboxId}`,
      expiresAt: input.expiresAt,
    })
    return result.ok
      ? { accepted: true, providerRef: `giada:${result.id}` }
      : { accepted: false, reason: result.reason }
  }

  const result = await sendEmail({
    to: input.contact,
    subject: `Din kod för bokningen hos ${tenantName}`,
    html: `<p>Din verifieringskod hos ${escapeHtml(tenantName)} är:</p>`
      + `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${input.pin}</p>`
      + '<p>Koden gäller i 5 minuter.</p>',
  })
  return result.ok
    ? { accepted: true, ...(result.id ? { providerRef: `email:${result.id}` } : {}) }
    : { accepted: false, reason: result.skipped ? 'transport_unavailable' : (result.error ?? 'transport_error') }
}
