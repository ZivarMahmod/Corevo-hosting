import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ cookies: vi.fn(), createServiceClient: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import {
  getPortalProfileSnapshot,
  normalizePortalCustomerName,
  updatePortalCustomerName,
} from './profile'
import {
  bookingContactDigest,
  maskBookingContact,
} from '@/lib/booking/verification'

const originalKey = process.env.CUSTOMER_PORTAL_HMAC_KEY
const sessionId = '123e4567-e89b-42d3-a456-426614174000'
const secret = 'A'.repeat(43)

afterAll(() => {
  if (originalKey === undefined) delete process.env.CUSTOMER_PORTAL_HMAC_KEY
  else process.env.CUSTOMER_PORTAL_HMAC_KEY = originalKey
})

describe('portal profile name', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
    process.env.BOOKING_PIN_PEPPER = 'abcdef0123456789abcdef0123456789'
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: `v1.${sessionId}.${secret}` })),
    })
    mocks.createServiceClient.mockReturnValue({ rpc })
  })

  it('trims, NFC-normalizes and rejects blank, control, replacement and out-of-range names', () => {
    expect(normalizePortalCustomerName('  A\u030Asa  ')).toBe('Åsa')
    expect(normalizePortalCustomerName(' A ')).toBeNull()
    expect(normalizePortalCustomerName(' '.repeat(10))).toBeNull()
    expect(normalizePortalCustomerName(`Anna\nTest`)).toBeNull()
    expect(normalizePortalCustomerName('Anna\u200bTest')).toBeNull()
    expect(normalizePortalCustomerName('Anna\u202eTest')).toBeNull()
    expect(normalizePortalCustomerName('Anna\ue000Test')).toBeNull()
    expect(normalizePortalCustomerName('A\u0378')).toBeNull()
    expect(normalizePortalCustomerName('A\ufdd0')).toBeNull()
    expect(normalizePortalCustomerName('अनन्या शर्मा')).toBe('अनन्या शर्मा')
    expect(normalizePortalCustomerName('Anna 😀 Test')).toBe('Anna 😀 Test')
    expect(normalizePortalCustomerName('A\u088f')).toBe('A\u088f')
    expect(normalizePortalCustomerName('Anna\ufffdTest')).toBeNull()
    expect(normalizePortalCustomerName('A'.repeat(121))).toBeNull()
  })

  it('binds proof to the exact current contact digest, never a colliding presentation mask', async () => {
    const currentPhone = '+46700000001'
    const historicalPhone = '+46799999901'
    const currentEmail = 'adam@example.se'
    const historicalEmail = 'anna@example.se'
    expect(maskBookingContact('sms', historicalPhone)).toBe(maskBookingContact('sms', currentPhone))
    expect(maskBookingContact('email', historicalEmail)).toBe(maskBookingContact('email', currentEmail))
    const currentPhoneDigest = await bookingContactDigest('sms', currentPhone)
    const historicalPhoneDigest = await bookingContactDigest('sms', historicalPhone)
    const currentEmailDigest = await bookingContactDigest('email', currentEmail)
    const historicalEmailDigest = await bookingContactDigest('email', historicalEmail)

    const baseEvidence = {
      tenantSlug: 'freshcut', tenantName: 'FreshCut', customerName: 'Zivar',
      phone: currentPhone, email: currentEmail,
    }
    rpc.mockResolvedValueOnce({
      data: [{ outcome: 'ok', profile: {
        ...baseEvidence,
        proofs: [{
          channel: 'sms', contactDigest: historicalPhoneDigest,
          maskedDestination: maskBookingContact('sms', historicalPhone), maskValid: true,
        }],
      }, recovery_tenant_slug: null }], error: null,
    })
    await expect(getPortalProfileSnapshot()).resolves.toEqual({ outcome: 'unavailable' })

    rpc.mockResolvedValueOnce({
      data: [{ outcome: 'ok', profile: {
        ...baseEvidence,
        proofs: [
          {
            channel: 'sms', contactDigest: currentPhoneDigest,
            maskedDestination: maskBookingContact('sms', currentPhone), maskValid: true,
          },
          {
            channel: 'email', contactDigest: historicalEmailDigest,
            maskedDestination: maskBookingContact('email', historicalEmail), maskValid: true,
          },
        ],
      }, recovery_tenant_slug: null }], error: null,
    })
    await expect(getPortalProfileSnapshot()).resolves.toMatchObject({
      outcome: 'ok',
      profile: {
        verifiedContact: { channel: 'sms', maskedDestination: '+46 ••• •• 01' },
        secondaryContact: { channel: 'email', maskedDestination: 'a•••@example.se', verified: false },
      },
    })

    rpc.mockResolvedValueOnce({
      data: [{ outcome: 'ok', profile: {
        ...baseEvidence,
        proofs: [
          {
            channel: 'sms', contactDigest: currentPhoneDigest,
            maskedDestination: maskBookingContact('sms', currentPhone), maskValid: true,
          },
          {
            channel: 'email', contactDigest: currentEmailDigest,
            maskedDestination: maskBookingContact('email', currentEmail), maskValid: true,
          },
        ],
      }, recovery_tenant_slug: null }], error: null,
    })
    await expect(getPortalProfileSnapshot()).resolves.toMatchObject({
      outcome: 'ok', profile: { secondaryContact: { verified: true } },
    })
  })

  it('sends only cookie-bound session proof and the normalized name to the dedicated RPC', async () => {
    rpc.mockResolvedValue({ data: 'ok', error: null })
    await expect(updatePortalCustomerName('  A\u030Asa Test  ')).resolves.toEqual({
      outcome: 'success', name: 'Åsa Test',
    })
    expect(rpc).toHaveBeenCalledWith('customer_portal_update_name', {
      p_session_public_id: sessionId,
      p_secret_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_display_name: 'Åsa Test',
    })
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(secret)
  })

  it('accepts only closed server evidence and never returns its raw contact', async () => {
    const email = 'zivar@example.se'
    const digest = await bookingContactDigest('email', email)
    const base = {
      tenantSlug: 'freshcut', tenantName: 'FreshCut', customerName: 'Zivar',
      phone: null, email,
      proofs: [{
        channel: 'email', contactDigest: digest,
        maskedDestination: 'z•••@example.se', maskValid: true,
      }],
    }
    rpc.mockResolvedValueOnce({
      data: [{ outcome: 'ok', profile: base, recovery_tenant_slug: null }], error: null,
    })
    const result = await getPortalProfileSnapshot()
    expect(result).toEqual({
      outcome: 'ok', profile: {
        tenantSlug: 'freshcut', tenantName: 'FreshCut', customerName: 'Zivar',
        verifiedContact: { channel: 'email', maskedDestination: 'z•••@example.se' },
        secondaryContact: null,
        contactChangeActions: ['add_phone', 'change_email'],
      },
    })
    expect(JSON.stringify(result)).not.toContain(email)
    expect(rpc).toHaveBeenCalledWith('customer_portal_profile_snapshot', {
      p_session_public_id: sessionId,
      p_secret_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    })

    for (const profile of [
      { ...base, raw: email },
      { ...base, phone: 123 },
      { ...base, proofs: [{ ...base.proofs[0], raw: email }] },
      { ...base, proofs: [{ ...base.proofs[0], channel: 'phone' }] },
      { ...base, proofs: [{ ...base.proofs[0], contactDigest: 'x'.repeat(64) }] },
      { ...base, proofs: [{ ...base.proofs[0], maskValid: 'yes' }] },
      { ...base, proofs: [{ ...base.proofs[0], maskValid: false }] },
      { ...base, proofs: [{ ...base.proofs[0], maskedDestination: 'z•••@exam\u200bple.se' }] },
      { ...base, proofs: Array.from({ length: 257 }, () => base.proofs[0]) },
      {
        tenantSlug: 'freshcut', tenantName: 'FreshCut', customerName: 'Zivar',
        secondaryContact: null,
        verifiedContact: { channel: 'email', maskedDestination: 'z•••@example.se' },
      },
    ]) {
      rpc.mockResolvedValueOnce({
        data: [{ outcome: 'ok', profile, recovery_tenant_slug: null }],
        error: null,
      })
      await expect(getPortalProfileSnapshot()).resolves.toEqual({ outcome: 'unavailable' })
    }
  })

  it('maps profile expiry and malformed server rows to neutral closed outcomes', async () => {
    rpc.mockResolvedValueOnce({
      data: [{ outcome: 'expired', profile: null, recovery_tenant_slug: 'freshcut' }], error: null,
    })
    await expect(getPortalProfileSnapshot()).resolves.toEqual({
      outcome: 'expired', recoveryTenantSlug: 'freshcut',
    })
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'unavailable', profile: null }], error: null })
    await expect(getPortalProfileSnapshot()).resolves.toEqual({ outcome: 'unavailable' })

    mocks.createServiceClient.mockReturnValue(null)
    await expect(getPortalProfileSnapshot()).resolves.toEqual({ outcome: 'unavailable' })
  })

  it('fails closed before the RPC for invalid input or absent session and neutralizes backend errors', async () => {
    await expect(updatePortalCustomerName('X')).resolves.toEqual({ outcome: 'invalid' })
    expect(rpc).not.toHaveBeenCalled()

    mocks.cookies.mockResolvedValue({ get: vi.fn(() => undefined) })
    await expect(updatePortalCustomerName('Alex Test')).resolves.toEqual({ outcome: 'expired' })
    expect(rpc).not.toHaveBeenCalled()

    mocks.cookies.mockResolvedValue({ get: vi.fn(() => ({ value: `v1.${sessionId}.${secret}` })) })
    rpc.mockResolvedValue({ data: 'invalid', error: null })
    await expect(updatePortalCustomerName('Alex Test')).resolves.toEqual({ outcome: 'invalid' })
    rpc.mockResolvedValue({ data: 'expired', error: null })
    await expect(updatePortalCustomerName('Alex Test')).resolves.toEqual({ outcome: 'expired' })
    rpc.mockRejectedValue(new Error('db details must stay server-side'))
    await expect(updatePortalCustomerName('Alex Test')).resolves.toEqual({ outcome: 'unavailable' })
  })
})
