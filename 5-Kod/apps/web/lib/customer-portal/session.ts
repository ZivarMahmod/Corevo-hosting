import 'server-only'
import {
  CUSTOMER_PORTAL_KEY_VERSION,
  createPortalPublicId,
  createPortalSecret,
  portalSessionDigest,
} from './crypto'
import { PORTAL_SECRET_PATTERN, PORTAL_UUID_PATTERN } from './link'

export const PORTAL_SESSION_COOKIE = '__Host-corevo-portal'
export const PORTAL_SESSION_MAX_AGE_SECONDS = 180 * 24 * 60 * 60

export const portalSessionCookieOptions = {
  secure: true,
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: PORTAL_SESSION_MAX_AGE_SECONDS,
}

export type PortalSessionCredential = {
  sessionPublicId: string
  secret: string
  secretDigest: string
  keyVersion: 1
  cookieValue: string
}

export async function createPortalSessionCredential(): Promise<PortalSessionCredential> {
  const sessionPublicId = createPortalPublicId()
  const secret = createPortalSecret()
  return {
    sessionPublicId,
    secret,
    secretDigest: await portalSessionDigest(secret),
    keyVersion: CUSTOMER_PORTAL_KEY_VERSION,
    cookieValue: `v${CUSTOMER_PORTAL_KEY_VERSION}.${sessionPublicId}.${secret}`,
  }
}

export function parsePortalSessionCookie(value: string | null | undefined): {
  sessionPublicId: string
  secret: string
  keyVersion: 1
} | null {
  if (!value) return null
  const match = /^v1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/i.exec(value)
  const sessionPublicId = match?.[1]
  const secret = match?.[2]
  if (!sessionPublicId || !secret || !PORTAL_UUID_PATTERN.test(sessionPublicId) || !PORTAL_SECRET_PATTERN.test(secret)) {
    return null
  }
  return { sessionPublicId: sessionPublicId.toLowerCase(), secret, keyVersion: 1 }
}
