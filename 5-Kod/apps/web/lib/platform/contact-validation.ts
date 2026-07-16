const EMAIL_MAX = 200
const SOCIAL_URL_MAX = 300
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const SOCIAL_URL_RE = /^https?:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?:[/?#][^\s]*)?$/i

const length = (value: string): number => Array.from(value).length

/** Empty means clear (`null`); malformed means reject (`undefined`). */
export function normalizeContactEmail(value: unknown): string | null | undefined {
  if (value !== null && value !== undefined && typeof value !== 'string') return undefined
  const email = typeof value === 'string' ? value.trim() : ''
  if (!email) return null
  return length(email) <= EMAIL_MAX && EMAIL_RE.test(email) ? email : undefined
}

/** Empty means clear (`null`); host-only links gain https; malformed means reject. */
export function normalizeSocialUrl(value: unknown): string | null | undefined {
  if (value !== null && value !== undefined && typeof value !== 'string') return undefined
  let url = typeof value === 'string' ? value.trim() : ''
  if (!url) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    if (!/^https?:\/\//i.test(url)) return undefined
  } else {
    url = `https://${url}`
  }
  return length(url) <= SOCIAL_URL_MAX && SOCIAL_URL_RE.test(url) ? url : undefined
}
