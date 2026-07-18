const CLAIM_TOKEN = /^[A-Za-z0-9_-]{43}$/
const CLAIM_PATH = /^\/konto\/koppla\/([A-Za-z0-9_-]{43})$/

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function createCustomerClaimToken(): string {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

export async function hashCustomerClaimToken(token: string): Promise<string> {
  if (!CLAIM_TOKEN.test(token)) throw new Error('invalid_customer_claim_token')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function customerClaimPath(token: string): string {
  if (!CLAIM_TOKEN.test(token)) throw new Error('invalid_customer_claim_token')
  return `/konto/koppla/${token}`
}

export function isCustomerClaimPath(path: string | null | undefined): path is string {
  return typeof path === 'string' && CLAIM_PATH.test(path)
}

export function customerClaimTokenFromPath(path: string): string | null {
  return CLAIM_PATH.exec(path)?.[1] ?? null
}

/**
 * Claim links are bearer credentials. Production links therefore only leave
 * the server on the tenant's exact HTTPS origin and the default HTTPS port.
 * Plain HTTP remains available solely for local development/test hosts.
 */
export function isSafeCustomerClaimOrigin(
  value: string,
  allowedHosts: ReadonlySet<string>,
  allowLocal: boolean,
): boolean {
  try {
    const origin = new URL(value)
    if (origin.username || origin.password) return false

    const isLocal =
      allowLocal &&
      (origin.hostname === 'localhost' || origin.hostname.endsWith('.localhost'))
    if (isLocal) return origin.protocol === 'http:' || origin.protocol === 'https:'

    return (
      origin.protocol === 'https:' &&
      origin.port === '' &&
      allowedHosts.has(origin.hostname.toLowerCase())
    )
  } catch {
    return false
  }
}
