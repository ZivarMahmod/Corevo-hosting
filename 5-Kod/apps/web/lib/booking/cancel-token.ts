import 'server-only'

// Guest self-service cancel CAPABILITY TOKEN (NOTIF-GUEST).
//
// A booking's manage link is emailed ONLY to the booker. The link carries an
// unguessable HMAC-SHA-256 token over the booking id; holding a valid token IS the
// authorisation to view/cancel that one booking — no login, no other booking
// exposed. The avboka page + action verify the token before touching anything via
// service-role.
//
// Web Crypto only (crypto.subtle) — runs on the Cloudflare Workers runtime; do NOT
// import node:crypto (it would break the bundle, like the SMTP note in email.ts).
//
// Key = SUPABASE_SERVICE_ROLE_KEY: server-only, already set in prod, never shipped
// to the browser. When it is unset (local/dev/CI) the token funcs FAIL SAFE:
// buildCancelToken returns '' (→ no link rendered, no manage URL), verify returns
// false (→ every cancel attempt is rejected). This degrades in lockstep with the
// service-role client the cancel flow needs anyway.

const ALG = { name: 'HMAC', hash: 'SHA-256' } as const

const enc = new TextEncoder()

/** Import the HMAC key from the service-role secret, or null when unconfigured. */
async function getKey(): Promise<CryptoKey | null> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return null
  try {
    return await crypto.subtle.importKey('raw', enc.encode(secret), ALG, false, ['sign', 'verify'])
  } catch {
    return null
  }
}

/** URL-safe base64 (RFC 4648 §5): +/ → -_ and strip padding, so it rides a query param. */
function toBase64Url(bytes: ArrayBuffer): string {
  const b = new Uint8Array(bytes)
  let bin = ''
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Decode a URL-safe base64 token back to bytes; null on malformed input. */
function fromBase64Url(token: string): Uint8Array<ArrayBuffer> | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const bin = atob(b64 + pad)
    const out = new Uint8Array(new ArrayBuffer(bin.length))
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

/**
 * Build the cancel token for a booking: base64url of HMAC-SHA-256(bookingId).
 * Returns '' (falsy) when no key is configured — callers then omit the manage link.
 */
export async function buildCancelToken(bookingId: string): Promise<string> {
  const key = await getKey()
  if (!key || !bookingId) return ''
  const sig = await crypto.subtle.sign(ALG, key, enc.encode(bookingId))
  return toBase64Url(sig)
}

/**
 * Constant-time verify of a cancel token against a booking id. Returns false on any
 * problem (no key, malformed token, mismatch). `crypto.subtle.verify` does the
 * constant-time compare for us, so no presented signature can be probed by timing.
 */
export async function verifyCancelToken(bookingId: string, token: string | null | undefined): Promise<boolean> {
  if (!token || !bookingId) return false
  const key = await getKey()
  if (!key) return false
  const sig = fromBase64Url(token)
  if (!sig) return false
  try {
    return await crypto.subtle.verify(ALG, key, sig, enc.encode(bookingId))
  } catch {
    return false
  }
}

/** The public manage/cancel URL the confirmation email links to. */
export function buildManageUrl(origin: string, bookingId: string, token: string): string {
  return `${origin}/avboka/${bookingId}?t=${encodeURIComponent(token)}`
}
