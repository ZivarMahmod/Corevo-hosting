import { describe, expect, it } from 'vitest'
import { calendarLaunchMode, placeOverlaps } from './CalendarBoard'
import type { BookingRow } from './BookingDrawer'
import { resolveTerm, termPlural, type Terminology } from '@/lib/platform/verticals-shared'

const FRISOR: Terminology = { staff: 'Stylist', service: 'Klippning' }
const FLORIST_DB: Terminology = {
  staff: 'Florist',
  staff_plural: 'Florister',
  business: 'Butik',
  primary_cta_label: 'Beställ blommor',
  primary_cta_href: '/shop',
}
const FLORIST_FULL: Terminology = { ...FLORIST_DB, service: 'Beställning' }
const ATELJE: Terminology = {
  staff: 'Formgivare',
  staff_plural: 'Formgivare',
  service: 'Ateljébesök',
  business: 'Ateljé',
}
const FRISOR_ORD = /salong|frisör|barber|klippning|stylist/i

describe('bransch-lagret: terminologin följer branschen', () => {
  it('florist får sina ord — aldrig frisörens', () => {
    expect(resolveTerm(FLORIST_FULL, 'staff', 'Personal')).toBe('Florist')
    expect(termPlural(FLORIST_FULL, 'staff', 'Personal')).toBe('Florister')
    expect(resolveTerm(FLORIST_FULL, 'service', 'Tjänst')).toBe('Beställning')

    for (const key of ['staff', 'service']) {
      expect(resolveTerm(FLORIST_FULL, key, 'Tjänst')).not.toMatch(FRISOR_ORD)
    }
  })

  it('ateljé får sina ord — aldrig frisörens', () => {
    expect(resolveTerm(ATELJE, 'staff', 'Personal')).toBe('Formgivare')
    expect(termPlural(ATELJE, 'staff', 'Personal')).toBe('Formgivare')
    expect(resolveTerm(ATELJE, 'service', 'Tjänst')).toBe('Ateljébesök')
    expect(resolveTerm(ATELJE, 'staff', 'Personal')).not.toMatch(FRISOR_ORD)
  })

  it('frisör är en bransch bland flera — inte motorns default', () => {
    expect(resolveTerm(FRISOR, 'staff', 'Personal')).toBe('Stylist')
    expect(resolveTerm({}, 'staff', 'Personal')).toBe('Personal')
    expect(resolveTerm({}, 'service', 'Tjänst')).toBe('Tjänst')
    expect(resolveTerm(null, 'staff')).toBe('Personal')
    expect(resolveTerm(null, 'service')).not.toMatch(FRISOR_ORD)
  })

  it('floristen utan service-ord faller till neutralt, aldrig till frisörord', () => {
    expect(resolveTerm(FLORIST_DB, 'service', 'Tjänst')).toBe('Tjänst')
    expect(resolveTerm(FLORIST_DB, 'service', 'Tjänst')).not.toMatch(FRISOR_ORD)
  })
})

const TZ = 'Europe/Stockholm'

const booking = (
  id: string,
  startUtc: string,
  endUtc: string,
  serviceName: string,
  staffTitle: string,
): BookingRow => ({
  id,
  startTs: `2026-07-14T${startUtc}:00Z`,
  endTs: `2026-07-14T${endUtc}:00Z`,
  serviceName,
  staffTitle,
  staffId: 'r1',
  priceCents: 50000,
  status: 'confirmed',
  createdAt: '2026-07-01T08:00:00Z',
  note: null,
  customerId: null,
  customerName: 'Kim',
  locationName: null,
  isPast: false,
  paymentStatus: null,
  paymentAmountCents: null,
})

const scenario = (service: string, staff: string) => [
  booking('a', '07:00', '08:00', service, staff),
  booking('b', '07:30', '08:30', service, staff),
  booking('c', '09:00', '10:00', service, staff),
]

const geometry = (rows: BookingRow[]) =>
  placeOverlaps(rows, TZ).map((p) => ({ id: p.booking.id, lane: p.lane, lanes: p.lanes }))

describe('kalendermotorn är bransch-blind', () => {
  it('florist och ateljé får samma geometri med frisör vid samma tider', () => {
    const frisor = geometry(scenario('Klippning', 'Stylist'))
    const florist = geometry(scenario('Sorgbukett', 'Florist'))
    const atelje = geometry(scenario('Ateljébesök', 'Formgivare'))

    expect(frisor).toEqual([
      { id: 'a', lane: 0, lanes: 2 },
      { id: 'b', lane: 1, lanes: 2 },
      { id: 'c', lane: 0, lanes: 1 },
    ])
    expect(florist).toEqual(frisor)
    expect(atelje).toEqual(frisor)
  })

  it('bokningens etiketter bärs av datan, inte av motorn', () => {
    const [first] = placeOverlaps(scenario('Sorgbukett', 'Florist'), TZ)
    expect(first.booking.serviceName).toBe('Sorgbukett')
    expect(first.booking.staffTitle).toBe('Florist')
  })
})

describe('kalenderns responsiva startbeteende', () => {
  it('öppnar Ny bokning från ?ny och prioriterar den framför blockering', () => {
    expect(calendarLaunchMode(new URLSearchParams('ny'))).toBe('new')
    expect(calendarLaunchMode(new URLSearchParams('blockera&ny'))).toBe('new')
  })

  it('öppnar Blockera tid från ?blockera och annars ingenting', () => {
    expect(calendarLaunchMode(new URLSearchParams('blockera'))).toBe('block')
    expect(calendarLaunchMode(new URLSearchParams('vy=dag'))).toBeNull()
  })
})
