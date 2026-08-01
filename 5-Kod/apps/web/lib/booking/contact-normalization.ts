import { DEFAULT_TENANT_REGION } from '@/lib/tenant-region'

export type BookingVerificationChannel = 'sms' | 'email'

export function normalizeBookingContact(
  channel: BookingVerificationChannel,
  raw: string,
  countryCode = DEFAULT_TENANT_REGION.countryCode,
): string | null {
  if (channel === 'email') {
    const email = raw.trim().toLowerCase()
    return email.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null
  }
  if (countryCode !== 'SE') return null
  const cleaned = raw.replace(/[\s\-()]/g, '')
  if (/^\+46(?:70|72|73|76|79)\d{7}$/.test(cleaned)) return cleaned
  if (/^0046(?:70|72|73|76|79)\d{7}$/.test(cleaned)) return `+${cleaned.slice(2)}`
  if (/^0(?:70|72|73|76|79)\d{7}$/.test(cleaned)) return `+46${cleaned.slice(1)}`
  return null
}

export function maskBookingContact(
  channel: BookingVerificationChannel,
  normalizedContact: string,
  countryCode = DEFAULT_TENANT_REGION.countryCode,
): string {
  if (channel === 'sms') {
    const e164 = normalizeBookingContact('sms', normalizedContact, countryCode)
    return e164
      ? `0${e164.slice(3, 5)} ••• •• ${e164.slice(-2)}`
      : `••• •• ${normalizedContact.slice(-2)}`
  }
  const [local, domain] = normalizedContact.split('@')
  return `${local?.slice(0, 1) ?? ''}•••@${domain ?? ''}`
}
