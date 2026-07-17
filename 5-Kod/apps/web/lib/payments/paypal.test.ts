import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { capturePaypalOrder, refundPaypalCapture } from './paypal'

const originalEnv = {
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
  PAYPAL_SECRET: process.env.PAYPAL_SECRET,
  PAYPAL_ENV: process.env.PAYPAL_ENV,
}

beforeEach(() => {
  process.env.PAYPAL_CLIENT_ID = 'client'
  process.env.PAYPAL_SECRET = 'secret'
  process.env.PAYPAL_ENV = 'sandbox'
})

afterEach(() => {
  vi.unstubAllGlobals()
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('PayPal capture/refund rail', () => {
  it('bevarar capture-id:t som krävs för terminal auto-refund', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'COMPLETED',
            purchase_units: [
              {
                custom_id: 'order-1',
                payments: {
                  captures: [
                    {
                      id: 'CAPTURE-1',
                      amount: { value: '529.00', currency_code: 'SEK' },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 201 },
        ),
      )
    vi.stubGlobal('fetch', fetch)

    await expect(capturePaypalOrder('PAYPAL-ORDER-1')).resolves.toMatchObject({
      reference: 'order-1',
      captureId: 'CAPTURE-1',
      amountCents: 52900,
    })
  })

  it('skickar en idempotent full refund till rätt capture', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 201 }))
    vi.stubGlobal('fetch', fetch)

    await expect(refundPaypalCapture('CAPTURE-1')).resolves.toBe(true)
    expect(fetch).toHaveBeenLastCalledWith(
      'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE-1/refund',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'paypal-request-id': 'refund-CAPTURE-1' }),
        body: '{}',
      }),
    )
  })

  it('rapporterar misslyckad refund utan att låtsas att den lyckades', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', fetch)

    await expect(refundPaypalCapture('CAPTURE-1')).resolves.toBe(false)
  })
})
