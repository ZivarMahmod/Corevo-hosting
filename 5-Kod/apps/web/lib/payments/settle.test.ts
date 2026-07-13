import { describe, it, expect, vi, beforeEach } from 'vitest'

// BETAL-CALLBACKENS IDEMPOTENS (goal-64, hård regel).
//
// PayPal levererar om vid varje icke-200 och kan dubbel-leverera; dessutom kan RETUREN
// (kunden kommer tillbaka) och WEBHOOKEN landa samtidigt för samma betalning. Två
// effekter av en betalning = dubbelbokfört lager och ett felaktigt kvitto. Testet vaktar
// att en andra leverans blir en NO-OP, och att en capture på fel belopp aldrig markerar
// ordern som betald.

type OrderRow = { id: string; tenant_id: string; total_cents: number; payment_status: string }

let order: OrderRow | null
const rpc = vi.fn()
const paymentsUpdate = vi.fn()

vi.mock('@/lib/platform/service', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'shop_orders') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: order }) }) }),
        }
      }
      // payments: .update(...).eq().eq().neq()
      const chain = {
        eq: () => chain,
        neq: () => chain,
      }
      return {
        update: (patch: unknown) => {
          paymentsUpdate(patch)
          return chain
        },
      }
    },
    rpc,
  }),
}))

vi.mock('@/lib/observability', () => ({ captureException: vi.fn() }))

const { settleShopOrderPaid } = await import('./settle')

beforeEach(() => {
  rpc.mockClear()
  paymentsUpdate.mockClear()
  order = { id: 'o1', tenant_id: 't1', total_cents: 52900, payment_status: 'unpaid' }
})

describe('settleShopOrderPaid — idempotent betal-callback', () => {
  it('markerar ordern betald första gången', async () => {
    const res = await settleShopOrderPaid({ orderId: 'o1', amountCents: 52900, providerRef: 'PP-1' })
    expect(res.ok).toBe(true)
    expect(paymentsUpdate).toHaveBeenCalledWith({ status: 'succeeded' })
    expect(rpc).toHaveBeenCalledWith('mark_shop_order_paid', { p_order_id: 'o1' })
  })

  it('EN ANDRA leverans av samma event gör ingenting (webhook + retur kan krocka)', async () => {
    order = { id: 'o1', tenant_id: 't1', total_cents: 52900, payment_status: 'paid' }
    const res = await settleShopOrderPaid({ orderId: 'o1', amountCents: 52900, providerRef: 'PP-1' })
    expect(res.ok).toBe(true) // no-op, men INTE ett fel — annars retry-loopar PayPal
    expect(rpc).not.toHaveBeenCalled()
    expect(paymentsUpdate).not.toHaveBeenCalled()
  })

  it('en capture på FÖR LITET belopp markerar aldrig ordern som betald', async () => {
    const res = await settleShopOrderPaid({ orderId: 'o1', amountCents: 100, providerRef: 'PP-1' })
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('amount_mismatch')
    expect(rpc).not.toHaveBeenCalled()
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
})
