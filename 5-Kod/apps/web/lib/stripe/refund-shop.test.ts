import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getStripe: vi.fn(),
}))

vi.mock('./client', () => ({ getStripe: mocks.getStripe }))
vi.mock('@/lib/platform/service', () => ({
  createServiceClient: mocks.createServiceClient,
}))

import { refundShopOrder } from './refund'

function query(data: unknown) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

describe('refundShopOrder explicit result', () => {
  const createRefund = vi.fn()
  const rpc = vi.fn()
  const payments = query({
    status: 'succeeded',
    stripe_payment_intent_id: 'pi_goal92',
  })
  const tenants = query({ stripe_account_id: 'acct_goal92' })
  const from = vi.fn((table: string) => {
    if (table === 'payments') return payments
    if (table === 'tenants') return tenants
    throw new Error(`unexpected table: ${table}`)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStripe.mockReturnValue({ refunds: { create: createRefund } })
    mocks.createServiceClient.mockReturnValue({ from, rpc })
    createRefund.mockResolvedValue({ id: 're_goal92' })
    rpc.mockResolvedValue({ data: true, error: null })
  })

  it('returns true only after provider success and atomic local mirror', async () => {
    await expect(refundShopOrder('order-1', 'tenant-1')).resolves.toBe(true)
    expect(rpc).toHaveBeenCalledWith('record_shop_order_refund', {
      p_order_id: 'order-1',
    })
  })

  it('returns false when provider outcome is not confirmed', async () => {
    createRefund.mockRejectedValue(new Error('provider failed'))

    await expect(refundShopOrder('order-1', 'tenant-1')).resolves.toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('returns false when the atomic local mirror is not confirmed', async () => {
    rpc.mockResolvedValue({ data: false, error: null })

    await expect(refundShopOrder('order-1', 'tenant-1')).resolves.toBe(false)
  })
})
