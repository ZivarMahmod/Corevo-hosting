import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PORTAL_SESSION_COOKIE,
  PORTAL_SESSION_MAX_AGE_SECONDS,
  createPortalSessionCredential,
  parsePortalSessionCookie,
  portalSessionCookieOptions,
} from './session'

const originalKey = process.env.CUSTOMER_PORTAL_HMAC_KEY

describe('customer portal session cookie', () => {
  beforeEach(() => {
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CUSTOMER_PORTAL_HMAC_KEY
    else process.env.CUSTOMER_PORTAL_HMAC_KEY = originalKey
  })

  it('creates a public-id + raw-secret cookie while exposing only its digest to DB', async () => {
    const credential = await createPortalSessionCredential()
    expect(parsePortalSessionCookie(credential.cookieValue)).toEqual({
      sessionPublicId: credential.sessionPublicId,
      secret: credential.secret,
      keyVersion: 1,
    })
    expect(credential.secretDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(credential.secretDigest).not.toContain(credential.secret)
  })

  it('locks the cookie to the host with the exact 180-day contract', () => {
    expect(PORTAL_SESSION_COOKIE).toBe('__Host-corevo-portal')
    expect(PORTAL_SESSION_MAX_AGE_SECONDS).toBe(180 * 24 * 60 * 60)
    expect(portalSessionCookieOptions).toEqual({
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 180 * 24 * 60 * 60,
    })
    expect(portalSessionCookieOptions).not.toHaveProperty('domain')
  })

  it.each([null, '', 'v1.bad.short', 'v1.123e4567-e89b-42d3-a456-426614174000.short'])
    ('strictly rejects malformed cookie values', (value) => {
      expect(parsePortalSessionCookie(value)).toBeNull()
    })
})
