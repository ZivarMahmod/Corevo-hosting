export type MaskedContact = {
  maskedEmail: string
  maskedPhone: string
  hasEmail: boolean
  hasPhone: boolean
}

/** Mask an email to the shared handoff convention. Safe in server/client code. */
export function maskEmail(email: string | null | undefined): string {
  if (!email || email === '—') return '—'
  return '•••••@•••'
}

/** Mask a phone number while preserving only the shared four-character prefix. */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || phone === '—') return '—'
  if (phone.length <= 4) return '••••'
  return `${phone.slice(0, 4)} •• •• ••`
}

/** Build the only contact shape allowed in initial platform client props. */
export function maskContact(
  email: string | null | undefined,
  phone: string | null | undefined,
): MaskedContact {
  const hasEmail = !!email && email !== '—'
  const hasPhone = !!phone && phone !== '—'
  return {
    maskedEmail: maskEmail(email),
    maskedPhone: maskPhone(phone),
    hasEmail,
    hasPhone,
  }
}
