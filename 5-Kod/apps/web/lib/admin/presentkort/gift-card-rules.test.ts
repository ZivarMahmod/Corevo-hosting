// Presentkort-reglerna: makulering + inlösen. Ett presentkort är en PENGASKULD —
// ett felutfärdat kort måste gå att spärra, och ett spärrat kort får ALDRIG kunna
// lösas in. Predikaten i types.ts är enda sanningen; både UI (VoidCell) och
// server-actionen (voidGiftCard) filtrerar genom dem. Samma mönster som
// offert-fsm.test.ts: regeln testas ren, inte via mockad Supabase.

import { describe, expect, it } from 'vitest'
import {
  giftCardVoidable,
  type GiftCardStatus,
} from './types'

const ALL_STATUSES: GiftCardStatus[] = ['active', 'redeemed', 'expired', 'void']

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
