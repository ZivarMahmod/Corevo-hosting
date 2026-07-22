import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CUSTOMER_PORTAL_KEY_VERSION,
  createPortalPublicId,
  createPortalSecret,
  portalLinkDigest,
  portalRecoveryCodeDigest,
  portalRecoveryContactDigest,
  portalRecoverySubjectDigest,
  portalSessionDigest,
} from './crypto'

const originalKey = process.env.CUSTOMER_PORTAL_HMAC_KEY

describe('customer portal crypto', () => {
  beforeEach(() => {
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CUSTOMER_PORTAL_HMAC_KEY
    else process.env.CUSTOMER_PORTAL_HMAC_KEY = originalKey
  })

  it('uses separate HMAC domains for link and session digests', async () => {
    const secret = 'A'.repeat(43)
    const link = await portalLinkDigest(secret)
    const session = await portalSessionDigest(secret)
    expect(link).toMatch(/^[a-f0-9]{64}$/)
    expect(session).toMatch(/^[a-f0-9]{64}$/)
    expect(link).not.toBe(session)
    expect(link).not.toContain(secret)
    expect(CUSTOMER_PORTAL_KEY_VERSION).toBe(1)
  })

  it('uses three dedicated recovery domains that cannot collide with portal credentials', async () => {
    const value = 'A'.repeat(43)
    const digests = await Promise.all([
      portalLinkDigest(value),
      portalSessionDigest(value),
      portalRecoverySubjectDigest(value),
      portalRecoveryContactDigest('sms', value),
      portalRecoveryCodeDigest('123e4567-e89b-42d3-a456-426614174000', '123456'),
    ])
    expect(new Set(digests)).toHaveLength(digests.length)
    expect(digests).toEqual(digests.map((digest) => expect.stringMatching(/^[a-f0-9]{64}$/)))
  })

  it('fails closed unless the dedicated key is at least 32 bytes', async () => {
    process.env.CUSTOMER_PORTAL_HMAC_KEY = 'å'.repeat(15)
    await expect(portalLinkDigest('secret')).rejects.toThrow('customer_portal_hmac_key_missing')
  })

  it('creates opaque 256-bit secrets and UUID public ids', () => {
    const first = createPortalSecret()
    const second = createPortalSecret()
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(second).not.toBe(first)
    expect(createPortalPublicId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
