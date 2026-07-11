import { describe, it, expect } from 'vitest'
import {
  SHOP_ORDER_ALLOWED_FROM,
  SHOP_ORDER_STATUSES,
  isShopOrderTransitionAllowed,
} from './types'

// Ren matris-test för order-FSM (goal-54). Ingen action mockas — vi testar den
// exporterade pure-helpern + matrisen direkt.

describe('SHOP_ORDER_ALLOWED_FROM', () => {
  it('har en rad för varje status', () => {
    for (const s of SHOP_ORDER_STATUSES) expect(SHOP_ORDER_ALLOWED_FROM[s]).toBeDefined()
  })

  it('terminala states har inga utgångar', () => {
    expect(SHOP_ORDER_ALLOWED_FROM.completed).toEqual([])
    expect(SHOP_ORDER_ALLOWED_FROM.cancelled).toEqual([])
  })

  it('matrisen matchar specen', () => {
    expect(SHOP_ORDER_ALLOWED_FROM.pending).toEqual(['confirmed', 'cancelled'])
    expect(SHOP_ORDER_ALLOWED_FROM.confirmed).toEqual(['ready', 'cancelled'])
    expect(SHOP_ORDER_ALLOWED_FROM.ready).toEqual(['completed'])
  })
})

describe('isShopOrderTransitionAllowed', () => {
  it('tillåter giltiga övergångar', () => {
    expect(isShopOrderTransitionAllowed('pending', 'confirmed')).toBe(true)
    expect(isShopOrderTransitionAllowed('pending', 'cancelled')).toBe(true)
    expect(isShopOrderTransitionAllowed('confirmed', 'ready')).toBe(true)
    expect(isShopOrderTransitionAllowed('confirmed', 'cancelled')).toBe(true)
    expect(isShopOrderTransitionAllowed('ready', 'completed')).toBe(true)
  })

  it('stoppar ogiltiga övergångar', () => {
    expect(isShopOrderTransitionAllowed('pending', 'ready')).toBe(false)
    expect(isShopOrderTransitionAllowed('pending', 'completed')).toBe(false)
    expect(isShopOrderTransitionAllowed('confirmed', 'completed')).toBe(false)
    expect(isShopOrderTransitionAllowed('ready', 'cancelled')).toBe(false)
    expect(isShopOrderTransitionAllowed('ready', 'pending')).toBe(false)
    expect(isShopOrderTransitionAllowed('confirmed', 'pending')).toBe(false)
  })

  it('terminala states går ingenstans', () => {
    for (const target of SHOP_ORDER_STATUSES) {
      if (target !== 'completed') expect(isShopOrderTransitionAllowed('completed', target)).toBe(false)
      if (target !== 'cancelled') expect(isShopOrderTransitionAllowed('cancelled', target)).toBe(false)
    }
  })

  it('samma status = tillåtet (no-op i actionen)', () => {
    for (const s of SHOP_ORDER_STATUSES) expect(isShopOrderTransitionAllowed(s, s)).toBe(true)
  })

  it('okänd/legacy nuvarande status tillåter endast →cancelled', () => {
    expect(isShopOrderTransitionAllowed('reserved', 'cancelled')).toBe(true)
    expect(isShopOrderTransitionAllowed('awaiting_payment', 'cancelled')).toBe(true)
    expect(isShopOrderTransitionAllowed('reserved', 'confirmed')).toBe(false)
    expect(isShopOrderTransitionAllowed('legacy_whatever', 'completed')).toBe(false)
  })
})
