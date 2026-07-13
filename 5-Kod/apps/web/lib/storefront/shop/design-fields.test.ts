import { describe, it, expect } from 'vitest'
import {
  priceMovement,
  PRICE_MOVEMENT_ARROW,
  formatProductPrice,
  shopCategoryChips,
  type ShopData,
  type ShopProduct,
} from './types'

/**
 * goal-64 (migration 0057) — de RENA härledningarna bakom mall-fälten.
 *
 * Kurstavlans pil, "från"-priset och butikens filterchips räknas EN gång, här, och varje mall
 * läser resultatet. Skulle en mall räkna själv kunde två mallar visa samma produkt olika —
 * det är precis den buggen de här testerna stänger.
 */

const product = (over: Partial<ShopProduct> = {}): ShopProduct => ({
  id: 'p1',
  name: 'Pioner',
  description: null,
  priceCents: 14900,
  currency: 'SEK',
  stock: null,
  imageUrl: null,
  imageAlt: null,
  variants: [],
  category: null,
  badge: null,
  compareAtPriceCents: null,
  priceFrom: false,
  ...over,
})

describe('priceMovement — kurstavlans pil härleds ur compare_at, aldrig ur en hårdkodad lista', () => {
  it('priset har GÅTT UPP (dagens > jämförelsepriset) → up / ▲', () => {
    const p = product({ priceCents: 14900, compareAtPriceCents: 12900 })
    expect(priceMovement(p)).toBe('up')
    expect(PRICE_MOVEMENT_ARROW[priceMovement(p)]).toBe('▲')
  })

  it('priset har GÅTT NER → down / ▼', () => {
    const p = product({ priceCents: 8900, compareAtPriceCents: 10900 })
    expect(priceMovement(p)).toBe('down')
    expect(PRICE_MOVEMENT_ARROW[priceMovement(p)]).toBe('▼')
  })

  it('oförändrat pris → flat / —', () => {
    expect(priceMovement(product({ priceCents: 11900, compareAtPriceCents: 11900 }))).toBe('flat')
  })

  it('INGET jämförelsepris → flat (aldrig en påhittad rörelse)', () => {
    const p = product({ priceCents: 11900, compareAtPriceCents: null })
    expect(priceMovement(p)).toBe('flat')
    expect(PRICE_MOVEMENT_ARROW[priceMovement(p)]).toBe('—')
  })
})

describe('formatProductPrice — "från"-priset är produktens egenskap, inte mallens', () => {
  it('price_from = false → naket pris', () => {
    expect(formatProductPrice(product({ priceCents: 95000 }))).toBe('950 kr')
  })

  it('price_from = true → "fr. 950 kr" (aurora p6 / eloria c5)', () => {
    expect(formatProductPrice(product({ priceCents: 95000, priceFrom: true }))).toBe('fr. 950 kr')
  })

  it('annan valuta bär ISO-koden, prefixet ligger utanpå', () => {
    expect(formatProductPrice(product({ priceCents: 10000, currency: 'EUR', priceFrom: true }))).toBe(
      'fr. 100 EUR',
    )
  })
})

describe('shopCategoryChips — kundens egna kategorier, aldrig designens mockade', () => {
  const data = (over: Partial<ShopData> = {}): Pick<ShopData, 'categories' | 'activeCategory'> => ({
    categories: [],
    activeCategory: null,
    ...over,
  })

  it('TOM kategorilista → TOM chip-lista (mallen renderar ingen rad alls)', () => {
    expect(shopCategoryChips(data(), 'Alla')).toEqual([])
  })

  it('kategorier → "Alla/Allt"-chipen först, sedan kundens egna, som länkar', () => {
    const chips = shopCategoryChips(data({ categories: ['Buketter', 'Rosor'] }), 'Alla')
    expect(chips).toEqual([
      { label: 'Alla', href: '/shop', active: true },
      { label: 'Buketter', href: '/shop?kategori=Buketter', active: false },
      { label: 'Rosor', href: '/shop?kategori=Rosor', active: false },
    ])
  })

  it('vald kategori markeras — och bara den', () => {
    const chips = shopCategoryChips(
      data({ categories: ['Buketter', 'Rosor'], activeCategory: 'Rosor' }),
      'Allt',
    )
    expect(chips.filter((c) => c.active)).toHaveLength(1)
    expect(chips.find((c) => c.active)!.label).toBe('Rosor')
  })

  it('svenska tecken URL-kodas (en länk som går sönder är en död chip)', () => {
    const chips = shopCategoryChips(data({ categories: ['Säsong'] }), 'Allt')
    expect(chips[1].href).toBe('/shop?kategori=S%C3%A4song')
  })

  it('okänd activeCategory → ingen chip är aktiv, men raden står kvar (vägen tillbaka)', () => {
    const chips = shopCategoryChips(
      data({ categories: ['Buketter'], activeCategory: 'Finnsinte' }),
      'Alla',
    )
    expect(chips).toHaveLength(2)
    expect(chips.some((c) => c.active)).toBe(false)
  })
})
