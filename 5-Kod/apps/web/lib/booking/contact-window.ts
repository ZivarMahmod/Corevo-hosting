export const CONTACT_BEFORE_HOURS = 720
export const CONTACT_AFTER_HOURS = 24

export function contactWindowBounds(now: Date = new Date()): {
  fromUtc: string
  toUtc: string
} {
  return {
    fromUtc: new Date(now.getTime() - CONTACT_BEFORE_HOURS * 60 * 60 * 1000).toISOString(),
    toUtc: new Date(now.getTime() + CONTACT_AFTER_HOURS * 60 * 60 * 1000).toISOString(),
  }
}

export function isWithinContactWindow(startISO: string, now: Date = new Date()): boolean {
  const value = new Date(startISO).getTime()
  if (!Number.isFinite(value)) return false
  const from = now.getTime() - CONTACT_BEFORE_HOURS * 60 * 60 * 1000
  const to = now.getTime() + CONTACT_AFTER_HOURS * 60 * 60 * 1000
  return value >= from && value <= to
}
