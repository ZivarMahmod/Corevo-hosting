import { beforeEach, describe, expect, it, vi } from 'vitest'

const paypalReady = vi.fn()
const verifyPaypalWebhook = vi.fn()
const settleShopOrderPaid = vi.fn()
const settleShopPaymentEvent = vi.fn()
const completeShopPaymentEvent = vi.fn()
const refundPaypalCapture = vi.fn()
const captureException = vi.fn()

vi.mock('@/lib/payments/paypal', () => ({ paypalReady, verifyPaypalWebhook, refundPaypalCapture }))
vi.mock('@/lib/payments/settle', () => ({
  settleShopOrderPaid,
  settleShopPaymentEvent,
  completeShopPaymentEvent,
}))
vi.mock('@/lib/observability', () => ({ captureException }))

const { POST } = await import('./route')

function completedRequest(): Request {
  return new Request('https://booking.corevo.se/api/paypal/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'WH-EVENT-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAPTURE-1',
        custom_id: 'order-1',
        amount: { value: '529.00', currency_code: 'SEK' },
      },
    }),
  })
}

function refundedRequest(): Request {
  return new Request('https://booking.corevo.se/api/paypal/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'WH-REFUND-1',
      event_type: 'PAYMENT.CAPTURE.REFUNDED',
      resource: {
        id: 'CAPTURE-1',
        amount: { value: '529.00', currency_code: 'SEK' },
      },
    }),
  })
}

beforeEach(() => {
  paypalReady.mockReset().mockReturnValue(true)
  verifyPaypalWebhook.mockReset().mockResolvedValue(true)
  settleShopOrderPaid.mockReset().mockResolvedValue({ ok: true })
  settleShopPaymentEvent.mockReset().mockResolvedValue({ ok: true })
  completeShopPaymentEvent.mockReset().mockResolvedValue(true)
  refundPaypalCapture.mockReset().mockResolvedValue(true)
  captureException.mockReset().mockResolvedValue(undefined)
})

describe('PayPal webhook', () => {
  it('returnerar 503 när signaturkonfigurationen saknas så eventet levereras om', async () => {
    paypalReady.mockReturnValue(false)

    const response = await POST(completedRequest())

    expect(response.status).toBe(503)
    expect(verifyPaypalWebhook).not.toHaveBeenCalled()
    expect(settleShopOrderPaid).not.toHaveBeenCalled()
  })

  it('returnerar 500 när settlement inte kunde skrivas så PayPal försöker igen', async () => {
    settleShopOrderPaid.mockResolvedValue({ ok: false, reason: 'event_settle_failed' })

    const response = await POST(completedRequest())

    expect(response.status).toBe(500)
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('event_settle_failed') }),
      { where: 'paypal.webhook' },
    )
  })

  it('returnerar 200 först när settlement lyckades', async () => {
    const response = await POST(completedRequest())

    expect(response.status).toBe(200)
    expect(settleShopOrderPaid).toHaveBeenCalledWith({
      provider: 'paypal',
      accountScope: 'paypal:platform',
      providerEventId: 'WH-EVENT-1',
      orderId: 'order-1',
      tenantId: null,
      amountCents: 52900,
      currency: 'SEK',
      providerRef: 'CAPTURE-1',
      source: 'webhook',
    })
  })

  it('kvitterar en durabel betalning även när presentkortsleveransen behöver egen retry', async () => {
    settleShopOrderPaid.mockResolvedValue({ ok: true, giftDeliveryPending: true })

    const response = await POST(completedRequest())

    expect(response.status).toBe(200)
  })

  it('återbetalar en capture som kom efter att ordern blivit terminal', async () => {
    settleShopOrderPaid.mockResolvedValue({
      ok: false,
      reason: 'terminal_order',
      eventId: 'event-1',
    })

    const response = await POST(completedRequest())

    expect(response.status).toBe(200)
    expect(refundPaypalCapture).toHaveBeenCalledWith('CAPTURE-1')
    expect(completeShopPaymentEvent).toHaveBeenCalledWith(
      'event-1',
      'refunded',
      'terminal_order',
    )
    await expect(response.json()).resolves.toEqual({ refunded: true })
  })

  it('returnerar 500 om en obligatorisk auto-refund misslyckas så PayPal försöker igen', async () => {
    settleShopOrderPaid.mockResolvedValue({
      ok: false,
      reason: 'terminal_order',
      eventId: 'event-1',
    })
    refundPaypalCapture.mockResolvedValue(false)

    const response = await POST(completedRequest())

    expect(response.status).toBe(500)
    expect(completeShopPaymentEvent).not.toHaveBeenCalled()
  })

  it('registrerar en signerad PayPal-refund i samma durabla inbox', async () => {
    const response = await POST(refundedRequest())

    expect(response.status).toBe(200)
    expect(settleShopPaymentEvent).toHaveBeenCalledWith({
      provider: 'paypal',
      accountScope: 'paypal:platform',
      providerEventId: 'WH-REFUND-1',
      eventType: 'refund_succeeded',
      orderId: null,
      tenantId: null,
      amountCents: 52900,
      currency: 'SEK',
      providerRef: 'CAPTURE-1',
      source: 'webhook',
    })
  })
})
