import { describe, it, expect, vi, beforeEach } from 'vitest'

// BETAL-CALLBACKENS IDEMPOTENS (goal-64, hård regel).
//
// PayPal levererar om vid varje icke-200 och kan dubbel-leverera; dessutom kan RETUREN
// (kunden kommer tillbaka) och WEBHOOKEN landa samtidigt för samma betalning. Två
// effekter av en betalning = dubbelbokfört lager och ett felaktigt kvitto. Testet vaktar
// att en andra leverans blir en NO-OP, och att en capture på fel belopp aldrig markerar
// ordern som betald.

type OrderRow = {
  id: string
  tenant_id: string
  total_cents: number
  payment_status: string
  status: string
}

let order: OrderRow | null
let orderLookupError: { message: string } | null
let paymentUpdateError: { message: string } | null
let paymentUpdateRow: { id: string } | null
let rpcError: { message: string } | null
const rpc = vi.fn()
const paymentsUpdate = vi.fn()
const deliverIssuedGiftCards = vi.fn()

vi.mock('@/lib/platform/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'shop_orders') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: order, error: orderLookupError }) }),
          }),
        }
      }
      // payments: .update(...).eq().eq().neq().select().maybeSingle()
      const chain = {
        eq: () => chain,
        neq: () => chain,
        select: () => chain,
        maybeSingle: async () => ({ data: paymentUpdateRow, error: paymentUpdateError }),
      }
      return {
        update: (patch: unknown) => {
          paymentsUpdate(patch)
          return chain
        },
      }
    },
    rpc: (...args: unknown[]) => {
      rpc(...args)
      return Promise.resolve({ error: rpcError })
    },
  }),
}))

vi.mock('@/lib/observability', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/notifications/gift', () => ({ deliverIssuedGiftCards }))

const { settleShopOrderPaid } = await import('./settle')

beforeEach(() => {
  rpc.mockClear()
  paymentsUpdate.mockClear()
  deliverIssuedGiftCards.mockClear()
  orderLookupError = null
  paymentUpdateError = null
  paymentUpdateRow = { id: 'payment_1' }
  rpcError = null
  order = {
    id: 'o1',
    tenant_id: 't1',
    total_cents: 52900,
    payment_status: 'unpaid',
    status: 'awaiting_payment',
  }
})

describe('settleShopOrderPaid — idempotent betal-callback', () => {
  it('markerar ordern betald första gången', async () => {
    const res = await settleShopOrderPaid({
      orderId: 'o1',
      amountCents: 52900,
      providerRef: 'PP-1',
    })
    expect(res.ok).toBe(true)
    expect(paymentsUpdate).toHaveBeenCalledWith({ status: 'succeeded' })
    expect(rpc).toHaveBeenCalledWith('mark_shop_order_paid', { p_order_id: 'o1' })
    expect(deliverIssuedGiftCards).toHaveBeenCalledWith(expect.anything(), 't1', 'o1')
  })

  it('en redan betald order backfillar presentkortsleveransen utan att committa igen', async () => {
    order = {
      id: 'o1',
      tenant_id: 't1',
      total_cents: 52900,
      payment_status: 'paid',
      status: 'pending',
    }
    const res = await settleShopOrderPaid({
      orderId: 'o1',
      amountCents: 52900,
      providerRef: 'PP-1',
    })
    expect(res.ok).toBe(true)
    expect(rpc).not.toHaveBeenCalled()
    expect(paymentsUpdate).not.toHaveBeenCalled()
    expect(deliverIssuedGiftCards).toHaveBeenCalledWith(expect.anything(), 't1', 'o1')
  })

  it('rapporterar betalningen som lyckad men leveransen som väntande när presentkortsmejl kastar', async () => {
    deliverIssuedGiftCards.mockRejectedValueOnce(new Error('relay outcome unknown'))

    const res = await settleShopOrderPaid({
      orderId: 'o1',
      amountCents: 52900,
      providerRef: 'PP-1',
    })

    expect(res).toEqual({ ok: true, giftDeliveryPending: true })
    expect(rpc).toHaveBeenCalledWith('mark_shop_order_paid', { p_order_id: 'o1' })
  })

  it('en capture på FÖR LITET belopp markerar aldrig ordern som betald', async () => {
    const res = await settleShopOrderPaid({ orderId: 'o1', amountCents: 100, providerRef: 'PP-1' })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('amount_mismatch')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('återupplivar aldrig en order vars hold redan har släppts', async () => {
    order = { ...order!, status: 'expired' }

    const res = await settleShopOrderPaid({
      orderId: 'o1',
      amountCents: 52900,
      providerRef: 'CAPTURE-1',
    })

    expect(res).toEqual({ ok: false, reason: 'terminal_order' })
    expect(paymentsUpdate).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    expect(deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('en okänd order rör ingenting', async () => {
    order = null
    const res = await settleShopOrderPaid({ orderId: 'x', amountCents: 1, providerRef: 'PP-1' })
    expect(res.ok).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('skriver ALDRIG PayPal-referensen i Stripes PI-kolumn (refund-vägen slår upp på den)', async () => {
    await settleShopOrderPaid({ orderId: 'o1', amountCents: 52900, providerRef: 'PP-1' })
    const patch = paymentsUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(patch).not.toHaveProperty('stripe_payment_intent_id')
  })

  it('returnerar fel och stoppar flödet när orderuppslaget fallerar', async () => {
    orderLookupError = { message: 'db unavailable' }

    const res = await settleShopOrderPaid({
      orderId: 'o1',
      amountCents: 52900,
      providerRef: 'PP-1',
    })

    expect(res).toEqual({ ok: false, reason: 'order_lookup_failed' })
    expect(paymentsUpdate).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    expect(deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('returnerar fel och committar inte ordern när payment-update fallerar', async () => {
    paymentUpdateError = { message: 'write failed' }

    const res = await settleShopOrderPaid({
      orderId: 'o1',
      amountCents: 52900,
      providerRef: 'PP-1',
    })

    expect(res).toEqual({ ok: false, reason: 'payment_update_failed' })
    expect(rpc).not.toHaveBeenCalled()
    expect(deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('committar inte en order när den skyddade payment-update:n inte matchar någon rad', async () => {
    paymentUpdateRow = null

    const res = await settleShopOrderPaid({
      orderId: 'o1',
      amountCents: 52900,
      providerRef: 'PP-1',
    })

    expect(res).toEqual({ ok: false, reason: 'payment_not_updated' })
    expect(rpc).not.toHaveBeenCalled()
    expect(deliverIssuedGiftCards).not.toHaveBeenCalled()
  })

  it('returnerar fel och levererar inte presentkort när order-commit fallerar', async () => {
    rpcError = { message: 'rpc failed' }

    const res = await settleShopOrderPaid({
      orderId: 'o1',
      amountCents: 52900,
      providerRef: 'PP-1',
    })

    expect(res).toEqual({ ok: false, reason: 'order_commit_failed' })
    expect(deliverIssuedGiftCards).not.toHaveBeenCalled()
  })
})
