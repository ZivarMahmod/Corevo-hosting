import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  capturePaypalOrder: vi.fn(),
  paypalReady: vi.fn(),
  refundPaypalCapture: vi.fn(),
  recordShopOrderRefunded: vi.fn(),
  settleShopOrderPaid: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock('@/lib/payments/paypal', () => ({
  capturePaypalOrder: mocks.capturePaypalOrder,
  paypalReady: mocks.paypalReady,
  refundPaypalCapture: mocks.refundPaypalCapture,
}))
vi.mock('@/lib/payments/settle', () => ({
  recordShopOrderRefunded: mocks.recordShopOrderRefunded,
  settleShopOrderPaid: mocks.settleShopOrderPaid,
}))
vi.mock('@/lib/observability', () => ({ captureException: mocks.captureException }))

import { GET } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.paypalReady.mockReturnValue(true)
  mocks.capturePaypalOrder.mockResolvedValue({
    status: 'COMPLETED',
    reference: 'order-1',
    captureId: 'CAPTURE-1',
    amountCents: 52900,
  })
  mocks.refundPaypalCapture.mockResolvedValue(true)
  mocks.recordShopOrderRefunded.mockResolvedValue(true)
  mocks.settleShopOrderPaid.mockResolvedValue({ ok: true })
})

describe('PayPal return', () => {
  it('visar betald order även när presentkortsleveransen väntar på webhook-retry', async () => {
    mocks.settleShopOrderPaid.mockResolvedValue({ ok: true, giftDeliveryPending: true })

    const response = await GET(
      new Request('https://booking.corevo.se/api/paypal/retur?token=PP-1&order=order-1'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://booking.corevo.se/bekraftelse/order-1?betald=1',
    )
  })

  it('återbetalar en capture vars interna order inte längre finns', async () => {
    mocks.settleShopOrderPaid.mockResolvedValue({ ok: false, reason: 'unknown_order' })

    const response = await GET(
      new Request('https://booking.corevo.se/api/paypal/retur?token=PP-1&order=order-1'),
    )

    expect(response.status).toBe(307)
    expect(mocks.refundPaypalCapture).toHaveBeenCalledWith('CAPTURE-1')
    expect(mocks.recordShopOrderRefunded).not.toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'https://booking.corevo.se/bekraftelse/order-1?avbruten=1',
    )
  })
})
