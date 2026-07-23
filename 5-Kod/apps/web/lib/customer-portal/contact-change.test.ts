import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createServiceClient: vi.fn(),
  sendGiadaMessage: vi.fn(),
  sendEmail: vi.fn(),
  getEvidence: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/notifications/giada', () => ({ sendGiadaMessage: mocks.sendGiadaMessage }))
vi.mock('@/lib/notifications/email', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('./profile', () => ({ getPortalContactChangeEvidence: mocks.getEvidence }))

import {
  finalizePortalContactChange,
  resendPortalContactChange,
  startPortalContactChange,
  submitPortalContactChangeDestination,
  verifyPortalContactChangeCurrent,
} from './contact-change'

const sessionId = '123e4567-e89b-42d3-a456-426614174000'
const flowId = '223e4567-e89b-42d3-a456-426614174000'
const sessionSecret = 'A'.repeat(43)
const flowSecret = 'B'.repeat(43)

function store(withFlow = false) {
  const values = new Map<string, string>([
    ['__Host-corevo-portal', `v1.${sessionId}.${sessionSecret}`],
  ])
  if (withFlow) values.set('__Host-corevo-portal-contact-change', `v1.${flowId}.${flowSecret}`)
  return {
    get: vi.fn((name: string) => values.has(name) ? { value: values.get(name) } : undefined),
    set: vi.fn(),
  }
}

describe('portal contact change orchestration', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockReset()
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
    process.env.BOOKING_PIN_PEPPER = 'abcdef0123456789abcdef0123456789'
    mocks.createServiceClient.mockReturnValue({ rpc })
    mocks.cookies.mockResolvedValue(store())
    mocks.sendGiadaMessage.mockResolvedValue({ ok: true, id: 7, created: true })
    mocks.sendEmail.mockResolvedValue({ ok: true, id: 'mail-7' })
    mocks.getEvidence.mockResolvedValue({
      outcome: 'ok', sessionPublicId: sessionId,
      secretDigest: 'a'.repeat(64), tenantName: 'FreshCut', channel: 'sms',
      destination: '+46729408522', contactDigest: 'b'.repeat(64),
      maskedDestination: '+46 ••• •• 22', actions: ['change_phone'],
    })
  })

  it('starts from the portal cookie only and sends current-contact PIN without returning raw PII', async () => {
    const cookie = store()
    mocks.cookies.mockResolvedValue(cookie)
    rpc.mockImplementationOnce(async (_name: string, args: Record<string, unknown>) => ({
      data: [{
        outcome: 'ready', flow_public_id: args.p_flow_public_id, channel: 'sms',
        delivery_destination: '+46729408522', masked_destination: '+46 ••• •• 22',
        tenant_name: 'FreshCut', expires_at: '2026-07-23T12:05:00.000Z',
      }], error: null,
    })).mockResolvedValueOnce({ data: 'ok', error: null })

    const result = await startPortalContactChange('change_phone')
    expect(result).toEqual({ outcome: 'sent', channel: 'sms', maskedDestination: '+46 ••• •• 22' })
    expect(JSON.stringify(result)).not.toContain('0729408522')
    expect(rpc.mock.calls[0]?.[0]).toBe('customer_portal_start_contact_change')
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty('p_tenant_id')
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty('p_customer_id')
    expect(rpc.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      p_current_destination: '+46729408522',
    }))
    expect(rpc.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      p_code_digest: rpc.mock.calls[0]?.[1].p_code_digest,
    }))
    const generatedFlowId = String(rpc.mock.calls[0]?.[1].p_flow_public_id)
    expect(mocks.sendGiadaMessage).toHaveBeenCalledWith(expect.objectContaining({
      to: '+46729408522',
      idempotencyKey: expect.stringMatching(
        new RegExp(`^portal-contact-change:${generatedFlowId}:current:[0-9a-f-]{36}$`),
      ),
    }))
    expect(cookie.set).toHaveBeenCalledWith(
      '__Host-corevo-portal-contact-change',
      expect.stringMatching(/^v1\.[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/),
      expect.objectContaining({ secure: true, httpOnly: true, sameSite: 'strict', path: '/' }),
    )
  })

  it('never accepts a current PIN without both session and flow cookies', async () => {
    await expect(verifyPortalContactChangeCurrent('123456')).resolves.toEqual({ outcome: 'expired' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('maps bounded verification outcomes and never sends PINs to RPC in cleartext', async () => {
    mocks.cookies.mockResolvedValue(store(true))
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'invalid', attempts_remaining: 3 }], error: null })
    await expect(verifyPortalContactChangeCurrent('123456')).resolves.toEqual({
      outcome: 'invalid', attemptsRemaining: 3,
    })
    expect(rpc.mock.calls[0]?.[1].p_code_digest).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(rpc.mock.calls[0]?.[1])).not.toContain('123456')
  })

  it('locks the new destination channel to the action stored by SQL and returns only its mask', async () => {
    mocks.cookies.mockResolvedValue(store(true))
    rpc.mockResolvedValueOnce({
      data: [{ outcome: 'ready', action: 'change_email' }], error: null,
    }).mockResolvedValueOnce({
      data: [{
        outcome: 'ready', channel: 'email', delivery_destination: 'ny@example.se',
        masked_destination: 'n•••@example.se', tenant_name: 'FreshCut',
        expires_at: '2026-07-23T12:05:00.000Z',
      }], error: null,
    }).mockResolvedValueOnce({ data: 'ok', error: null })

    const result = await submitPortalContactChangeDestination(' Ny@Example.se ')
    expect(result).toEqual({ outcome: 'sent', channel: 'email', maskedDestination: 'n•••@example.se' })
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ny@example.se' }))
    expect(JSON.stringify(result)).not.toContain('ny@example.se')
    expect(rpc.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      p_current_contact_digest: 'b'.repeat(64),
      p_current_destination: '+46729408522',
      p_new_destination: 'ny@example.se',
      p_new_contact_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_new_booking_contact_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    }))
    expect(rpc.mock.calls[2]?.[1]).toEqual(expect.objectContaining({
      p_code_digest: rpc.mock.calls[1]?.[1].p_code_digest,
    }))
  })

  it('rotates to a deterministic current-session credential only after atomic finalize succeeds', async () => {
    const cookie = store(true)
    mocks.cookies.mockResolvedValue(cookie)
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'completed', action: 'add_phone' }], error: null })

    await expect(finalizePortalContactChange('654321')).resolves.toEqual({
      outcome: 'success', action: 'add_phone',
    })
    expect(rpc.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      p_code_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_current_contact_digest: 'b'.repeat(64),
      p_current_destination: '+46729408522',
      p_new_session_public_id: flowId,
      p_new_session_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    }))
    expect(JSON.stringify(rpc.mock.calls[0]?.[1])).not.toContain('654321')
    expect(cookie.set).toHaveBeenCalledWith(
      '__Host-corevo-portal', expect.stringMatching(new RegExp(`^v1\.${flowId}\.`)),
      expect.objectContaining({ secure: true, httpOnly: true, sameSite: 'lax', path: '/' }),
    )
    expect(cookie.set).toHaveBeenCalledWith(
      '__Host-corevo-portal-contact-change', '', expect.objectContaining({ maxAge: 0 }),
    )
  })

  it('fails closed before finalization when the current exact contact can no longer be proven', async () => {
    mocks.cookies.mockResolvedValue(store(true))
    mocks.getEvidence.mockResolvedValueOnce({ outcome: 'unavailable' })
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'invalid', attempts_remaining: 0 }], error: null })

    await expect(finalizePortalContactChange('654321')).resolves.toEqual({
      outcome: 'invalid', attemptsRemaining: 0,
    })
    expect(rpc.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      p_current_contact_digest: '0'.repeat(64),
      p_current_destination: '',
    }))
  })

  it('sets no session cookie after rejected or undelivered final verification', async () => {
    const cookie = store(true)
    mocks.cookies.mockResolvedValue(cookie)
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'invalid', attempts_remaining: 2 }], error: null })
    await expect(finalizePortalContactChange('654321')).resolves.toEqual({
      outcome: 'invalid', attemptsRemaining: 2,
    })
    expect(cookie.set).not.toHaveBeenCalled()
  })

  it('resends a purpose-bound replacement code without exposing it or resetting attempts client-side', async () => {
    mocks.cookies.mockResolvedValue(store(true))
    rpc.mockResolvedValueOnce({
      data: [{
        outcome: 'ready', channel: 'sms', delivery_destination: '+46729408522',
        masked_destination: '+46 ••• •• 22', tenant_name: 'FreshCut',
        expires_at: '2026-07-23T12:05:00.000Z', retry_after_seconds: 30,
      }], error: null,
    }).mockResolvedValueOnce({ data: 'ok', error: null })

    await expect(resendPortalContactChange('current')).resolves.toEqual({
      outcome: 'sent', channel: 'sms', maskedDestination: '+46 ••• •• 22',
    })
    expect(rpc.mock.calls[0]?.[0]).toBe('customer_portal_resend_contact_change')
    expect(rpc.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      p_stage: 'current',
      p_current_contact_digest: 'b'.repeat(64),
      p_current_destination: '+46729408522',
      p_code_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    }))
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty('p_attempt_count')
    expect(rpc.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      p_code_digest: rpc.mock.calls[0]?.[1].p_code_digest,
    }))
    expect(mocks.sendGiadaMessage).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: expect.stringMatching(
        new RegExp(`^portal-contact-change:${flowId}:current:[0-9a-f-]{36}$`),
      ),
    }))
  })
})
