import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStripe: vi.fn(),
  getWebhookSecret: vi.fn(),
  constructEventAsync: vi.fn(),
  createServiceClient: vi.fn(),
  captureException: vi.fn(),
  settleShopOrderPaid: vi.fn(),
  settleShopPaymentEvent: vi.fn(),
  completeShopPaymentEvent: vi.fn(),
  stripeRefundCreate: vi.fn(),
  dispatchPaymentRefundJobById: vi.fn(),
  after: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: mocks.getStripe,
  getWebhookSecret: mocks.getWebhookSecret,
}))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/observability', () => ({ captureException: mocks.captureException }))
vi.mock('@/lib/notifications/booking', () => ({
  sendPaymentReceipt: vi.fn(),
}))
vi.mock('@/lib/notifications/parse', () => ({ parseGuestEmail: vi.fn(() => null) }))
vi.mock('@/lib/payments/refund-outbox', () => ({
  dispatchPaymentRefundJobById: mocks.dispatchPaymentRefundJobById,
}))
vi.mock('@/lib/payments/settle', () => ({
  settleShopOrderPaid: mocks.settleShopOrderPaid,
  settleShopPaymentEvent: mocks.settleShopPaymentEvent,
  completeShopPaymentEvent: mocks.completeShopPaymentEvent,
}))
vi.mock('next/server', () => ({ after: mocks.after }))

import { POST } from './route'

type DbResult<T = unknown> = { data: T; error: { message: string } | null }

function query(result: DbResult) {
  const chain = {
    select: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    then: <TResult1 = DbResult, TResult2 = never>(
      onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  }
  return chain
}

function request() {
  return new Request('https://booking.corevo.se/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig_test' },
    body: '{}',
  })
}

function succeededOrderEvent() {
  return {
    id: 'evt_succeeded_1',
    type: 'payment_intent.succeeded',
    account: 'acct_t1',
    data: {
      object: {
        id: 'pi_1',
        amount_received: 52900,
        currency: 'sek',
        metadata: { order_id: 'order_1', tenant_id: 'tenant_1' },
      },
    },
  }
}

describe('Stripe webhook DB-fel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStripe.mockReturnValue({
      webhooks: { constructEventAsync: mocks.constructEventAsync },
      refunds: { create: mocks.stripeRefundCreate },
    })
    mocks.getWebhookSecret.mockReturnValue('whsec_test')
    mocks.captureException.mockResolvedValue(undefined)
    mocks.settleShopOrderPaid.mockResolvedValue({ ok: true })
    mocks.settleShopPaymentEvent.mockResolvedValue({ ok: true })
    mocks.completeShopPaymentEvent.mockResolvedValue(true)
    mocks.stripeRefundCreate.mockResolvedValue({ id: 're_1' })
    mocks.constructEventAsync.mockResolvedValue(succeededOrderEvent())
    mocks.after.mockImplementation((callback: () => Promise<unknown>) => { void callback() })
    mocks.dispatchPaymentRefundJobById.mockResolvedValue({ completed: 1 })
  })

  it('svarar 503 när endpointen tar emot event men Stripe-secret saknas', async () => {
    mocks.getWebhookSecret.mockReturnValue(null)
    mocks.createServiceClient.mockReturnValue({ from: vi.fn(), rpc: vi.fn() })

    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(mocks.constructEventAsync).not.toHaveBeenCalled()
  })

  it('svarar 503 när Stripe är aktivt men serviceklienten saknas', async () => {
    mocks.createServiceClient.mockReturnValue(null)

    const response = await POST(request())

    expect(response.status).toBe(503)
    expect(mocks.constructEventAsync).not.toHaveBeenCalled()
  })

  it('svarar 500 när tenant/account-kontrollen inte kan läsa databasen', async () => {
    const tenantLookup = query({ data: null, error: { message: 'tenant lookup unavailable' } })
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn(() => tenantLookup),
      rpc: vi.fn(),
    })

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(mocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'tenant lookup unavailable' }),
      expect.objectContaining({ where: 'webhook.handler' }),
    )
  })

  it('svarar 500 och committar inte ordern när payment-status inte kan sparas', async () => {
    const tenantLookup = query({ data: { stripe_account_id: 'acct_t1' }, error: null })
    const orderLookup = query({ data: { id: 'order_1' }, error: null })
    const rpc = vi.fn()
    mocks.settleShopOrderPaid.mockResolvedValue({
      ok: false,
      reason: 'event_settle_failed',
      eventId: 'event-1',
    })
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'tenants') return tenantLookup
        if (table === 'shop_orders') return orderLookup
        throw new Error(`unexpected table ${table}`)
      }),
      rpc,
    })

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(mocks.settleShopOrderPaid).toHaveBeenCalledOnce()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('svarar 500 och levererar inte presentkort när order-commit misslyckas', async () => {
    const tenantLookup = query({ data: { stripe_account_id: 'acct_t1' }, error: null })
    const orderLookup = query({ data: { id: 'order_1' }, error: null })
    const rpc = vi.fn()
    mocks.settleShopOrderPaid.mockResolvedValue({
      ok: false,
      reason: 'event_settle_failed',
      eventId: 'event-1',
    })
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'tenants') return tenantLookup
        if (table === 'shop_orders') return orderLookup
        throw new Error(`unexpected table ${table}`)
      }),
      rpc,
    })

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(mocks.settleShopOrderPaid).toHaveBeenCalledOnce()
  })

  it('committar aldrig en order från ett sent succeeded-event när betalningen redan är refunded', async () => {
    const tenantLookup = query({ data: { stripe_account_id: 'acct_t1' }, error: null })
    const orderLookup = query({ data: { id: 'order_1' }, error: null })
    const rpc = vi.fn()
    mocks.settleShopOrderPaid.mockResolvedValue({ ok: true })
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'tenants') return tenantLookup
        if (table === 'shop_orders') return orderLookup
        throw new Error(`unexpected table ${table}`)
      }),
      rpc,
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.settleShopOrderPaid).toHaveBeenCalledOnce()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('behåller lyckad orderhantering idempotent när alla DB-steg lyckas', async () => {
    const tenantLookup = query({ data: { stripe_account_id: 'acct_t1' }, error: null })
    const orderLookup = query({ data: { id: 'order_1', status: 'paid' }, error: null })
    const paymentUpdate = query({ data: { status: 'succeeded' }, error: null })
    const rpc = vi.fn()
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'tenants') return tenantLookup
        if (table === 'shop_orders') return orderLookup
        if (table === 'payments') return paymentUpdate
        throw new Error(`unexpected table ${table}`)
      }),
      rpc,
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.settleShopOrderPaid).toHaveBeenCalledWith({
      provider: 'stripe',
      accountScope: 'acct_t1',
      providerEventId: 'evt_succeeded_1',
      orderId: 'order_1',
      tenantId: 'tenant_1',
      amountCents: 52900,
      currency: 'sek',
      providerRef: 'pi_1',
      source: 'webhook',
    })
    expect(paymentUpdate.update).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('avvisar en andra PaymentIntent för en redan betald order före order-commit', async () => {
    mocks.constructEventAsync.mockResolvedValue({
      id: 'evt_second',
      type: 'payment_intent.succeeded',
      account: 'acct_t1',
      data: {
        object: {
          id: 'pi_second',
          amount_received: 52900,
          currency: 'sek',
          metadata: { order_id: 'order_1', tenant_id: 'tenant_1' },
        },
      },
    })
    const tenantLookup = query({ data: { stripe_account_id: 'acct_t1' }, error: null })
    const orderLookup = query({ data: { id: 'order_1' }, error: null })
    const rpc = vi.fn()
    mocks.settleShopOrderPaid.mockResolvedValue({
      ok: false,
      reason: 'provider_identity_mismatch',
      eventId: 'event-second',
    })
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => table === 'tenants' ? tenantLookup : orderLookup),
      rpc,
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.stripeRefundCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_second' },
      {
        stripeAccount: 'acct_t1',
        idempotencyKey: 'refund_rejected_shop_event_evt_second',
      },
    )
    expect(mocks.completeShopPaymentEvent).toHaveBeenCalledWith(
      'event-second',
      'refunded',
      'provider_identity_mismatch',
    )
  })

  it('svarar 500 när ett payment_failed-event inte kan spara failed-status', async () => {
    mocks.constructEventAsync.mockResolvedValue({
      type: 'payment_intent.payment_failed',
      account: 'acct_t1',
      data: {
        object: {
          id: 'pi_failed',
          metadata: { booking_id: 'booking_1', tenant_id: 'tenant_1' },
        },
      },
    })
    const tenantLookup = query({ data: { stripe_account_id: 'acct_t1' }, error: null })
    const paymentUpdate = query({ data: null, error: { message: 'failed status write failed' } })
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => (table === 'tenants' ? tenantLookup : paymentUpdate)),
      rpc: vi.fn(),
    })

    const response = await POST(request())

    expect(response.status).toBe(500)
  })

  it('svarar 500 och avbryter orderuppdateringen när refund-status inte kan sparas', async () => {
    mocks.constructEventAsync.mockResolvedValue({
      id: 'evt_refunded',
      type: 'charge.refunded',
      account: 'acct_t1',
      data: {
        object: {
          id: 'ch_refunded',
          payment_intent: 'pi_refunded',
          amount_refunded: 52900,
          currency: 'sek',
        },
      },
    })
    const paymentLookup = query({
      data: {
        tenant_id: 'tenant_1',
        order_id: 'order_1',
        tenants: { stripe_account_id: 'acct_t1' },
      },
      error: null,
    })
    const orderUpdate = query({ data: null, error: null })
    const rpc = vi.fn()
    mocks.settleShopPaymentEvent.mockResolvedValue({
      ok: false,
      reason: 'event_settle_failed',
    })
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'payments') return paymentLookup
        if (table === 'shop_orders') return orderUpdate
        throw new Error(`unexpected table ${table}`)
      }),
      rpc,
    })

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(mocks.settleShopPaymentEvent).toHaveBeenCalledOnce()
    expect(orderUpdate.update).not.toHaveBeenCalled()
  })

  it('godkänner refund-webhook mot payment-snapshot när tenantens konto har bytts', async () => {
    mocks.constructEventAsync.mockResolvedValue({
      type: 'charge.refunded',
      account: 'acct_historical',
      data: { object: { id: 'ch_historical', payment_intent: 'pi_historical' } },
    })
    const paymentLookup = query({
      data: {
        tenant_id: 'tenant_1', booking_id: 'booking_1', order_id: null,
        stripe_connected_account_id: 'acct_historical',
        tenants: { stripe_account_id: 'acct_current' },
      },
      error: null,
    })
    const rpc = vi.fn(async () => ({ data: { outcome: 'recorded' }, error: null }))
    mocks.createServiceClient.mockReturnValue({ from: vi.fn(() => paymentLookup), rpc })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(paymentLookup.eq).toHaveBeenCalledWith('stripe_payment_intent_id', 'pi_historical')
    expect(paymentLookup.eq).toHaveBeenCalledWith('stripe_connected_account_id', 'acct_historical')
    expect(rpc).toHaveBeenCalledWith('record_payment_refund_webhook', {
      p_tenant: 'tenant_1',
      p_payment_intent: 'pi_historical',
      p_provider_ref: 'ch_historical',
      p_connected_account: 'acct_historical',
    })
  })

  it('köar en sen avbokad bokningsbetalning atomiskt och accelererar exakt jobb', async () => {
    mocks.constructEventAsync.mockResolvedValue({
      type: 'payment_intent.succeeded',
      account: 'acct_t1',
      data: {
        object: {
          id: 'pi_late',
          metadata: { booking_id: 'booking_cancelled', tenant_id: 'tenant_1' },
        },
      },
    })
    const rpc = vi.fn(async (name: string) => name === 'booking_payment_event_matches'
      ? { data: true, error: null }
      : ({ data: {
        booking_status: 'cancelled', payment_status: 'succeeded',
        refund_job_id: '123e4567-e89b-42d3-a456-426614174000',
      }, error: null }))
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => { throw new Error(`unexpected table ${table}`) }),
      rpc,
    })

    const response = await POST(request())

    expect(rpc).toHaveBeenCalledWith('booking_payment_event_matches', {
      p_tenant: 'tenant_1',
      p_booking: 'booking_cancelled',
      p_payment_intent: 'pi_late',
      p_connected_account: 'acct_t1',
    })
    expect(rpc).toHaveBeenCalledWith('confirm_booking_payment', expect.objectContaining({
      p_connected_account: 'acct_t1',
    }))
    expect(mocks.after).toHaveBeenCalledOnce()
    expect(mocks.dispatchPaymentRefundJobById).toHaveBeenCalledWith(
      '123e4567-e89b-42d3-a456-426614174000',
    )
    expect(response.status).toBe(200)
  })
})
