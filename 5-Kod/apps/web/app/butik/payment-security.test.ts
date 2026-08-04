import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  paymentMethods: ['card'] as string[],
  publicRpc: vi.fn(),
  serviceFactory: vi.fn(),
  serviceRpc: vi.fn(),
  stripeCreate: vi.fn(),
  paypalCreate: vi.fn(),
}))

function queryFor(table: string) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => {
      if (table === 'tenants') {
        return {
          data: {
            id: 'tenant-a',
            slug: 'salong-a',
            stripe_account_id: 'acct_tenant_a',
            stripe_charges_enabled: true,
          },
          error: null,
        }
      }
      if (table === 'tenant_settings') {
        return { data: { payments_enabled: true }, error: null }
      }
      if (table === 'tenant_modules') {
        return { data: { config: { payment_methods: state.paymentMethods } }, error: null }
      }
      return { data: null, error: null }
    },
  }
  return query
}

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (key: string) => (key === 'x-corevo-tenant-slug' ? 'salong-a' : null),
  }),
}))

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({
    from: (table: string) => queryFor(table),
    rpc: state.publicRpc,
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))

vi.mock('@/lib/platform/service', () => ({
  createServiceClient: state.serviceFactory,
}))

vi.mock('@/lib/stripe/client', () => ({
  getStripe: () => ({ checkout: { sessions: { create: state.stripeCreate } } }),
}))

vi.mock('@/lib/url', () => ({ requestOrigin: async () => 'https://salong-a.example' }))
vi.mock('@/lib/payments/paypal', () => ({
  paypalReady: () => true,
  createPaypalOrder: state.paypalCreate,
}))
vi.mock('@/lib/notifications/shop', () => ({ sendOrderPlacedEmail: vi.fn() }))
vi.mock('@/lib/notifications/gift', () => ({ deliverIssuedGiftCards: vi.fn() }))
vi.mock('@/lib/observability', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('@/lib/tenant-modules', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant-modules')>()
  return {
    ...actual,
    getTenantModuleStates: async () => ({ shop: 'live' }),
  }
})
vi.mock('@/lib/release/commerce', () => ({
  commerceReleaseGate: () => ({ shop: true, paypal: true }),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: async () => true,
  getClientIp: async () => '1.2.3.4',
  rateLimitKey: (...parts: string[]) => parts.join(':'),
  LIMITS: { booking: { max: 1, windowSecs: 1 } },
}))

import { confirmOrder, startPaypalCheckout, startShopCheckout } from '@/lib/storefront/shop/actions'

beforeEach(() => {
  vi.clearAllMocks()
  state.paymentMethods = ['card']
  state.publicRpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === 'get_public_shop_order') {
      if (args.p_token !== 'owned-token') {
        return { data: null, error: { code: '42501', message: 'forbidden_order' } }
      }
      return {
        data: {
          id: 'order-a',
          status: 'awaiting_payment',
          payment_status: 'unpaid',
          requires_payment: true,
          payment_method: 'card',
        },
        error: null,
      }
    }
    if (name === 'confirm_shop_order') {
      if (state.paymentMethods.length > 0 && !args.p_payment_method) {
        return { data: null, error: { code: '22023', message: 'payment_method_required' } }
      }
      return {
        data: [{ order_id: 'order-a', requires_payment: Boolean(args.p_payment_method) }],
        error: null,
      }
    }
    return { data: null, error: null }
  })
  state.serviceRpc.mockImplementation(async (name: string) => {
    if (name === 'prepare_shop_order_payment') {
      return {
        data: {
          payment_id: 'payment-a',
          order_id: 'order-a',
          subtotal_cents: 10000,
          shipping_cents: 0,
          discount_cents: 0,
          tax_cents: 0,
          total_cents: 10000,
          currency: 'SEK',
          payment_method: 'card',
          provider: 'stripe',
          provider_account_scope: 'acct_tenant_a',
          provider_order_id: null,
        },
        error: null,
      }
    }
    if (name === 'record_shop_payment_order_reference') {
      return { data: {}, error: null }
    }
    return { data: null, error: null }
  })
  state.serviceFactory.mockImplementation(() => ({
    from: (table: string) => queryFor(table),
    rpc: state.serviceRpc,
  }))
  state.stripeCreate.mockResolvedValue({ id: 'cs_test', url: 'https://stripe.example/checkout' })
  state.paypalCreate.mockResolvedValue({ id: 'pp-test', approveUrl: 'https://paypal.example/checkout' })
})

describe('shop payment security', () => {
  it('rejects an omitted payment method when online payment is configured', async () => {
    const result = await confirmOrder({
      orderId: 'order-a',
      token: 'owned-token',
      name: 'Anna Andersson',
      email: 'anna@example.test',
      phone: '0701234567',
      acceptTerms: true,
      paymentMethod: null,
    })

    expect(result).toEqual({
      ok: false,
      reason: 'invalid',
      message: 'Välj ett betalsätt.',
    })
    expect(state.publicRpc).toHaveBeenCalledWith(
      'confirm_shop_order',
      expect.objectContaining({ p_payment_method: undefined }),
    )
  })

  it('keeps the intentional no-online-payment checkout path', async () => {
    state.paymentMethods = []

    const result = await confirmOrder({
      orderId: 'order-a',
      token: 'owned-token',
      name: 'Anna Andersson',
      email: 'anna@example.test',
      phone: '0701234567',
      acceptTerms: true,
      paymentMethod: null,
    })

    expect(result).toEqual({ ok: true, orderId: 'order-a', requiresPayment: false })
    expect(state.publicRpc).toHaveBeenCalledWith(
      'confirm_shop_order',
      expect.objectContaining({ p_order_id: 'order-a', p_token: 'owned-token' }),
    )
  })

  it('retries a zero-total order without a payment provider', async () => {
    state.publicRpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name !== 'confirm_shop_order') return { data: null, error: null }
      if (args.p_payment_method) {
        return { data: null, error: { code: '22023', message: 'zero_total_payment_not_required' } }
      }
      return { data: [{ order_id: 'order-a', requires_payment: false }], error: null }
    })

    await expect(confirmOrder({
      orderId: 'order-a',
      token: 'owned-token',
      name: 'Anna Andersson',
      email: 'anna@example.test',
      phone: '0701234567',
      acceptTerms: true,
      paymentMethod: 'card',
    })).resolves.toEqual({ ok: true, orderId: 'order-a', requiresPayment: false })

    expect(state.publicRpc).toHaveBeenNthCalledWith(
      2,
      'confirm_shop_order',
      expect.objectContaining({ p_payment_method: undefined }),
    )
  })

  it('does not create a service client when the Stripe session token is wrong', async () => {
    const result = await startShopCheckout('order-a', 'wrong-token', 'card')

    expect(result).toMatchObject({ ok: false, reason: 'error' })
    expect(state.publicRpc).toHaveBeenCalledWith('get_public_shop_order', {
      p_id: 'order-a',
      p_token: 'wrong-token',
    })
    expect(state.serviceFactory).not.toHaveBeenCalled()
  })

  it('does not create a service client when the PayPal session token is wrong', async () => {
    const result = await startPaypalCheckout('order-a', 'wrong-token')

    expect(result).toMatchObject({ ok: false, reason: 'error' })
    expect(state.publicRpc).toHaveBeenCalledWith('get_public_shop_order', {
      p_id: 'order-a',
      p_token: 'wrong-token',
    })
    expect(state.serviceFactory).not.toHaveBeenCalled()
  })

  it('verifies ownership before creating the Stripe service client', async () => {
    await expect(startShopCheckout('order-a', 'owned-token', 'card')).resolves.toEqual({
      ok: true,
      url: 'https://stripe.example/checkout',
    })

    expect(state.publicRpc.mock.invocationCallOrder[0]).toBeLessThan(
      state.serviceFactory.mock.invocationCallOrder[0],
    )
  })
})
