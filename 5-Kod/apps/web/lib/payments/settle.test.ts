import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
const deliverIssuedGiftCards = vi.fn()

vi.mock('@/lib/platform/service', () => ({
  createServiceClient: () => ({ rpc }),
}))
vi.mock('@/lib/observability', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/notifications/gift', () => ({ deliverIssuedGiftCards }))

const {
  completeShopPaymentEvent,
  settleShopOrderPaid,
  settleShopPaymentEvent,
} = await import('./settle')

const paidEvent = {
  provider: 'paypal' as const,
  accountScope: 'paypal:platform',
  providerEventId: 'WH-1',
  orderId: 'o1',
  tenantId: null,
  amountCents: 52900,
  currency: 'SEK',
  providerRef: 'CAP-1',
  source: 'webhook' as const,
}

beforeEach(() => {
  rpc.mockReset()
  deliverIssuedGiftCards.mockReset()
  deliverIssuedGiftCards.mockResolvedValue({ attempted: 1, failed: 0 })
  rpc.mockImplementation(async (name: string) => {
    if (name === 'register_shop_payment_event') {
      return { data: { event_id: 'event-1', status: 'pending' }, error: null }
    }
    if (name === 'settle_shop_payment_event') {
      return {
        data: {
          outcome: 'succeeded',
          tenant_id: 't1',
          order_id: 'o1',
        },
        error: null,
      }
    }
    if (name === 'complete_shop_payment_event') {
      return { data: { outcome: 'refunded' }, error: null }
    }
    return { data: null, error: null }
  })
})

describe('shop payment event boundary', () => {
  it('registers before one DB-owned settlement and then delivers issued value', async () => {
    const result = await settleShopOrderPaid(paidEvent)

    expect(result).toEqual({
      ok: true,
      eventId: 'event-1',
      tenantId: 't1',
      orderId: 'o1',
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'register_shop_payment_event', {
      p_provider: 'paypal',
      p_account_scope: 'paypal:platform',
      p_provider_event_id: 'WH-1',
      p_event_type: 'payment_succeeded',
      p_tenant: null,
      p_order: 'o1',
      p_provider_reference_id: 'CAP-1',
      p_amount_cents: 52900,
      p_currency: 'SEK',
      p_payload: { source: 'webhook' },
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'settle_shop_payment_event', {
      p_event: 'event-1',
    })
    expect(deliverIssuedGiftCards).toHaveBeenCalledWith(expect.anything(), 't1', 'o1')
  })

  it('accepts exact replay without another app-owned state transition', async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === 'register_shop_payment_event') {
        return { data: { event_id: 'event-1', status: 'processed' }, error: null }
      }
      return {
        data: {
          outcome: 'already_succeeded',
          tenant_id: 't1',
          order_id: 'o1',
        },
        error: null,
      }
    })

    await expect(settleShopOrderPaid(paidEvent)).resolves.toMatchObject({ ok: true })
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('returns a closed amount mismatch for provider compensation', async () => {
    rpc.mockImplementation(async (name: string) => name === 'register_shop_payment_event'
      ? { data: { event_id: 'event-1' }, error: null }
      : {
          data: { outcome: 'amount_mismatch', tenant_id: 't1', order_id: 'o1' },
          error: null,
        })

    await expect(settleShopOrderPaid(paidEvent)).resolves.toEqual({
      ok: false,
      reason: 'amount_mismatch',
      eventId: 'event-1',
      tenantId: 't1',
      orderId: 'o1',
    })
    expect(deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('never acknowledges an event that could not be durably registered', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('db unavailable') })

    await expect(settleShopOrderPaid(paidEvent)).resolves.toEqual({
      ok: false,
      reason: 'event_register_failed',
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('leaves a registered event retryable when settlement RPC fails', async () => {
    rpc
      .mockResolvedValueOnce({ data: { event_id: 'event-1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('transaction failed') })
      .mockResolvedValueOnce({ data: { outcome: 'retryable' }, error: null })

    await expect(settleShopOrderPaid(paidEvent)).resolves.toEqual({
      ok: false,
      reason: 'event_settle_failed',
      eventId: 'event-1',
    })
    expect(rpc).toHaveBeenNthCalledWith(3, 'complete_shop_payment_event', {
      p_event: 'event-1',
      p_outcome: 'retryable',
      p_error_code: 'settlement_rpc_failed',
    })
  })

  it('surfaces missing payment state without losing the inbox row', async () => {
    rpc.mockImplementation(async (name: string) => name === 'register_shop_payment_event'
      ? { data: { event_id: 'event-1' }, error: null }
      : {
          data: { outcome: 'payment_missing', tenant_id: 't1', order_id: 'o1' },
          error: null,
        })

    await expect(settleShopOrderPaid(paidEvent)).resolves.toMatchObject({
      ok: false,
      reason: 'payment_missing',
      eventId: 'event-1',
    })
  })

  it('does not redeliver value for a payment already refunded', async () => {
    rpc.mockImplementation(async (name: string) => name === 'register_shop_payment_event'
      ? { data: { event_id: 'event-1' }, error: null }
      : {
          data: { outcome: 'refunded', tenant_id: 't1', order_id: 'o1' },
          error: null,
        })

    await expect(settleShopOrderPaid(paidEvent)).resolves.toMatchObject({ ok: true })
    expect(deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('keeps payment success truthful when gift delivery needs its own retry', async () => {
    deliverIssuedGiftCards.mockResolvedValueOnce({ attempted: 1, failed: 1 })

    await expect(settleShopOrderPaid(paidEvent)).resolves.toMatchObject({
      ok: true,
      giftDeliveryPending: true,
    })
  })

  it('uses the same boundary for failed provider events', async () => {
    rpc.mockImplementation(async (name: string) => name === 'register_shop_payment_event'
      ? { data: { event_id: 'event-2' }, error: null }
      : {
          data: { outcome: 'failed', tenant_id: 't1', order_id: 'o1' },
          error: null,
        })

    const result = await settleShopPaymentEvent({
      ...paidEvent,
      eventType: 'payment_failed',
      amountCents: null,
    })

    expect(result.ok).toBe(true)
    expect(deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('lets the DB resolve a signed provider refund without a Corevo order id', async () => {
    rpc.mockImplementation(async (name: string) => name === 'register_shop_payment_event'
      ? { data: { event_id: 'event-refund' }, error: null }
      : {
          data: { outcome: 'refunded', tenant_id: 't1', order_id: 'o1' },
          error: null,
        })

    await expect(settleShopPaymentEvent({
      ...paidEvent,
      eventType: 'refund_succeeded',
      orderId: null,
    })).resolves.toEqual({
      ok: true,
      eventId: 'event-refund',
      tenantId: 't1',
      orderId: 'o1',
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'register_shop_payment_event', {
      p_provider: 'paypal',
      p_account_scope: 'paypal:platform',
      p_provider_event_id: 'WH-1',
      p_event_type: 'refund_succeeded',
      p_tenant: null,
      p_order: null,
      p_provider_reference_id: 'CAP-1',
      p_amount_cents: 52900,
      p_currency: 'SEK',
      p_payload: { source: 'webhook' },
    })
    expect(deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('closes a compensating provider refund through the DB', async () => {
    await expect(
      completeShopPaymentEvent('event-1', 'refunded', 'terminal_order'),
    ).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('complete_shop_payment_event', {
      p_event: 'event-1',
      p_outcome: 'refunded',
      p_error_code: 'terminal_order',
    })
  })
})
