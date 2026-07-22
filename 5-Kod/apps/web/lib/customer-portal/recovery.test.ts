import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createServiceClient: vi.fn(),
  checkRateLimitFailClosed: vi.fn(),
  after: vi.fn(),
  dispatchPortalRecoveryOutboxById: vi.fn(),
  sendGiadaMessage: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/security/rate-limit', async (load) => {
  const actual = await load<typeof import('@/lib/security/rate-limit')>()
  return { ...actual, checkRateLimitFailClosed: mocks.checkRateLimitFailClosed }
})
vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('./recovery-delivery', () => ({
  dispatchPortalRecoveryOutboxById: mocks.dispatchPortalRecoveryOutboxById,
}))
vi.mock('@/lib/notifications/giada', () => ({ sendGiadaMessage: mocks.sendGiadaMessage }))
vi.mock('@/lib/notifications/email', () => ({ sendEmail: mocks.sendEmail }))

import {
  getPortalRecoveryState,
  normalizePortalRecoveryLookup,
  resendPortalRecovery,
  startPortalRecovery,
  verifyPortalRecovery,
} from './recovery'

const tenantSlug = 'freshcut'
const challengePublicId = '123e4567-e89b-42d3-a456-426614174000'
const sessionPublicIdPattern = '[0-9a-f-]{36}'

function cookieStore(recovery?: string) {
  const values = new Map<string, string>()
  if (recovery) values.set('__Host-corevo-portal-recovery', recovery)
  return {
    get: vi.fn((name: string) => values.has(name) ? { value: values.get(name) } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }
}

describe('portal recovery orchestration', () => {
  const rpc = vi.fn()
  const afterCallbacks: Array<() => Promise<void>> = []

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
    process.env.BOOKING_PIN_PEPPER = 'abcdef0123456789abcdef0123456789'
    mocks.checkRateLimitFailClosed.mockResolvedValue(true)
    mocks.after.mockImplementation((callback: () => Promise<void>) => afterCallbacks.push(callback))
    mocks.dispatchPortalRecoveryOutboxById.mockResolvedValue(undefined)
    mocks.createServiceClient.mockReturnValue({ rpc })
    mocks.cookies.mockResolvedValue(cookieStore())
    mocks.sendGiadaMessage.mockResolvedValue({ ok: true, id: 7, created: true })
    mocks.sendEmail.mockResolvedValue({ ok: true, id: 'mail-7' })
    afterCallbacks.length = 0
  })

  it('selects exactly one normalized channel from a single lookup', () => {
    expect(normalizePortalRecoveryLookup('  KUND@EXEMPEL.SE ')).toEqual({
      channel: 'email', normalized: 'kund@exempel.se',
    })
    expect(normalizePortalRecoveryLookup('072 940 85 22')).toEqual({
      channel: 'sms', normalized: '+46729408522',
    })
    expect(normalizePortalRecoveryLookup('not-a-contact')).toBeNull()
  })

  it('returns before delivery and gives known and decoy the same public/RPC path', async () => {
    rpc.mockImplementationOnce(async (_name: string, args: Record<string, unknown>) => ({
      data: [{
        outcome: 'accepted', challenge_public_id: args.p_public_id, created: true,
        outbox_id: '223e4567-e89b-42d3-a456-426614174000',
      }],
      error: null,
    }))

    const known = await startPortalRecovery({ tenantSlug, lookup: '0729408522', ip: '203.0.113.1' })
    expect(known).toEqual({ state: 'accepted' })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['customer_portal_start_recovery'])
    expect(mocks.sendGiadaMessage).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.dispatchPortalRecoveryOutboxById).not.toHaveBeenCalled()
    expect(afterCallbacks).toHaveLength(1)
    await afterCallbacks[0]!()
    expect(mocks.dispatchPortalRecoveryOutboxById).toHaveBeenCalledWith(
      '223e4567-e89b-42d3-a456-426614174000',
    )

    vi.clearAllMocks()
    mocks.checkRateLimitFailClosed.mockResolvedValue(true)
    mocks.after.mockImplementation((callback: () => Promise<void>) => afterCallbacks.push(callback))
    mocks.createServiceClient.mockReturnValue({ rpc })
    mocks.cookies.mockResolvedValue(cookieStore())
    rpc.mockImplementationOnce(async (_name: string, args: Record<string, unknown>) => ({
      data: [{
        outcome: 'accepted', challenge_public_id: args.p_public_id, created: true,
        outbox_id: '323e4567-e89b-42d3-a456-426614174000',
      }],
      error: null,
    }))

    const unknown = await startPortalRecovery({ tenantSlug, lookup: '0700000000', ip: '203.0.113.1' })
    expect(unknown).toEqual(known)
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['customer_portal_start_recovery'])
    expect(mocks.sendGiadaMessage).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('keeps the durable outbox as truth if the optional accelerator cannot register', async () => {
    mocks.after.mockImplementation(() => { throw new Error('no request context') })
    rpc.mockImplementationOnce(async (_name: string, args: Record<string, unknown>) => ({
      data: [{
        outcome: 'accepted', challenge_public_id: args.p_public_id, created: true,
        outbox_id: '223e4567-e89b-42d3-a456-426614174000',
      }],
      error: null,
    }))

    await expect(startPortalRecovery({ tenantSlug, lookup: '0729408522', ip: '203.0.113.1' }))
      .resolves.toEqual({ state: 'accepted' })
    expect(mocks.dispatchPortalRecoveryOutboxById).not.toHaveBeenCalled()
  })

  it('checks both start buckets and fails closed before database or transport work', async () => {
    mocks.checkRateLimitFailClosed.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    await expect(startPortalRecovery({ tenantSlug, lookup: '0729408522', ip: '203.0.113.1' }))
      .resolves.toEqual({ state: 'max_attempts' })
    expect(mocks.checkRateLimitFailClosed).toHaveBeenCalledTimes(2)
    expect(mocks.checkRateLimitFailClosed.mock.calls.map(([key]) => key)).toEqual([
      'portal-recovery-start-ip:freshcut:203.0.113.1',
      expect.stringMatching(/^portal-recovery-start-contact:freshcut:[a-f0-9]{64}$/),
    ])
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns an explicit neutral cooldown state without replacing the existing credential', async () => {
    const store = cookieStore(`v1.${challengePublicId}.${'A'.repeat(43)}`)
    mocks.cookies.mockResolvedValue(store)
    rpc.mockResolvedValueOnce({
      data: [{
        outcome: 'cooldown', challenge_public_id: null, created: false,
        should_deliver: false, channel: 'sms', delivery_destination: null,
        tenant_name: 'FreshCut',
      }],
      error: null,
    })
    await expect(startPortalRecovery({ tenantSlug, lookup: '0729408522', ip: '203.0.113.1' }))
      .resolves.toEqual({ state: 'cooldown' })
    expect(store.set).not.toHaveBeenCalled()
  })

  it('resends from the credential only and queues the same asynchronous path', async () => {
    const oldSecret = 'A'.repeat(43)
    const store = cookieStore(`v1.${challengePublicId}.${oldSecret}`)
    mocks.cookies.mockResolvedValue(store)
    rpc.mockImplementationOnce(async (_name: string, args: Record<string, unknown>) => ({
      data: [{
        outcome: 'accepted', challenge_public_id: args.p_new_public_id, created: true,
        outbox_id: '423e4567-e89b-42d3-a456-426614174000',
      }],
      error: null,
    }))

    await expect(resendPortalRecovery({ tenantSlug, ip: '203.0.113.1' }))
      .resolves.toEqual({ state: 'accepted' })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['customer_portal_resend_recovery'])
    expect(rpc.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      p_challenge_public_id: challengePublicId,
      p_subject_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_new_public_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      p_new_subject_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_new_code_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    }))
    expect(afterCallbacks).toHaveLength(1)
  })

  it('returns only CP-VER-02 state without channel, mask or recipient delivery status', async () => {
    const store = cookieStore(`v1.${challengePublicId}.${'A'.repeat(43)}`)
    mocks.cookies.mockResolvedValue(store)
    rpc.mockResolvedValue({
      data: [{
        outcome: 'sent', channel: null, masked_contact: null,
        attempts_remaining: 5, tenant_slug: tenantSlug, resend_after: '2026-07-22T18:00:00.000Z',
      }],
      error: null,
    })
    await expect(getPortalRecoveryState({ tenantSlug })).resolves.toEqual({
      state: 'sent',
      attemptsRemaining: 5, resendAfter: '2026-07-22T18:00:00.000Z',
    })
  })

  it('maps internal provider failure to the same neutral CP-VER-02 state', async () => {
    const store = cookieStore(`v1.${challengePublicId}.${'A'.repeat(43)}`)
    mocks.cookies.mockResolvedValue(store)
    rpc.mockResolvedValue({
      data: [{
        outcome: 'sent', channel: null, masked_contact: null,
        attempts_remaining: 5, tenant_slug: tenantSlug, resend_after: '2026-07-22T18:00:00.000Z',
      }],
      error: null,
    })
    await expect(getPortalRecoveryState({ tenantSlug })).resolves.toEqual({
      state: 'sent',
      attemptsRemaining: 5, resendAfter: '2026-07-22T18:00:00.000Z',
    })
  })

  it('sets the ordinary portal cookie only after atomic verification succeeds', async () => {
    const recoverySecret = 'A'.repeat(43)
    const store = cookieStore(`v1.${challengePublicId}.${recoverySecret}`)
    mocks.cookies.mockResolvedValue(store)
    rpc.mockResolvedValueOnce({
      data: [{ outcome: 'verified', attempts_remaining: 5, tenant_slug: tenantSlug }],
      error: null,
    })

    await expect(verifyPortalRecovery({ tenantSlug, code: '589511', ip: '203.0.113.1' }))
      .resolves.toEqual({ ok: true })
    expect(rpc).toHaveBeenCalledWith('customer_portal_verify_recovery_and_mint_session', {
      p_challenge_public_id: challengePublicId,
      p_subject_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_code_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_new_session_public_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      p_new_session_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_key_version: 1,
    })
    expect(store.set).toHaveBeenCalledWith(
      '__Host-corevo-portal',
      expect.stringMatching(new RegExp(`^v1\\.${sessionPublicIdPattern}\\.`)),
      expect.objectContaining({ secure: true, httpOnly: true, sameSite: 'lax', path: '/' }),
    )
    expect(store.set).toHaveBeenCalledWith(
      '__Host-corevo-portal-recovery',
      '',
      { secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 },
    )
  })

  it('sets no portal cookie when verification is rejected or delivery was not recorded', async () => {
    const store = cookieStore(`v1.${challengePublicId}.${'A'.repeat(43)}`)
    mocks.cookies.mockResolvedValue(store)
    rpc.mockResolvedValue({
      data: [{ outcome: 'invalid', attempts_remaining: 5, tenant_slug: null }],
      error: null,
    })
    await expect(verifyPortalRecovery({ tenantSlug, code: '589511', ip: '203.0.113.1' }))
      .resolves.toEqual({ ok: false, reason: 'invalid', attemptsRemaining: 5 })
    expect(store.set).not.toHaveBeenCalled()
  })
})

afterEach(() => vi.restoreAllMocks())
