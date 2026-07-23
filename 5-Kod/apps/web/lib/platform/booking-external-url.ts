/** Normalise the optional external booking destination stored in settings JSON.
 * Only absolute HTTPS URLs are accepted; anything else fails closed to null. */
export function normalizeBookingExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const candidate = value.trim()
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' || !url.hostname) return null
    return candidate
  } catch {
    return null
  }
}
