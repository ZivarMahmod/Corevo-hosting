// Radera-regeln för offertförfrågningar: spam ska gå att rensa, men en AFFÄR får
// aldrig raderas bort ur historiken. offertDeletable är enda sanningen — både
// DeleteForm (UI) och deleteOffertRequest (server) filtrerar genom den, och
// servern läser statusen ur DB:n, aldrig ur formuläret.
//
// OBS: det finns INGEN FK offert_requests → shop_orders i schemat (0032/0033), så
// "har blivit en order" mäts på de signaler schemat faktiskt bär:
// status='accepted' (kunden tackade ja) och payment_status ≠ 'unpaid' (pengar).

import { describe, expect, it } from 'vitest'
import { OFFERT_STATUSES, offertDeletable } from './types'

describe('offertDeletable — spam raderas, affärer skyddas', () => {
  it('en accepterad offert kan INTE raderas (den är affären/ordern)', () => {
    expect(offertDeletable('accepted', 'unpaid')).toBe(false)
  })

  it('en betald offert kan INTE raderas — pengar har rört raden', () => {
    expect(offertDeletable('new', 'paid')).toBe(false)
    expect(offertDeletable('quoted', 'paid')).toBe(false)
  })

  it('en återbetald offert kan INTE raderas — pengar har rört raden', () => {
    expect(offertDeletable('closed', 'refunded')).toBe(false)
  })

  it('accepterad OCH betald kan förstås inte heller raderas', () => {
    expect(offertDeletable('accepted', 'paid')).toBe(false)
  })

  it('spam (ny, obetald) KAN raderas — det är hela poängen', () => {
    expect(offertDeletable('new', 'unpaid')).toBe(true)
  })

  it('obetalda icke-accepterade lägen är raderbara', () => {
    for (const status of ['new', 'reviewing', 'quoted', 'declined', 'closed']) {
      expect(offertDeletable(status, 'unpaid')).toBe(true)
    }
  })

  it('accepted är det ENDA statusläget som blockerar på egen hand', () => {
    const blocked = OFFERT_STATUSES.filter((s) => !offertDeletable(s, 'unpaid'))
    expect(blocked).toEqual(['accepted'])
  })

  it('varje payment_status utom unpaid blockerar, oavsett status', () => {
    for (const pay of ['paid', 'refunded']) {
      for (const status of OFFERT_STATUSES) {
        expect(offertDeletable(status, pay)).toBe(false)
      }
    }
  })
})
