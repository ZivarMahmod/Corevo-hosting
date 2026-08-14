import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStripe: vi.fn(),
  getSecret: vi.fn(),
  getMode: vi.fn(),
  constructEvent: vi.fn(),
  createServiceClient: vi.fn(),
}))
vi.mock('@/lib/stripe/platform-billing', () => ({
  getPlatformBillingStripe: mocks.getStripe,
  getPlatformBillingWebhookSecret: mocks.getSecret,
  getPlatformBillingMode: mocks.getMode,
}))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import { POST } from './route'

function request() {
  return new Request('https://booking.corevo.se/api/stripe/platform-billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'signed' },
    body: '{"raw":true}',
  })
}

describe('platform billing webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEventAsync: mocks.constructEvent },
    })
    mocks.getSecret.mockReturnValue('whsec_billing')
    mocks.getMode.mockReturnValue('test')
  })

  it('verifies the raw body and atomically records plus enqueues once', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    mocks.createServiceClient.mockReturnValue({ rpc })
    mocks.constructEvent.mockResolvedValue({
      id: 'evt_1',
      type: 'invoice.deleted',
      livemode: false,
      data: { object: { id: 'in_1', object: 'invoice', deleted: true } },
    })

    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.constructEvent).toHaveBeenCalledWith(
      '{"raw":true}',
      'signed',
      'whsec_billing',
      undefined,
      expect.anything(),
    )
    expect(rpc).toHaveBeenCalledWith('record_platform_billing_event_and_enqueue', {
      p_event_id: 'evt_1',
      p_event_type: 'invoice.deleted',
      p_object_id: 'in_1',
      p_livemode: false,
    })
    await expect(response.json()).resolves.toEqual({ received: true, queued: true })
  })

  it('returns 503 on persistence failure so Stripe retries', async () => {
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { code: 'db_down' } }),
    })
    mocks.constructEvent.mockResolvedValue({
      id: 'evt_2',
      type: 'invoice.paid',
      livemode: false,
      data: { object: { id: 'in_2' } },
    })
    await expect(POST(request())).resolves.toMatchObject({ status: 503 })
  })

  it('rejects a live event when the endpoint is configured for test mode', async () => {
    const rpc = vi.fn()
    mocks.createServiceClient.mockReturnValue({ rpc })
    mocks.constructEvent.mockResolvedValue({
      id: 'evt_wrong_mode',
      type: 'invoice.updated',
      livemode: true,
      data: { object: { id: 'in_wrong_mode' } },
    })

    await expect(POST(request())).resolves.toMatchObject({ status: 400 })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('does not mix connected-account or unrelated events into platform billing', async () => {
    const rpc = vi.fn()
    mocks.createServiceClient.mockReturnValue({ rpc })
    mocks.constructEvent
      .mockResolvedValueOnce({
        id: 'evt_connect',
        type: 'invoice.updated',
        account: 'acct_1',
        livemode: true,
        data: { object: { id: 'in_3' } },
      })
      .mockResolvedValueOnce({
        id: 'evt_other',
        type: 'customer.updated',
        data: { object: { id: 'cus_1' } },
      })

    await expect(POST(request())).resolves.toMatchObject({ status: 200 })
    await expect(POST(request())).resolves.toMatchObject({ status: 200 })
    expect(rpc).not.toHaveBeenCalled()
  })
})
