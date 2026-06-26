import { describe, it, expect } from 'vitest'
import { mergeCartLine, setCartQty, cartSubtotalCents, cartItemCount, type CartLine } from './types'

// Klient-varukorgens muteringslogik (köp-räls). Merge slår ihop på variantId och
// cappar mot maxQty (available); setQty cappar + droppar vid 0; totaler summerar.

const line = (over: Partial<CartLine> = {}): Omit<CartLine, 'quantity'> => ({
  variantId: 'v1',
  productId: 'p1',
  productName: 'Schampo',
  variantName: 'Standard',
  priceCents: 9900,
  currency: 'SEK',
  imageUrl: null,
  maxQty: null,
  ...over,
})

describe('mergeCartLine', () => {
  it('adds a new line', () => {
    const out = mergeCartLine([], line(), 2)
    expect(out).toHaveLength(1)
    expect(out[0]!.quantity).toBe(2)
  })

  it('merges quantity into an existing line by variantId', () => {
    const start = mergeCartLine([], line(), 1)
    const out = mergeCartLine(start, line(), 2)
    expect(out).toHaveLength(1)
    expect(out[0]!.quantity).toBe(3)
  })

  it('caps merged quantity at maxQty (available stock)', () => {
    const start = mergeCartLine([], line({ maxQty: 3 }), 2)
    const out = mergeCartLine(start, line({ maxQty: 3 }), 5)
    expect(out[0]!.quantity).toBe(3) // 2 + 5 capped at 3
  })

  it('keeps separate lines for different variants', () => {
    const out = mergeCartLine(mergeCartLine([], line(), 1), line({ variantId: 'v2' }), 1)
    expect(out).toHaveLength(2)
  })
})

describe('setCartQty', () => {
  it('sets an explicit quantity', () => {
    const start = mergeCartLine([], line(), 1)
    expect(setCartQty(start, 'v1', 4)[0]!.quantity).toBe(4)
  })

  it('drops the line at quantity 0', () => {
    const start = mergeCartLine([], line(), 2)
    expect(setCartQty(start, 'v1', 0)).toHaveLength(0)
  })

  it('caps at maxQty', () => {
    const start = mergeCartLine([], line({ maxQty: 2 }), 1)
    expect(setCartQty(start, 'v1', 9)[0]!.quantity).toBe(2)
  })
})

describe('cart totals', () => {
  it('sums subtotal and item count', () => {
    let lines = mergeCartLine([], line({ priceCents: 10000 }), 2)
    lines = mergeCartLine(lines, line({ variantId: 'v2', priceCents: 5000 }), 1)
    expect(cartSubtotalCents(lines)).toBe(25000)
    expect(cartItemCount(lines)).toBe(3)
  })
})
