import { describe, it, expect } from 'vitest'
import {
  cartLineKind,
  cartLineToReserveItem,
  cartSubtotalCents,
  cartItemCount,
  mergeCartLine,
  setCartQty,
  type CartLine,
} from './types'
import {
  parsePresentkortConfig,
  isAllowedGiftAmount,
  giftDeliveryModes,
} from '../presentkort/types'
import { parseKurserConfig } from '../kurser/types'

// KORGEN BÄR MER ÄN PRODUKTER (goal-64).
//
// Två saker bevisas här:
//   1. REGRESSION — produkt-korgen beter sig EXAKT som förut. Det är den hårda regeln:
//      en rad utan `kind` är en produktrad, och ingenting i dess väg genom korgen och
//      in i reserve-anropet får ha ändrats.
//   2. KONTRAKTET MOT SERVERN — en korgrad skickar ett VAL (variant / belopp / tillfälle),
//      ALDRIG ett pris. Skulle någon manipulera localStorage vinner de ingenting.
//
// Det som INTE kan bevisas här är DB-vakterna (beloppet mot kundens lista, kursplatsens
// hold, en-gångs-utfärdandet) — de bor i migration 0059 som SQL och kan bara bevisas mot
// en riktig Postgres. Deras kontrakt speglas dock av de rena funktionerna nedan
// (isAllowedGiftAmount ÄR samma regel som RPC:ns), och de testas som sådana.

const product = (over: Partial<CartLine> = {}): Omit<CartLine, 'quantity'> => ({
  variantId: 'var-1',
  productId: 'prod-1',
  productName: 'Bukett',
  variantName: 'Standard',
  priceCents: 45000,
  currency: 'SEK',
  imageUrl: null,
  maxQty: null,
  ...over,
})

describe('produkt-korgen (regression — får INTE ha ändrat beteende)', () => {
  it('en rad utan kind ÄR en produktrad', () => {
    expect(cartLineKind({ kind: undefined })).toBe('product')
  })

  it('mergar på variantId och summerar som förut', () => {
    let lines = mergeCartLine([], product(), 1)
    lines = mergeCartLine(lines, product(), 2)
    expect(lines).toHaveLength(1)
    expect(lines[0].quantity).toBe(3)
    expect(cartSubtotalCents(lines)).toBe(135000)
    expect(cartItemCount(lines)).toBe(3)
  })

  it('kapar mot maxQty (lagret) precis som förut', () => {
    const lines = mergeCartLine([], product({ maxQty: 2 }), 5)
    expect(setCartQty(lines, 'var-1', 9)[0].quantity).toBe(2)
    expect(setCartQty(lines, 'var-1', 0)).toEqual([])
  })

  it('skickar variant_id + antal till servern — och INGET pris', () => {
    const line: CartLine = { ...product(), quantity: 2 }
    const item = cartLineToReserveItem(line)
    expect(item).toEqual({ kind: 'product', variantId: 'var-1', quantity: 2 })
    expect(item).not.toHaveProperty('priceCents')
  })
})

describe('presentkort i korgen', () => {
  const gift = (amount: number, mode: 'digital' | 'in_store' = 'digital'): CartLine => ({
    variantId: `gift:${amount}:${mode}`,
    productId: 'giftcard',
    productName: `Presentkort ${amount} kr`,
    variantName: 'Digitalt',
    priceCents: amount * 100,
    currency: 'SEK',
    quantity: 1,
    imageUrl: null,
    maxQty: null,
    kind: 'giftcard',
    giftAmount: amount,
    giftDeliveryMode: mode,
  })

  it('skickar VALET (belopp), aldrig ett pris', () => {
    const item = cartLineToReserveItem(gift(500))
    expect(item.kind).toBe('giftcard')
    expect(item.giftAmount).toBe(500)
    expect(item.quantity).toBe(1) // ett kort = en rad (idempotens-nyckeln är orderraden)
    expect(item).not.toHaveProperty('priceCents')
    expect(item.variantId).toBeUndefined() // presentkortet är ALDRIG en produktvariant
  })

  it('samma belopp + leverans slås ihop; olika belopp är olika rader', () => {
    let lines = mergeCartLine([], gift(500), 1)
    lines = mergeCartLine(lines, gift(500), 1)
    expect(lines).toHaveLength(1)
    lines = mergeCartLine(lines, gift(1000), 1)
    expect(lines).toHaveLength(2)
  })

  it('ett belopp utanför kundens lista avvisas (samma regel som RPC:n)', () => {
    const config = parsePresentkortConfig({ amounts: [300, 500, 750, 1000] })
    expect(isAllowedGiftAmount(config, 500)).toBe(true)
    expect(isAllowedGiftAmount(config, 1)).toBe(false) // klienten hittade på ett belopp
    expect(isAllowedGiftAmount(config, 600)).toBe(false) // en annan kunds belopp
    expect(isAllowedGiftAmount(config, -500)).toBe(false)
    expect(isAllowedGiftAmount(config, 0)).toBe(false)
  })

  it('beloppen är KUNDENS — tre kunder, tre listor', () => {
    expect(parsePresentkortConfig({ amounts: [300, 500, 750, 1000] }).amountPresets).toEqual([
      300, 500, 750, 1000,
    ])
    expect(parsePresentkortConfig({ amounts: [600, 800, 1200, 2000] }).amountPresets).toEqual([
      600, 800, 1200, 2000,
    ])
    expect(parsePresentkortConfig({ amounts: [500, 900, 1500, 2500] }).amountPresets).toEqual([
      500, 900, 1500, 2500,
    ])
  })

  it('TOM lista = inga belopp (ingen smyg-default) → inget belopp är giltigt', () => {
    const config = parsePresentkortConfig({ amounts: [] })
    expect(config.amountPresets).toEqual([])
    expect(isAllowedGiftAmount(config, 500)).toBe(false)
  })

  it('saknad nyckel → 0036:s default (befintliga kunder tappar inga belopp)', () => {
    expect(parsePresentkortConfig({}).amountPresets).toEqual([200, 500, 1000])
    // 0036:s ursprungliga nyckel läses fortfarande.
    expect(parsePresentkortConfig({ amount_presets: [250] }).amountPresets).toEqual([250])
  })

  it('kodserien är kundens (Blomstertorget: "1962-")', () => {
    expect(parsePresentkortConfig({ code_prefix: '1962-' }).codePrefix).toBe('1962-')
    expect(parsePresentkortConfig({}).codePrefix).toBe('')
  })

  it('Auroras två leveranssätt går att konfigurera; annars härleds de ur varianten', () => {
    expect(parsePresentkortConfig({ delivery_modes: ['digital', 'in_store'] }).deliveryModes).toEqual([
      'digital',
      'in_store',
    ])
    expect(giftDeliveryModes(parsePresentkortConfig({ fulfilment: 'physical' }))).toEqual(['in_store'])
    expect(giftDeliveryModes(parsePresentkortConfig({ fulfilment: 'digital' }))).toEqual(['digital'])
  })
})

describe('kursplats i korgen', () => {
  const seat = (qty: number, seatsLeft: number | null): CartLine => ({
    variantId: 'event:ev-1',
    productId: 'ev-1',
    productName: 'Bindteknik (kursplats)',
    variantName: 'Kursplats',
    priceCents: 89000,
    currency: 'SEK',
    quantity: qty,
    imageUrl: null,
    maxQty: seatsLeft,
    kind: 'event',
    eventId: 'ev-1',
  })

  it('skickar tillfället + antal platser, aldrig kursens pris', () => {
    const item = cartLineToReserveItem(seat(2, 10))
    expect(item).toEqual({ kind: 'event', eventId: 'ev-1', quantity: 2 })
    expect(item).not.toHaveProperty('priceCents')
  })

  it('SISTA PLATSEN kan inte dubbelbokas i korgen — capacity är lager', () => {
    // maxQty = lediga platser (klient-hinten, samma roll som produktens available).
    // Den slutgiltiga vakten är reserved_qty-holdet i reserve_shop_order (0059): den
    // FÖRSTA korgen som når kassan tar platsen, den andra får 23P01 (out_of_stock).
    const lines = mergeCartLine([], seat(1, 1), 1)
    expect(lines[0].quantity).toBe(1)
    const grabbed = mergeCartLine(lines, seat(1, 1), 1) // försök lägga sista platsen två gånger
    expect(grabbed[0].quantity).toBe(1) // kapad mot 1 ledig plats — aldrig 2
    expect(setCartQty(grabbed, 'event:ev-1', 5)[0].quantity).toBe(1)
  })
})

describe('kurs-betalning per kund', () => {
  it('default = betalas på plats (den befintliga anmälan är orörd)', () => {
    expect(parseKurserConfig({}).payment).toBe('onsite')
    expect(parseKurserConfig(null).payment).toBe('onsite')
    expect(parseKurserConfig({ payment: 'nonsens' }).payment).toBe('onsite')
  })

  it('kunden kan välja kassan (Calytrix)', () => {
    expect(parseKurserConfig({ payment: 'checkout' }).payment).toBe('checkout')
  })
})
