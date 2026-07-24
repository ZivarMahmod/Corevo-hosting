export type BookingVerificationChannel = 'sms' | 'email'

export function normalizeBookingContact(
  channel: BookingVerificationChannel,
  raw: string,
): string | null {
  if (channel === 'email') {
    const email = raw.trim().toLowerCase()
    return email.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null
  }
  const cleaned = raw.replace(/[\s\-()]/g, '')
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned
  if (/^00\d{8,15}$/.test(cleaned)) return `+${cleaned.slice(2)}`
  if (/^0\d{8,9}$/.test(cleaned)) return `+46${cleaned.slice(1)}`
  return null
}

export function maskBookingContact(
  channel: BookingVerificationChannel,
  normalizedContact: string,
): string {
  if (channel === 'sms') return `${normalizedContact.slice(0, 3)} ••• •• ${normalizedContact.slice(-2)}`
  const [local, domain] = normalizedContact.split('@')
  return `${local?.slice(0, 1) ?? ''}•••@${domain ?? ''}`
}
