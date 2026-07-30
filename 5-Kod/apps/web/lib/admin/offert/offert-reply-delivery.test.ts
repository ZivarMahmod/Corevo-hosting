import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaimedNotificationOutboxRow } from '@/lib/notifications/outbox'

const mocks = vi.hoisted(() => ({
  moduleCtx: vi.fn(),
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  dispatchNotificationOutboxById: vi.fn(),
  sendOffertReplyEmail: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTenant: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/admin/module-ctx', () => ({ moduleCtx: mocks.moduleCtx }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/admin/tenant', () => ({ revalidateTenant: mocks.revalidateTenant }))
vi.mock('@/lib/notifications/outbox', async (load) => {
  const actual = await load<typeof import('@/lib/notifications/outbox')>()
  return {
    ...actual,
    dispatchNotificationOutboxById: mocks.dispatchNotificationOutboxById,
  }
})
vi.mock('@/lib/notifications/offert', () => ({
  sendOffertReplyEmail: mocks.sendOffertReplyEmail,
}))
vi.mock('@/lib/observability', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { sendOffertReply } from './actions'
import { deliverImmediateOffertOutbox } from './reply-delivery'

const tenantId = '123e4567-e89b-42d3-a456-426614174001'
const requestId = '123e4567-e89b-42d3-a456-426614174002'
const outboxId = '123e4567-e89b-42d3-a456-426614174003'
const leaseToken = '123e4567-e89b-42d3-a456-426614174004'

function replyForm(reply = 'Här är vårt svar.') {
  const fd = new FormData()
  fd.set('id', requestId)
  fd.set('lifecycleVersion', '7')
  fd.set('reply', reply)
  return fd
}

function dispatchRun(overrides: Record<string, number> = {}) {
  return {
    claimed: 1,
    sent: 1,
    simulated: 0,
    skipped: 0,
    retried: 0,
    failed: 0,
    stale: 0,
    ...overrides,
  }
}

describe('durable offert reply action', () => {
  const authenticatedRpc = vi.fn()
  const serviceRpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.moduleCtx.mockResolvedValue({
      tenant: { id: tenantId, slug: 'goal92', name: 'Goal 92' },
    })
    mocks.createClient.mockResolvedValue({ rpc: authenticatedRpc })
    mocks.createServiceClient.mockReturnValue({ rpc: serviceRpc })
    authenticatedRpc.mockResolvedValue({
      data: [{
        outcome: 'queued',
        outbox_id: outboxId,
        version: 8,
        delivery_state: 'pending',
      }],
      error: null,
    })
    mocks.dispatchNotificationOutboxById.mockResolvedValue(dispatchRun())
    serviceRpc.mockResolvedValue({
      data: [{
        outcome: 'sent',
        offert_status: 'quoted',
        version: 9,
        delivery_state: 'sent',
        error_code: null,
      }],
      error: null,
    })
  })

  it('runs enqueue -> exact dispatch -> DB finalize before reporting sent', async () => {
    await expect(sendOffertReply({}, replyForm())).resolves.toEqual({
      success: 'Svaret är skickat till kunden.',
    })
    expect(authenticatedRpc).toHaveBeenCalledWith('enqueue_offert_reply', {
      p_tenant: tenantId,
      p_request: requestId,
      p_expected_version: 7,
      p_reply: 'Här är vårt svar.',
    })
    expect(mocks.dispatchNotificationOutboxById).toHaveBeenCalledWith(
      outboxId,
      deliverImmediateOffertOutbox,
    )
    expect(serviceRpc).toHaveBeenCalledWith('finalize_offert_reply', {
      p_tenant: tenantId,
      p_request: requestId,
      p_outbox: outboxId,
    })
  })

  it('can finalize a provider ack after the dispatch response was lost', async () => {
    mocks.dispatchNotificationOutboxById.mockRejectedValue(new Error('response_lost'))
    await expect(sendOffertReply({}, replyForm())).resolves.toMatchObject({
      success: expect.stringContaining('skickat'),
    })
    expect(serviceRpc).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['pending', null],
    ['failed', 'payload_invalid'],
    ['already_failed', 'delivery_uncertain'],
  ])('never presents finalize outcome %s as sent', async (outcome, errorCode) => {
    serviceRpc.mockResolvedValue({
      data: [{
        outcome,
        offert_status: 'new',
        version: 9,
        delivery_state: outcome === 'pending' ? 'pending' : 'failed',
        error_code: errorCode,
      }],
      error: null,
    })
    const result = await sendOffertReply({}, replyForm())
    expect(result.success).toBeUndefined()
    expect(result.error).toMatch(/kunde inte skickas|skickas fortfarande/i)
  })

  it('never reports success when finalize itself is unavailable', async () => {
    serviceRpc.mockResolvedValue({ data: null, error: { message: 'offline' } })
    await expect(sendOffertReply({}, replyForm())).resolves.toMatchObject({
      error: expect.stringMatching(/kunde inte bekräftas/i),
    })
  })
})

const claimedRow = {
  id: outboxId,
  tenant_id: tenantId,
  event_type: 'offert_reply',
  event_key: `offert:${requestId}:reply:v7:hash`,
  category: 'transactional',
  chosen_channel: 'email',
  payload: { offert_request_id: requestId },
  status: 'attempting',
  lease_token: leaseToken,
  lease_expires_at: '2026-07-29T17:00:00.000Z',
} as ClaimedNotificationOutboxRow

describe('offert outbox email adapter', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createServiceClient.mockReturnValue({ rpc })
    rpc.mockResolvedValue({
      data: [{
        outcome: 'target',
        tenant_id: tenantId,
        tenant_name: 'Goal 92',
        customer_email: 'kund@example.test',
        customer_name: 'Kund',
        subject: 'Förfrågan',
        reply_message: 'Här är vårt svar.',
        estimate_cents: 25000,
      }],
      error: null,
    })
    mocks.sendOffertReplyEmail.mockResolvedValue({ ok: true, id: 'mail-92' })
  })

  it('loads PII only through the exact claimed target and reuses the existing sender', async () => {
    await expect(deliverImmediateOffertOutbox(claimedRow)).resolves.toEqual({
      status: 'sent',
      providerRef: 'email:mail-92',
    })
    expect(rpc).toHaveBeenCalledWith('offert_reply_delivery_target', {
      p_outbox: outboxId,
      p_lease_token: leaseToken,
    })
    expect(mocks.sendOffertReplyEmail).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      tenantName: 'Goal 92',
      to: 'kund@example.test',
      replyMessage: 'Här är vårt svar.',
    }))
  })

  it('rejects any payload beyond the single request id', async () => {
    const polluted = {
      ...claimedRow,
      payload: { offert_request_id: requestId, customer_email: 'leak@example.test' },
    } as ClaimedNotificationOutboxRow
    await expect(deliverImmediateOffertOutbox(polluted)).resolves.toEqual({
      status: 'failed',
      reason: 'payload_invalid',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    [{ ok: false, skipped: true }, { status: 'skipped', reason: 'transport_off' }],
    [{ ok: false, error: 'invalid_recipient' }, { status: 'failed', reason: 'payload_invalid' }],
    [{ ok: false, error: 'http_429' }, { status: 'retry', error: 'provider_rate_limited' }],
    [{ ok: false, error: 'exception' }, { status: 'failed', reason: 'delivery_uncertain' }],
  ])('maps closed email outcome %# without false success', async (sendResult, expected) => {
    mocks.sendOffertReplyEmail.mockResolvedValue(sendResult)
    await expect(deliverImmediateOffertOutbox(claimedRow)).resolves.toEqual(expected)
  })
})
