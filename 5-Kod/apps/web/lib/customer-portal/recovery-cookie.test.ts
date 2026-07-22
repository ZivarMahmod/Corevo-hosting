import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PORTAL_RECOVERY_COOKIE,
  PORTAL_RECOVERY_MAX_AGE_SECONDS,
  createPortalRecoveryCredential,
  parsePortalRecoveryCookie,
  portalRecoveryCookieOptions,
} from './recovery-cookie'

const originalKey = process.env.CUSTOMER_PORTAL_HMAC_KEY

describe('customer portal recovery cookie', () => {
  beforeEach(() => {
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CUSTOMER_PORTAL_HMAC_KEY
    else process.env.CUSTOMER_PORTAL_HMAC_KEY = originalKey
  })

  it('contains only version, challenge public id and a random subject secret', async () => {
    const credential = await createPortalRecoveryCredential()
    expect(parsePortalRecoveryCookie(credential.cookieValue)).toEqual({
      challengePublicId: credential.challengePublicId,
      subjectSecret: credential.subjectSecret,
      keyVersion: 1,
    })
    expect(credential.subjectDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(credential.cookieValue).not.toContain(credential.subjectDigest)
  })

  it('uses the exact five-minute host-only cookie contract', () => {
    expect(PORTAL_RECOVERY_COOKIE).toBe('__Host-corevo-portal-recovery')
    expect(PORTAL_RECOVERY_MAX_AGE_SECONDS).toBe(300)
    expect(portalRecoveryCookieOptions).toEqual({
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 300,
    })
    expect(portalRecoveryCookieOptions).not.toHaveProperty('domain')
  })

  it.each([
    null,
    '',
    'v1.bad.short',
    'v2.123e4567-e89b-42d3-a456-426614174000.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'v1.123e4567-e89b-42d3-a456-426614174000.short',
  ])('rejects malformed recovery cookies', (value) => {
    expect(parsePortalRecoveryCookie(value)).toBeNull()
  })
})
