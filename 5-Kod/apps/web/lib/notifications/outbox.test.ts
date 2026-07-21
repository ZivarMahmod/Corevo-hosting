import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import {
  dispatchNotificationOutbox,
  dispatchNotificationOutboxById,
  enqueueNotification,
} from './outbox'

const claimed = {
  id: '10000000-0000-0000-0000-000000000001',
  tenant_id: '20000000-0000-0000-0000-000000000001',
  customer_id: null,
  booking_id: null,
  staff_id: null,
  event_type: 'booking_confirmation',
  event_key: 'booking:30000000-0000-0000-0000-000000000001:confirmation',
  category: 'transactional',
  chosen_channel: 'email',
  fallback_channel: null,
  consent_state: {},
  payload: { template: 'booking_confirmation' },
  status: 'attempting',
  skip_reason: null,
  cost_ore: null,
  cost_currency: null,
  parts: null,
  provider_ref: null,
  attempt_count: 1,
  max_attempts: 5,
  available_at: '2026-07-18T10:00:00.000Z',
  lease_token: '40000000-0000-0000-0000-000000000001',
  lease_expires_at: '2026-07-18T10:02:00.000Z',
  last_error: null,
  created_at: '2026-07-18T10:00:00.000Z',
  updated_at: '2026-07-18T10:00:00.000Z',
  sent_at: null,
  delivered_at: null,
}

describe('durable notification outbox', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.createServiceClient.mockReset()
    mocks.createServiceClient.mockReturnValue({ rpc: mocks.rpc })
  })

  it('enqueues through the idempotent database RPC', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ id: claimed.id, inserted: true }],
      error: null,
    })

    await expect(
      enqueueNotification({
        tenantId: claimed.tenant_id,
        eventType: claimed.event_type,
        eventKey: claimed.event_key,
        category: 'transactional',
        channel: 'email',
        payload: claimed.payload,
      }),
    ).resolves.toEqual({ id: claimed.id, inserted: true })

    expect(mocks.rpc).toHaveBeenCalledWith('enqueue_notification', {
      p_tenant: claimed.tenant_id,
      p_customer: null,
      p_booking: null,
      p_staff: null,
      p_event_type: claimed.event_type,
      p_event_key: claimed.event_key,
      p_category: 'transactional',
      p_channel: 'email',
      p_fallback_channel: null,
      p_consent_state: {},
      p_payload: claimed.payload,
      p_max_attempts: 5,
    })
  })

  it('does not pretend an enqueue succeeded without service-role', async () => {
    mocks.createServiceClient.mockReturnValue(null)
    await expect(
      enqueueNotification({
        tenantId: claimed.tenant_id,
        eventType: claimed.event_type,
        eventKey: claimed.event_key,
        category: 'transactional',
        channel: 'email',
        payload: {},
      }),
    ).resolves.toEqual({ id: null, inserted: false, error: 'service_role_unavailable' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('claims, delivers and acknowledges with the lease token', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [claimed], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    const deliver = vi.fn().mockResolvedValue({
      status: 'sent', providerRef: 'provider-1', costOre: 42, costCurrency: 'EUR', parts: 1,
    })

    await expect(dispatchNotificationOutbox({ deliver })).resolves.toEqual({
      claimed: 1,
      sent: 1,
      simulated: 0,
      skipped: 0,
      retried: 0,
      failed: 0,
      stale: 0,
    })
    expect(deliver).toHaveBeenCalledWith(claimed)
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'begin_notification_delivery', {
      p_id: claimed.id,
      p_lease_token: claimed.lease_token,
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'ack_notification_outbox', {
      p_id: claimed.id,
      p_lease_token: claimed.lease_token,
      p_status: 'sent',
      p_provider_ref: 'provider-1',
      p_cost_ore: 42,
      p_cost_currency: 'EUR',
      p_parts: 1,
      p_skip_reason: null,
    })
  })

  it('claims exactly one returned outbox id for immediate delivery', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [claimed], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    const deliver = vi.fn().mockResolvedValue({ status: 'sent', providerRef: 'giada:42' })

    await expect(dispatchNotificationOutboxById(claimed.id, deliver)).resolves.toMatchObject({
      claimed: 1,
      sent: 1,
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'claim_notification_outbox_by_id', {
      p_id: claimed.id,
      p_lease_token: expect.any(String),
      p_now: expect.any(String),
      p_lease_seconds: 120,
    })
  })

  it('terminalizes an uncertain provider acceptance instead of auto-retrying', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [claimed], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    const deliver = vi.fn().mockRejectedValue(new Error('provider timeout 0701234567'))

    await expect(dispatchNotificationOutbox({ deliver })).resolves.toMatchObject({ failed: 1, retried: 0 })
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'ack_notification_outbox', {
      p_id: claimed.id,
      p_lease_token: claimed.lease_token,
      p_status: 'failed',
      p_provider_ref: null,
      p_cost_ore: null,
      p_cost_currency: null,
      p_parts: null,
      p_skip_reason: 'delivery_uncertain',
    })
    expect(mocks.rpc).not.toHaveBeenCalledWith('retry_notification_outbox', expect.anything())
  })

  it('does not claim or consume attempts while transport is off', async () => {
    await expect(dispatchNotificationOutbox()).resolves.toEqual({
      claimed: 0,
      sent: 0,
      simulated: 0,
      skipped: 0,
      retried: 0,
      failed: 0,
      stale: 0,
    })
    expect(mocks.createServiceClient).not.toHaveBeenCalled()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('retries only an adapter-declared safe failure and stores a closed code', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [claimed], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: 'queued', error: null })
    const deliver = vi.fn().mockResolvedValue({
      status: 'retry',
      error: 'raw provider error customer@example.test 0701234567',
    })

    await expect(dispatchNotificationOutbox({ deliver })).resolves.toMatchObject({ retried: 1 })
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'retry_notification_outbox', expect.objectContaining({
      p_error: 'delivery_retryable',
    }))
  })

  it('sanitizes skip reasons and provider references before persistence', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [claimed], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    const deliver = vi.fn().mockResolvedValue({
      status: 'skipped',
      reason: 'customer@example.test asked to skip',
      providerRef: 'not part of skipped result',
    })

    await dispatchNotificationOutbox({ deliver })
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'ack_notification_outbox', expect.objectContaining({
      p_status: 'skipped',
      p_skip_reason: 'delivery_skipped',
      p_provider_ref: null,
    }))
  })

  it('acknowledges simulated delivery as terminal without retry', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [claimed], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    const deliver = vi.fn().mockResolvedValue({
      status: 'simulated',
      providerRef: 'dryrun-123',
      costOre: 35,
      costCurrency: 'SEK',
      parts: 2,
    })

    await expect(dispatchNotificationOutbox({ deliver })).resolves.toMatchObject({ simulated: 1, retried: 0 })
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'ack_notification_outbox', expect.objectContaining({
      p_status: 'simulated',
      p_provider_ref: 'dryrun-123',
      p_cost_ore: 35,
      p_cost_currency: 'SEK',
      p_parts: 2,
    }))
    await expect(dispatchNotificationOutbox({ deliver })).resolves.toMatchObject({ claimed: 0 })
    expect(deliver).toHaveBeenCalledOnce()
  })

  it('rejects a malformed claimed row with a nullable lease before delivery', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [{ ...claimed, lease_token: null }], error: null })
    const deliver = vi.fn()

    await expect(dispatchNotificationOutbox({ deliver })).resolves.toMatchObject({ claimed: 1, stale: 1 })
    expect(deliver).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('fails a malformed claimed row with a usable CAS identity instead of leasing it forever', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [{ ...claimed, chosen_channel: null }], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    const deliver = vi.fn()

    await expect(dispatchNotificationOutbox({ deliver })).resolves.toMatchObject({
      claimed: 1,
      failed: 1,
      stale: 0,
    })
    expect(deliver).not.toHaveBeenCalled()
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'ack_notification_outbox', {
      p_id: claimed.id,
      p_lease_token: claimed.lease_token,
      p_status: 'failed',
      p_provider_ref: null,
      p_cost_ore: null,
      p_cost_currency: null,
      p_parts: null,
      p_skip_reason: 'payload_invalid',
    })
  })

  it('does not call the provider when the per-row begin CAS is stale', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [claimed], error: null })
      .mockResolvedValueOnce({ data: false, error: null })
    const deliver = vi.fn()

    await expect(dispatchNotificationOutbox({ deliver })).resolves.toMatchObject({ stale: 1 })
    expect(deliver).not.toHaveBeenCalled()
  })

  it('leaves an accepted delivery non-retryable when its database acknowledgement fails', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [claimed], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'database unavailable' } })
    const deliver = vi.fn().mockResolvedValue({ status: 'sent', providerRef: 'provider-1' })

    await expect(dispatchNotificationOutbox({ deliver })).resolves.toMatchObject({
      sent: 0,
      retried: 0,
      stale: 1,
    })
    expect(mocks.rpc).toHaveBeenCalledTimes(3)
    expect(mocks.rpc).not.toHaveBeenCalledWith('retry_notification_outbox', expect.anything())
  })
})
