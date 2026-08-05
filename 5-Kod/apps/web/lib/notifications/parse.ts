// Pure parser for the legacy guest-contact note seam: bookings.note can hold
// `Gäst: <name> <email> <phone> [— note]` until a customers table exists. The
// payment webhook can still need the recipient for an old booking without a
// linked customer. Kept dependency-free so it is unit-testable in Vitest.

export function parseGuestEmail(note: string | null | undefined): string | null {
  if (!note) return null
  const m = /<([^@\s<>]+@[^@\s<>]+\.[^@\s<>]+)>/.exec(note)
  return m?.[1] ?? null
}
