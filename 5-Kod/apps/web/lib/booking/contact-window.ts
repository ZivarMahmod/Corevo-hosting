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
