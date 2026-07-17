import { beforeEach, describe, expect, it, vi } from 'vitest'

const paypalReady = vi.fn()
const verifyPaypalWebhook = vi.fn()
const settleShopOrderPaid = vi.fn()
const recordShopOrderRefunded = vi.fn()
const refundPaypalCapture = vi.fn()
const captureException = vi.fn()

vi.mock('@/lib/payments/paypal', () => ({ paypalReady, verifyPaypalWebhook, refundPaypalCapture }))
vi.mock('@/lib/payments/settle', () => ({ settleShopOrderPaid, recordShopOrderRefunded }))
vi.mock('@/lib/observability', () => ({ captureException }))

const { POST } = await import('./route')

function completedRequest(): Request {
  return new Request('https://booking.corevo.se/api/paypal/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAPTURE-1',
        custom_id: 'order-1',
        amount: { value: '529.00' },
      },
    }),
  })
}

beforeEach(() => {
  paypalReady.mockReset().mockReturnValue(true)
  verifyPaypalWebhook.mockReset().mockResolvedValue(true)
  settleShopOrderPaid.mockReset().mockResolvedValue({ ok: true })
  recordShopOrderRefunded.mockReset().mockResolvedValue(true)
  refundPaypalCapture.mockReset().mockResolvedValue(true)
  captureException.mockReset().mockResolvedValue(undefined)
})

describe('PayPal webhook', () => {
  it('returnerar 500 när settlement inte kunde skrivas så PayPal försöker igen', async () => {
    settleShopOrderPaid.mockResolvedValue({ ok: false, reason: 'payment_update_failed' })

    const response = await POST(completedRequest())

    expect(response.status).toBe(500)
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('payment_update_failed') }),
      { where: 'paypal.webhook' },
    )
  })

  it('returnerar 200 först när settlement lyckades', async () => {
    const response = await POST(completedRequest())

    expect(response.status).toBe(200)
    expect(settleShopOrderPaid).toHaveBeenCalledWith({
      orderId: 'order-1',
      amountCents: 52900,
      providerRef: 'CAPTURE-1',
    })
  })

  it('returnerar 500 när betalningen är klar men presentkortsleveransen behöver retry', async () => {
    settleShopOrderPaid.mockResolvedValue({ ok: true, giftDeliveryPending: true })

    const response = await POST(completedRequest())

    expect(response.status).toBe(500)
  })

  it('återbetalar en capture som kom efter att ordern blivit terminal', async () => {
    settleShopOrderPaid.mockResolvedValue({ ok: false, reason: 'terminal_order' })

    const response = await POST(completedRequest())

    expect(response.status).toBe(200)
    expect(refundPaypalCapture).toHaveBeenCalledWith('CAPTURE-1')
    expect(recordShopOrderRefunded).toHaveBeenCalledWith('order-1')
    await expect(response.json()).resolves.toEqual({ refunded: true })
  })

  it('returnerar 500 om en obligatorisk auto-refund misslyckas så PayPal försöker igen', async () => {
    settleShopOrderPaid.mockResolvedValue({ ok: false, reason: 'terminal_order' })
    refundPaypalCapture.mockResolvedValue(false)

    const response = await POST(completedRequest())

    expect(response.status).toBe(500)
    expect(recordShopOrderRefunded).not.toHaveBeenCalled()
  })
})
