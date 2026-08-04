import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  dispatchPaymentRefundJobById: vi.fn(),
  moduleCtx: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTenant: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/admin/module-ctx', () => ({ moduleCtx: mocks.moduleCtx }))
vi.mock('@/lib/admin/tenant', () => ({ revalidateTenant: mocks.revalidateTenant }))
vi.mock('@/lib/payments/refund-outbox', () => ({
  dispatchPaymentRefundJobById: mocks.dispatchPaymentRefundJobById,
}))
vi.mock('@/lib/release/commerce', () => ({
  commerceReleaseGate: () => ({ shop: true, paypal: false }),
}))
vi.mock('@/lib/payments/paypal', () => ({ paypalReady: () => false }))
vi.mock('@/lib/notifications/shop', () => ({ sendOrderStatusEmail: vi.fn() }))

import { createShopProduct, refundShopOrderAction, updateShopProduct } from './actions'

const tenantId = '123e4567-e89b-42d3-a456-426614174001'
const orderId = '123e4567-e89b-42d3-a456-426614174002'
const jobId = '123e4567-e89b-42d3-a456-426614174003'

function form() {
  const fd = new FormData()
  fd.set('id', orderId)
  return fd
}

describe('durable webshop refund action', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.moduleCtx.mockResolvedValue({
      tenant: { id: tenantId, slug: 'goal92', name: 'Goal 92' },
    })
    mocks.createClient.mockResolvedValue({ rpc })
    rpc.mockImplementation(async (name: string) => {
      if (name === 'enqueue_shop_order_refund') {
        return {
          data: [{ outcome: 'queued', job_id: jobId, refund_status: 'pending' }],
          error: null,
        }
      }
      if (name === 'shop_order_refund_statuses') {
        return { data: [{ order_id: orderId, refund_status: 'succeeded' }], error: null }
      }
      throw new Error(`unexpected rpc: ${name}`)
    })
    mocks.dispatchPaymentRefundJobById.mockResolvedValue({
      claimed: 1,
      completed: 1,
      retried: 0,
      reviewRequired: 0,
      stale: 0,
      failed: 0,
    })
  })

  it('enqueues, dispatches one exact job and reports succeeded only from DB status', async () => {
    await expect(refundShopOrderAction({}, form())).resolves.toEqual({
      success: 'Återbetalning genomförd.',
      refundStatus: 'succeeded',
    })
    expect(rpc).toHaveBeenNthCalledWith(1, 'enqueue_shop_order_refund', {
      p_tenant: tenantId,
      p_order: orderId,
    })
    expect(mocks.dispatchPaymentRefundJobById).toHaveBeenCalledWith(jobId)
    expect(rpc).toHaveBeenNthCalledWith(2, 'shop_order_refund_statuses', {
      p_tenant: tenantId,
    })
  })

  it('reports pending after an uncertain dispatch response and never claims completion', async () => {
    mocks.dispatchPaymentRefundJobById.mockRejectedValue(new Error('response_lost'))
    rpc.mockImplementation(async (name: string) => {
      if (name === 'enqueue_shop_order_refund') {
        return {
          data: [{ outcome: 'queued', job_id: jobId, refund_status: 'pending' }],
          error: null,
        }
      }
      return { data: [{ order_id: orderId, refund_status: 'pending' }], error: null }
    })

    await expect(refundShopOrderAction({}, form())).resolves.toEqual({
      success: 'Återbetalning köad.',
      refundStatus: 'pending',
    })
  })

  it('projects review_required as failed without a false success', async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === 'enqueue_shop_order_refund') {
        return {
          data: [{ outcome: 'existing', job_id: jobId, refund_status: 'failed' }],
          error: null,
        }
      }
      return { data: [{ order_id: orderId, refund_status: 'failed' }], error: null }
    })

    const result = await refundShopOrderAction({}, form())
    expect(result).toEqual({
      error: 'Återbetalningen kräver manuell kontroll.',
      refundStatus: 'failed',
    })
    expect(result.success).toBeUndefined()
    expect(mocks.dispatchPaymentRefundJobById).not.toHaveBeenCalled()
  })
})

describe('webshop product writes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.moduleCtx.mockResolvedValue({
      tenant: { id: tenantId, slug: 'webshop-test', name: 'Webshop test' },
    })
  })

  it.each([
    ['create', createShopProduct],
    ['update', updateShopProduct],
  ])('rejects invalid stock through the shared %s parser', async (_, action) => {
    const fd = new FormData()
    fd.set('id', 'product-1')
    fd.set('name', 'Produkt')
    fd.set('stock', '-1')

    await expect(action({}, fd)).resolves.toEqual({
      error: 'Lager måste vara 0 eller ett positivt heltal.',
    })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
})
