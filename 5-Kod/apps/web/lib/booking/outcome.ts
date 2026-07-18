export type BookingOutcome = 'upcoming' | 'unresolved' | 'completed' | 'no_show' | 'cancelled'

const ACTIVE = new Set(['pending', 'confirmed'])

/** Ett besök kan först få ett utfall när hela den bokade tiden har passerat. */
export function isOutcomeReady(endTs: string, now = new Date()): boolean {
  const end = new Date(endTs).getTime()
  return Number.isFinite(end) && end <= now.getTime()
}

/** Gemensam läsmodell för kund-, admin- och personalytor. Ingen status härleds. */
export function classifyBookingOutcome(
  status: string,
  endTs: string,
  now = new Date(),
): BookingOutcome {
  if (status === 'completed' || status === 'no_show' || status === 'cancelled') return status
  if (ACTIVE.has(status)) return isOutcomeReady(endTs, now) ? 'unresolved' : 'upcoming'
  return 'unresolved'
}
