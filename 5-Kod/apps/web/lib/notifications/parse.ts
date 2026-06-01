// Pure parsers for the guest-contact note seam (G04): bookings.note holds
// `Gäst: <name> <email> <phone> [— note]` until a customers table exists. The
// webhook + reminder pipeline pull the recipient back out of it. Kept dependency-
// free (no 'server-only') so it is unit-testable in the node vitest environment.

export function parseGuestEmail(note: string | null | undefined): string | null {
  if (!note) return null
  const m = /<([^@\s<>]+@[^@\s<>]+\.[^@\s<>]+)>/.exec(note)
  return m?.[1] ?? null
}

export function parseGuestName(note: string | null | undefined): string | null {
  if (!note) return null
  const m = /Gäst:\s*([^<]+?)\s*</.exec(note)
  return m?.[1]?.trim() ?? null
}
