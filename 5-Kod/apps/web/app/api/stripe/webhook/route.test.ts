import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStripe: vi.fn(),
  getWebhookSecret: vi.fn(),
  constructEventAsync: vi.fn(),
  createServiceClient: vi.fn(),
  captureException: vi.fn(),
  deliverIssuedGiftCards: vi.fn(),
  refundBookingPayment: vi.fn(),
  refundShopOrder: vi.fn(),
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: mocks.getStripe,
  getWebhookSecret: mocks.getWebhookSecret,
}))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/observability', () => ({ captureException: mocks.captureException }))
vi.mock('@/lib/notifications/booking', () => ({
  parseGuestEmail: vi.fn(() => null),
  sendPaymentReceipt: vi.fn(),
}))
vi.mock('@/lib/notifications/gift', () => ({ deliverIssuedGiftCards: mocks.deliverIssuedGiftCards }))
vi.mock('@/lib/stripe/refund', () => ({
  refundBookingPayment: mocks.refundBookingPayment,
  refundShopOrder: mocks.refundShopOrder,
}))

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
    type: 'payment_intent.succeeded',
    account: 'acct_t1',
    data: {
      object: {
        id: 'pi_1',
        metadata: { order_id: 'order_1', tenant_id: 'tenant_1' },
      },
    },
  }
}

describe('Stripe webhook DB-fel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStripe.mockReturnValue({ webhooks: { constructEventAsync: mocks.constructEventAsync } })
    mocks.getWebhookSecret.mockReturnValue('whsec_test')
    mocks.captureException.mockResolvedValue(undefined)
    mocks.deliverIssuedGiftCards.mockResolvedValue(undefined)
    mocks.constructEventAsync.mockResolvedValue(succeededOrderEvent())
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
    const paymentUpdate = query({ data: null, error: { message: 'payment update failed' } })
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

    expect(response.status).toBe(500)
    expect(rpc).not.toHaveBeenCalled()
    expect(mocks.deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('svarar 500 och levererar inte presentkort när order-commit misslyckas', async () => {
    const tenantLookup = query({ data: { stripe_account_id: 'acct_t1' }, error: null })
    const orderLookup = query({ data: { id: 'order_1' }, error: null })
    const paymentUpdate = query({ data: { status: 'succeeded' }, error: null })
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'order commit failed' } }))
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

    expect(response.status).toBe(500)
    expect(mocks.deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('committar aldrig en order från ett sent succeeded-event när betalningen redan är refunded', async () => {
    const tenantLookup = query({ data: { stripe_account_id: 'acct_t1' }, error: null })
    const orderLookup = query({ data: { id: 'order_1' }, error: null })
    // UPDATE ... neq(status, refunded) matchar noll rader.
    const paymentUpdate = query({ data: null, error: null })
    const refundedPayment = query({ data: { status: 'refunded' }, error: null })
    let paymentCall = 0
    const rpc = vi.fn(async () => ({ data: null, error: null }))
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'tenants') return tenantLookup
        if (table === 'shop_orders') return orderLookup
        if (table === 'payments') return paymentCall++ === 0 ? paymentUpdate : refundedPayment
        throw new Error(`unexpected table ${table}`)
      }),
      rpc,
    })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(rpc).not.toHaveBeenCalled()
    expect(mocks.deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('behåller lyckad orderhantering idempotent när alla DB-steg lyckas', async () => {
    const tenantLookup = query({ data: { stripe_account_id: 'acct_t1' }, error: null })
    const orderLookup = query({ data: { id: 'order_1', status: 'paid' }, error: null })
    const paymentUpdate = query({ data: { status: 'succeeded' }, error: null })
    const rpc = vi.fn(async () => ({ data: null, error: null }))
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
    expect(rpc).toHaveBeenCalledWith('mark_shop_order_paid', { p_order_id: 'order_1' })
    expect(mocks.deliverIssuedGiftCards).toHaveBeenCalledTimes(1)
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
      type: 'charge.refunded',
      account: 'acct_t1',
      data: { object: { payment_intent: 'pi_refunded' } },
    })
    const paymentLookup = query({
      data: {
        tenant_id: 'tenant_1',
        order_id: 'order_1',
        tenants: { stripe_account_id: 'acct_t1' },
      },
      error: null,
    })
    const paymentUpdate = query({ data: null, error: { message: 'refund status write failed' } })
    const orderUpdate = query({ data: null, error: null })
    let paymentCall = 0
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'payments') return paymentCall++ === 0 ? paymentLookup : paymentUpdate
        if (table === 'shop_orders') return orderUpdate
        throw new Error(`unexpected table ${table}`)
      }),
      rpc: vi.fn(),
    })

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(orderUpdate.update).not.toHaveBeenCalled()
  })

  it('kvitterar inte en sen avbokad bokningsbetalning innan refunden är verifierad i DB', async () => {
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
    const tenantLookup = query({ data: { stripe_account_id: 'acct_t1' }, error: null })
    const paymentLookup = query({ data: { status: 'succeeded' }, error: null })
    const rpc = vi.fn(async () => ({
      data: { booking_status: 'cancelled', payment_status: 'succeeded' },
      error: null,
    }))
    mocks.createServiceClient.mockReturnValue({
      from: vi.fn((table: string) => (table === 'tenants' ? tenantLookup : paymentLookup)),
      rpc,
    })
    mocks.refundBookingPayment.mockResolvedValue(undefined)

    const response = await POST(request())

    expect(mocks.refundBookingPayment).toHaveBeenCalledWith('booking_cancelled', 'tenant_1')
    expect(response.status).toBe(500)
  })
})
