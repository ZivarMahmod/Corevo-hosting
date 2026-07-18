// bookings.note is the customer's free-text message, never a contact store.
// Before the customers table existed, public bookings encoded contact as:
//   Gäst: <name> <<email>> <phone> — <message>
// Keep old rows useful without ever returning that contact prefix to a UI/export.

const LEGACY_GUEST_CONTACT =
  /^Gäst:\s*[^<\r\n]+?\s*<[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+>\s*(?:[+\d][+\d() .-]{3,})?(?:\s+—\s+(.+))?$/i

export function sanitizeBookingNote(
  note: string | null | undefined,
): string | null {
  const value = note?.trim()
  if (!value) return null
  const legacy = LEGACY_GUEST_CONTACT.exec(value)
  if (!legacy) return value
  const message = legacy[1]?.trim()
  return message || null
}
