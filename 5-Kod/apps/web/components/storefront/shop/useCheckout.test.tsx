// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCheckout, type UseCheckout } from './useCheckout'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  confirmOrder: vi.fn(),
  push: vi.fn(),
  reserveOrder: vi.fn(),
  startPaypalCheckout: vi.fn(),
  startShopCheckout: vi.fn(),
  subtotalCents: 1000,
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('./CartProvider', () => ({
  useCart: () => ({
    lines: [{ variantId: 'variant-1', currency: 'SEK', quantity: 1, priceCents: 1000 }],
    token: 'cart-token',
    subtotalCents: mocks.subtotalCents,
    clear: mocks.clear,
  }),
}))
vi.mock('@/lib/storefront/shop/actions', () => ({
  reserveOrder: mocks.reserveOrder,
  confirmOrder: mocks.confirmOrder,
  cancelOrder: vi.fn(),
  startShopCheckout: mocks.startShopCheckout,
  startPaypalCheckout: mocks.startPaypalCheckout,
}))

let checkout: UseCheckout

function Harness({ paymentMethods = [] }: { paymentMethods?: ('card' | 'paypal')[] }) {
  checkout = useCheckout({ fulfilment: 'ship', shippingOptions: [], paymentMethods })
  return null
}

const customer = {
  name: 'Ada',
  email: 'ada@example.se',
  phone: '0701',
  shipAddress: 'Gatan 1',
  acceptTerms: true,
}

describe('useCheckout customer validation', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    mocks.subtotalCents = 1000
    mocks.reserveOrder.mockResolvedValue({ ok: true, orderId: 'order-1' })
    mocks.confirmOrder.mockResolvedValue({ ok: true, orderId: 'order-1', requiresPayment: false })
    host = document.createElement('div')
    root = createRoot(host)
    await act(async () => root.render(<Harness />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    vi.resetAllMocks()
  })

  it('validerar och normaliserar kunduppgifter i den gemensamma checkoutägaren', async () => {
    await expect(checkout.placeOrder({ name: '', email: '', phone: '', acceptTerms: true }))
      .resolves.toBe('Fyll i namn, e-post och telefon.')
    await expect(checkout.placeOrder({ name: 'A', email: 'fel', phone: '1', acceptTerms: true }))
      .resolves.toBe('Kontrollera e-postadressen.')
    await expect(checkout.placeOrder({ name: 'A', email: 'a@b.se', phone: '1', acceptTerms: true }))
      .resolves.toBe('Fyll i leveransadress.')
    await expect(checkout.placeOrder({
      name: 'A', email: 'a@b.se', phone: '1', shipAddress: 'Gatan 1', acceptTerms: false,
    })).resolves.toBe('Godkänn köpvillkoren för att slutföra köpet.')

    await act(async () => {
      await checkout.placeOrder({
        name: '  Ada  ',
        email: '  ada@example.se  ',
        phone: '  0701  ',
        shipAddress: '  Gatan 1  ',
        note: '  Ring på  ',
        acceptTerms: true,
      })
    })

    expect(mocks.confirmOrder).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ada',
      email: 'ada@example.se',
      phone: '0701',
      shipAddress: 'Gatan 1',
      note: 'Ring på',
      acceptTerms: true,
    }))
  })
})

describe('useCheckout payment retries', () => {
  let host: HTMLDivElement
  let root: Root

  async function mount(paymentMethods: ('card' | 'paypal')[] = []) {
    host = document.createElement('div')
    root = createRoot(host)
    await act(async () => root.render(<Harness paymentMethods={paymentMethods} />))
  }

  beforeEach(() => {
    mocks.subtotalCents = 1000
    mocks.reserveOrder.mockResolvedValue({ ok: true, orderId: 'order-1' })
    mocks.confirmOrder.mockResolvedValue({ ok: true, orderId: 'order-1', requiresPayment: true })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    vi.resetAllMocks()
  })

  it('låser upp efter kastat confirm-fel och visar ett ärligt generiskt fel', async () => {
    mocks.confirmOrder
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, orderId: 'order-1', requiresPayment: false })
    await mount()

    let first: string | null = null
    await act(async () => { first = await checkout.placeOrder(customer) })
    expect(first).toBe('Något gick fel. Försök igen.')
    expect(checkout.submitting).toBe(false)

    await act(async () => { await checkout.placeOrder(customer) })
    expect(mocks.confirmOrder).toHaveBeenCalledTimes(2)
    expect(mocks.push).toHaveBeenCalledWith('/bekraftelse/order-1')
  })

  it('behåller bekräftad order vid provider-fel och låser först efter lyckad redirect', async () => {
    mocks.startShopCheckout
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, url: 'https://checkout.example/order-1' })
    await mount(['card'])

    let first: string | null = null
    await act(async () => { first = await checkout.placeOrder(customer) })
    expect(first).toBe('Något gick fel. Försök igen.')
    expect(checkout.submitting).toBe(false)

    await act(async () => { await checkout.placeOrder(customer) })
    expect(mocks.confirmOrder).toHaveBeenCalledTimes(1)
    expect(mocks.startShopCheckout).toHaveBeenCalledTimes(2)
    expect(mocks.clear).toHaveBeenCalledTimes(1)

    await act(async () => { await checkout.placeOrder(customer) })
    expect(mocks.startShopCheckout).toHaveBeenCalledTimes(2)
  })

  it('behåller korg och sida när providern returnerar ett felmeddelande', async () => {
    mocks.startShopCheckout.mockResolvedValue({
      ok: false,
      reason: 'unavailable',
      message: 'Kortbetalning är tillfälligt stängd.',
    })
    await mount(['card'])

    let result: string | null = null
    await act(async () => { result = await checkout.placeOrder(customer) })

    expect(result).toBe('Kortbetalning är tillfälligt stängd.')
    expect(checkout.submitting).toBe(false)
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('startar ingen PayPal-provider för en nolltotal', async () => {
    mocks.subtotalCents = 0
    mocks.confirmOrder.mockResolvedValue({ ok: true, orderId: 'order-1', requiresPayment: false })
    await mount(['paypal'])

    await act(async () => { await checkout.placeOrder(customer) })

    expect(mocks.startPaypalCheckout).not.toHaveBeenCalled()
    expect(mocks.clear).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith('/bekraftelse/order-1')
  })
})
