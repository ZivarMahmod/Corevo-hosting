import { beforeEach, describe, expect, it, vi } from 'vitest'

const lifecycle = vi.hoisted(() => ({
  shop: 'live' as 'off' | 'live' | null,
}))

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (key: string) => (key === 'x-corevo-tenant-slug' ? 'salong-a' : null),
  }),
}))

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: { id: 'tenant-a', slug: 'salong-a' },
        error: null,
      }),
    }
    return {
      from: () => query,
      rpc: async () => ({ data: { id: 'order-a' }, error: null }),
    }
  },
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/stripe/client', () => ({ getStripe: vi.fn() }))
vi.mock('@/lib/url', () => ({ requestOrigin: vi.fn() }))
vi.mock('@/lib/payments/paypal', () => ({
  paypalReady: vi.fn(() => false),
  createPaypalOrder: vi.fn(),
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
    getTenantModuleStates: vi.fn(async () =>
      lifecycle.shop ? { shop: lifecycle.shop } : {},
    ),
  }
})

vi.mock('@/lib/release/commerce', () => ({
  commerceReleaseGate: () => ({ shop: true }),
}))

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIp: vi.fn(async () => '1.2.3.4'),
  rateLimitKey: (...parts: string[]) => parts.join(':'),
  LIMITS: { booking: { max: 1, windowSecs: 1 } },
}))

import { getShopOrder, reserveOrder } from '@/lib/storefront/shop/actions'

beforeEach(() => {
  lifecycle.shop = 'live'
})

describe('reserveOrder — shop lifecycle gate', () => {
  it.each(['off', null] as const)(
    'denies before checkout work when shop state is %s',
    async (state) => {
      lifecycle.shop = state

      const result = await reserveOrder({
        items: [],
        token: 'session-token',
        reserveRequestId: '00000000-0000-4000-8000-000000000001',
      })

      expect(result).toEqual({
        ok: false,
        reason: 'invalid',
        message: 'Webshop är inte aktiverad ännu.',
      })
    },
  )

  it('admits live shop state to the checkout validation', async () => {
    const result = await reserveOrder({
      items: [],
      token: 'session-token',
      reserveRequestId: '00000000-0000-4000-8000-000000000001',
    })

    expect(result).toEqual({
      ok: false,
      reason: 'invalid',
      message: 'Varukorgen är tom.',
    })
  })

  it('hides existing token-gated orders while shop is off', async () => {
    lifecycle.shop = 'off'

    await expect(getShopOrder('order-a', 'session-token')).resolves.toBeNull()
  })
})
