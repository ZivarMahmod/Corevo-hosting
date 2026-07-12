// Presentkort-reglerna: makulering + inlösen. Ett presentkort är en PENGASKULD —
// ett felutfärdat kort måste gå att spärra, och ett spärrat kort får ALDRIG kunna
// lösas in. Predikaten i types.ts är enda sanningen; både UI (VoidCell) och
// server-actionen (voidGiftCard) filtrerar genom dem. Samma mönster som
// offert-fsm.test.ts: regeln testas ren, inte via mockad Supabase.

import { describe, expect, it } from 'vitest'
import {
  giftCardRedeemable,
  giftCardVoidable,
  type GiftCardRow,
  type GiftCardStatus,
} from './types'

const ALL_STATUSES: GiftCardStatus[] = ['active', 'redeemed', 'expired', 'void']

/** Minimal kort-stomme; varje test skriver över det fält det handlar om. */
function card(over: Partial<GiftCardRow> = {}): Pick<
  GiftCardRow,
  'status' | 'balanceCents' | 'expiresAt'
> {
  return { status: 'active', balanceCents: 50000, expiresAt: null, ...over }
}

describe('giftCardVoidable — bara ett aktivt kort kan makuleras', () => {
  it('aktivt kort går att makulera', () => {
    expect(giftCardVoidable('active')).toBe(true)
  })

  it('inlöst, utgånget och redan makulerat kort går INTE att makulera', () => {
    expect(giftCardVoidable('redeemed')).toBe(false)
    expect(giftCardVoidable('expired')).toBe(false)
    expect(giftCardVoidable('void')).toBe(false)
  })

  it('exakt ett av de fyra statusarna är makulerbart', () => {
    expect(ALL_STATUSES.filter(giftCardVoidable)).toEqual(['active'])
  })
})

describe('giftCardRedeemable — ETT MAKULERAT KORT KAN ALDRIG LÖSAS IN', () => {
  it('makulerat kort kan inte lösas in — även med fullt saldo och ingen utgång', () => {
    expect(giftCardRedeemable(card({ status: 'void', balanceCents: 50000, expiresAt: null }))).toBe(
      false,
    )
  })

  it('makulering slår igenom oavsett hur stort saldot är', () => {
    for (const balanceCents of [1, 100, 50000, 10_000_000]) {
      expect(giftCardRedeemable(card({ status: 'void', balanceCents }))).toBe(false)
    }
  })

  it('aktivt kort med saldo går att lösa in', () => {
    expect(giftCardRedeemable(card())).toBe(true)
  })

  it('bara aktivt kort är inlösbart — redeemed/expired/void nekas', () => {
    for (const status of ALL_STATUSES) {
      expect(giftCardRedeemable(card({ status }))).toBe(status === 'active')
    }
  })

  it('tomt saldo är inte inlösbart', () => {
    expect(giftCardRedeemable(card({ balanceCents: 0 }))).toBe(false)
    expect(giftCardRedeemable(card({ balanceCents: -1 }))).toBe(false)
  })

  it('passerat utgångsdatum är inte inlösbart, framtida är det', () => {
    const now = new Date('2026-07-12T12:00:00Z')
    expect(giftCardRedeemable(card({ expiresAt: '2026-07-11T12:00:00Z' }), now)).toBe(false)
    expect(giftCardRedeemable(card({ expiresAt: '2026-07-13T12:00:00Z' }), now)).toBe(true)
  })

  it('makulerat kort som ännu inte gått ut är fortfarande obrukbart', () => {
    const now = new Date('2026-07-12T12:00:00Z')
    expect(
      giftCardRedeemable(card({ status: 'void', expiresAt: '2027-01-01T00:00:00Z' }), now),
    ).toBe(false)
  })
})
