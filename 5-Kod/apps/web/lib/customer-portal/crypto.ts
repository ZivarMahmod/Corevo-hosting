import 'server-only'

export const CUSTOMER_PORTAL_KEY_VERSION = 1 as const

const encoder = new TextEncoder()

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function hmacKey(): ArrayBuffer {
  const configured = process.env.CUSTOMER_PORTAL_HMAC_KEY
  if (!configured) throw new Error('customer_portal_hmac_key_missing')

  const key = encoder.encode(configured)
  if (key.byteLength < 32) throw new Error('customer_portal_hmac_key_missing')
  return toArrayBuffer(key)
}

function base64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let output = ''

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1] ?? 0
    const third = bytes[index + 2] ?? 0
    const value = (first << 16) | (second << 8) | third

    output += alphabet[(value >>> 18) & 63]
    output += alphabet[(value >>> 12) & 63]
    if (index + 1 < bytes.length) output += alphabet[(value >>> 6) & 63]
    if (index + 2 < bytes.length) output += alphabet[value & 63]
  }

  return output
}

type PortalDigestDomain =
  | 'link'
  | 'session'
  | 'recovery-subject'
  | 'recovery-contact'
  | 'recovery-code'

async function digest(domain: PortalDigestDomain, secret: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    hmacKey(),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const message = `corevo:customer-portal:${domain}:v${CUSTOMER_PORTAL_KEY_VERSION}:${secret}`
  const signature = new Uint8Array(
    await globalThis.crypto.subtle.sign('HMAC', key, toArrayBuffer(encoder.encode(message))),
  )
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createPortalPublicId(): string {
  return globalThis.crypto.randomUUID()
}

export function createPortalSecret(): string {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

export function portalLinkDigest(secret: string): Promise<string> {
  return digest('link', secret)
}

export function portalSessionDigest(secret: string): Promise<string> {
  return digest('session', secret)
}

export function portalRecoverySubjectDigest(secret: string): Promise<string> {
  return digest('recovery-subject', secret)
}

export function portalRecoveryContactDigest(
  channel: 'sms' | 'email',
  normalizedContact: string,
): Promise<string> {
  return digest('recovery-contact', `${channel}:${normalizedContact}`)
}

export function portalRecoveryCodeDigest(challengePublicId: string, code: string): Promise<string> {
  return digest('recovery-code', `${challengePublicId}:${code}`)
}
