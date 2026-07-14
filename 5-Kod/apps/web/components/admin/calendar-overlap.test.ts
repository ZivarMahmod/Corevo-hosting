import { describe, expect, it } from 'vitest'
import { placeOverlaps } from './CalendarBoard'
import type { BookingRow } from './BookingDrawer'

/** goal-66: krockande bokningar måste ligga SIDA VID SIDA i kolumnen. En bokning som
 *  ritas ovanpå en annan är en bokning användaren inte ser — och en osedd bokning blir
 *  en missad kund. Testet skyddar den regeln, inte utseendet. */

const TZ = 'Europe/Stockholm'

/** 2026-07-14 är sommartid (UTC+2), så 09:00 lokalt = 07:00Z. Att testet uttrycks i
 *  UTC och förväntas i lokal tid är hela poängen: geometrin får aldrig räknas på
 *  UTC-offset, den ska läsa väggklockan. */
const booking = (id: string, startUtc: string, endUtc: string): BookingRow => ({
  id,
  startTs: `2026-07-14T${startUtc}:00Z`,
  endTs: `2026-07-14T${endUtc}:00Z`,
  serviceName: 'Klipp',
  staffTitle: 'Vera',
  staffId: 'vera',
  priceCents: 74500,
  status: 'confirmed',
  createdAt: '2026-07-01T08:00:00Z',
  note: null,
  customerId: null,
  customerName: 'Anna',
  locationName: null,
  isPast: false,
  paymentStatus: null,
  paymentAmountCents: null,
})

const laneOf = (placed: ReturnType<typeof placeOverlaps>, id: string) =>
  placed.find((p) => p.booking.id === id)!

describe('placeOverlaps', () => {
  it('lägger bokningar som inte krockar i samma bana, full bredd', () => {
    const placed = placeOverlaps(
      [booking('a', '07:00', '08:00'), booking('b', '08:00', '09:00')],
      TZ,
    )
    expect(laneOf(placed, 'a')).toMatchObject({ lane: 0, lanes: 1 })
    expect(laneOf(placed, 'b')).toMatchObject({ lane: 0, lanes: 1 })
  })

  it('delar bredden mellan två krockande bokningar', () => {
    const placed = placeOverlaps(
      [booking('a', '07:00', '08:00'), booking('b', '07:30', '08:30')],
      TZ,
    )
    expect(laneOf(placed, 'a').lane).toBe(0)
    expect(laneOf(placed, 'b').lane).toBe(1)
    expect(laneOf(placed, 'a').lanes).toBe(2)
    expect(laneOf(placed, 'b').lanes).toBe(2)
  })

  it('återanvänder en bana när den blivit fri', () => {
    // a 09–10, b 09:30–10:30 (krock), c 10:30–11:30 (fri igen → bana 0).
    const placed = placeOverlaps(
      [booking('a', '07:00', '08:00'), booking('b', '07:30', '08:30'), booking('c', '08:30', '09:30')],
      TZ,
    )
    expect(laneOf(placed, 'c').lane).toBe(0)
    // c krockar med ingen → full bredd, trots att dagen har haft en krock.
    expect(laneOf(placed, 'c').lanes).toBe(1)
  })

  it('smalnar bara av de bokningar som faktiskt krockar', () => {
    // Tre krockar på morgonen, en ensam på eftermiddagen. Eftermiddagsbokningen ska
    // INTE bli en tredjedel bred bara för att morgonen var full.
    const placed = placeOverlaps(
      [
        booking('a', '07:00', '08:00'),
        booking('b', '07:15', '08:15'),
        booking('c', '07:30', '08:30'),
        booking('kvall', '14:00', '15:00'),
      ],
      TZ,
    )
    expect(laneOf(placed, 'a').lanes).toBe(3)
    expect(laneOf(placed, 'c').lanes).toBe(3)
    expect(laneOf(placed, 'kvall')).toMatchObject({ lane: 0, lanes: 1 })
  })

  it('räknar INTE kant-i-kant-tider som en krock', () => {
    // 10:30–11:00 och 11:00–11:30 rör vid varandra men överlappar inte. De ska dela
    // bana och båda vara FULLBREDDA — de ligger under varandra i tid, inte ovanpå.
    // (En granskning flaggade detta som bugg 2026-07-14; det är avsiktligt. Ett
    // `busyUntil < start` här hade halverat bredden på varje normal arbetsdag.)
    const placed = placeOverlaps(
      [booking('fore', '08:30', '09:00'), booking('efter', '09:00', '09:30')],
      TZ,
    )
    expect(laneOf(placed, 'fore')).toMatchObject({ lane: 0, lanes: 1 })
    expect(laneOf(placed, 'efter')).toMatchObject({ lane: 0, lanes: 1 })
  })

  it('behåller alla bokningar — ingen får tappas bort', () => {
    const input = [
      booking('a', '07:00', '08:00'),
      booking('b', '07:00', '08:00'),
      booking('c', '07:00', '08:00'),
    ]
    const placed = placeOverlaps(input, TZ)
    expect(placed).toHaveLength(3)
    // Tre identiska tider → tre egna banor, ingen döljer en annan.
    expect(new Set(placed.map((p) => p.lane))).toEqual(new Set([0, 1, 2]))
  })
})
