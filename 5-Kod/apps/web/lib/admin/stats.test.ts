import { describe, it, expect } from 'vitest'
import {
  aggregateStats,
  availableMinutes,
  collectAllPages,
  isPeriod,
  periodRange,
  DEFAULT_WORKDAY_MIN,
  type StatBooking,
  type StatsInput,
} from './stats'

describe('statistikens stabila pagination', () => {
  it('hämtar fler än PostgRESTs vanliga 1000 rader utan att tappa svansen', async () => {
    const source = Array.from({ length: 2_501 }, (_, id) => ({ id }))
    const calls: Array<[number, number]> = []
    const rows = await collectAllPages(async (from, to) => {
      calls.push([from, to])
      return { data: source.slice(from, to + 1), error: null }
    })

    expect(rows).toHaveLength(2_501)
    expect(rows.at(-1)).toEqual({ id: 2_500 })
    expect(calls).toEqual([
      [0, 999],
      [1_000, 1_999],
      [2_000, 2_999],
    ])
  })

  it('kastar vid ett sidfel i stället för att visa trunkerad statistik', async () => {
    await expect(
      collectAllPages(async (from) =>
        from === 0
          ? { data: Array.from({ length: 1_000 }, (_, id) => ({ id })), error: null }
          : { data: null, error: { message: 'page failed' } },
      ),
    ).rejects.toThrow('page failed')
  })
})

// Aggregeringen är ren (ingen DB) just för att kunna låsas här. Fönstret nedan är
// EN vecka i Europe/Stockholm: mån 2026-06-01 → mån 2026-06-08.
const TZ = 'Europe/Stockholm'
const FROM = '2026-06-01T00:00:00.000Z'
const TO = '2026-06-08T00:00:00.000Z'

function booking(over: Partial<StatBooking> = {}): StatBooking {
  return {
    startTs: '2026-06-01T08:00:00.000Z',
    endTs: '2026-06-01T09:00:00.000Z',
    status: 'confirmed',
    priceCents: 60_000,
    staffId: 's1',
    staffName: 'Alex',
    serviceName: 'Behandling A',
    customerId: 'c1',
    ...over,
  }
}

function input(over: Partial<StatsInput> = {}): StatsInput {
  return {
    rows: [],
    prevRows: [],
    trendRows: [],
    customers: [],
    shifts: [],
    activeStaff: 1,
    from: FROM,
    to: TO,
    timeZone: TZ,
    ...over,
  }
}

describe('aggregateStats — pengarna', () => {
  it('skiljer bokningsvärde från genomfört tjänstevärde', () => {
    const s = aggregateStats(
      input({
        rows: [
          booking({ priceCents: 60_000 }),
          booking({ priceCents: 40_000, status: 'completed' }),
          booking({ priceCents: 99_900, status: 'cancelled' }),
        ],
      }),
    )
    expect(s.bookedValueCents).toBe(100_000)
    expect(s.realizedValueCents).toBe(40_000)
    expect(s.bookings).toBe(2)
    expect(s.cancellations).toBe(1)
  })

  it('avbokningsgrad = avbokade / (aktiva + avbokade + uteblivna)', () => {
    const s = aggregateStats(
      input({ rows: [booking(), booking(), booking({ status: 'cancelled' })] }),
    )
    expect(s.cancellationRate).toBeCloseTo(1 / 3, 6)
  })

  it('räknar uteblivna och deras FÖRLORADE intäkt — som aldrig blir omsättning', () => {
    const s = aggregateStats(
      input({
        rows: [
          booking({ priceCents: 60_000 }),
          booking({ status: 'no_show', priceCents: 45_000 }),
          booking({ status: 'no_show', priceCents: 30_000 }),
        ],
      }),
    )
    expect(s.noShows).toBe(2)
    expect(s.noShowBookedValueCents).toBe(75_000)
    // Uteblivna får ALDRIG smyga in i pengarna eller besöken.
    expect(s.bookedValueCents).toBe(60_000)
    expect(s.realizedValueCents).toBe(0)
    expect(s.bookings).toBe(1)
    expect(s.avgBookingValueCents).toBe(60_000)
  })

  it('uteblivna är varken bokade minuter, topplista eller trendgraf', () => {
    const s = aggregateStats(
      input({
        rows: [
          booking({ status: 'completed', serviceName: 'Klippning', priceCents: 60_000 }),
          booking({
            status: 'no_show',
            serviceName: 'Färgning',
            staffName: 'Kim',
            priceCents: 99_900,
          }),
        ],
        trendRows: [booking({ status: 'no_show', priceCents: 99_900 })],
      }),
    )
    expect(s.bookedMinutes).toBe(60) // bara den aktiva timmen
    expect(s.topServices.map((t) => t.name)).toEqual(['Klippning'])
    expect(s.topStaff.map((t) => t.name)).toEqual(['Alex'])
    expect(s.byMonth.reduce((sum, m) => sum + m.bookedValueCents, 0)).toBe(0)
    expect(s.byMonth.reduce((sum, m) => sum + m.bookings, 0)).toBe(0)
    // och de bär inte veckodags-/timfördelningen heller
    expect(s.byWeekday.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('avbokningsgraden späds inte ut av uteblivna i täljaren', () => {
    const s = aggregateStats(
      input({
        rows: [booking(), booking({ status: 'cancelled' }), booking({ status: 'no_show' })],
      }),
    )
    expect(s.cancellations).toBe(1)
    expect(s.cancellationRate).toBeCloseTo(1 / 3, 6)
  })

  it('snittpris, snitt per minut/timme och snittlängd', () => {
    const s = aggregateStats(
      input({
        rows: [
          // 60 min / 600 kr
          booking({ status: 'completed', startTs: '2026-06-01T08:00:00.000Z', endTs: '2026-06-01T09:00:00.000Z', priceCents: 60_000 }),
          // 30 min / 300 kr
          booking({ status: 'completed', startTs: '2026-06-02T08:00:00.000Z', endTs: '2026-06-02T08:30:00.000Z', priceCents: 30_000 }),
        ],
      }),
    )
    expect(s.avgBookingValueCents).toBe(45_000) // 900 kr / 2
    expect(s.avgCompletedServiceValueCents).toBe(45_000)
    expect(s.avgDurationMin).toBe(45)
    expect(s.avgPerMinuteCents).toBe(1_000) // 90 000 öre / 90 min = 10 kr/min
    expect(s.avgPerHourCents).toBe(60_000) // 600 kr/timme
  })

  it('delar aldrig med noll — tom period ger nollor, inte NaN', () => {
    const s = aggregateStats(input())
    expect(s.avgBookingValueCents).toBe(0)
    expect(s.cancellationRate).toBe(0)
    expect(s.occupancyRate).toBe(0)
    expect(s.retentionRate).toBe(0)
    expect(s.deltas.bookedValue).toBeNull()
  })
})

describe('aggregateStats — beläggning', () => {
  it('bokade minuter / schemalagda minuter', () => {
    // Schema: en medarbetare, måndag 08–16 (480 min). Fönstret innehåller EN måndag.
    const shifts = [{ staffId: 's1', weekday: 1, startTime: '08:00', endTime: '16:00' }]
    const s = aggregateStats(
      input({
        shifts,
        // 2026-06-01 är en måndag: 4 h bokat av 8 h → 50 %.
        rows: [booking({ startTs: '2026-06-01T06:00:00.000Z', endTs: '2026-06-01T10:00:00.000Z' })],
      }),
    )
    expect(s.availableMinutes).toBe(480)
    expect(s.bookedMinutes).toBe(240)
    expect(s.occupancyRate).toBeCloseTo(0.5, 6)
  })

  it('utan arbetstider antas 8 h/dag och aktiv medarbetare', () => {
    // ANTAGANDE, inte data: 7 dagar × 8 h × 2 medarbetare.
    expect(availableMinutes([], 2, FROM, TO, TZ)).toBe(7 * DEFAULT_WORKDAY_MIN * 2)
  })
})

describe('aggregateStats — jämförelse mot föregående period', () => {
  it('ger delta i procent upp och ner', () => {
    const s = aggregateStats(
      input({
        rows: [booking({ priceCents: 100_000 }), booking({ priceCents: 50_000 })],
        prevRows: [booking({ priceCents: 100_000 })],
      }),
    )
    expect(s.deltas.bookedValue).toBeCloseTo(50, 6) // 1000 kr → 1500 kr
    expect(s.deltas.bookings).toBeCloseTo(100, 6) // 1 → 2
  })

  it('null när föregående period var noll — inte Infinity', () => {
    const s = aggregateStats(input({ rows: [booking()] }))
    expect(s.deltas.bookings).toBeNull()
    expect(s.deltas.avgBookingValue).toBeNull()
  })
})

describe('aggregateStats — topplistor', () => {
  it('rankar tjänst och personal på intäkt, topp 5', () => {
    const s = aggregateStats(
      input({
        rows: [
          booking({ status: 'completed', serviceName: 'A', staffName: 'Alex', priceCents: 10_000 }),
          booking({ status: 'completed', serviceName: 'B', staffName: 'Bo', priceCents: 90_000 }),
          booking({ status: 'completed', serviceName: 'B', staffName: 'Bo', priceCents: 10_000 }),
          booking({ status: 'completed', serviceName: 'C', staffName: 'Cleo', priceCents: 5_000 }),
          booking({ status: 'completed', serviceName: 'D', staffName: 'Dana', priceCents: 4_000 }),
          booking({ status: 'completed', serviceName: 'E', staffName: 'Eli', priceCents: 3_000 }),
          booking({ status: 'completed', serviceName: 'F', staffName: 'Fry', priceCents: 2_000 }),
        ],
      }),
    )
    expect(s.topServices).toHaveLength(5)
    expect(s.topServices[0]).toEqual({ name: 'B', count: 2, realizedValueCents: 100_000 })
    expect(s.topStaff[0]!.name).toBe('Bo')
    expect(s.topServices.map((e) => e.name)).not.toContain('F')
  })
})

describe('aggregateStats — kunderna', () => {
  it('ny = first_seen_at inom perioden, återkommande = resten', () => {
    const s = aggregateStats(
      input({
        rows: [
          booking({ status: 'completed', customerId: 'c1' }),
          booking({ status: 'completed', customerId: 'c2' }),
        ],
        customers: [
          { id: 'c1', firstSeenAt: '2026-06-02T10:00:00.000Z' }, // inom
          { id: 'c2', firstSeenAt: '2025-01-02T10:00:00.000Z' }, // före
        ],
      }),
    )
    expect(s.newCustomers).toBe(1)
    expect(s.returningCustomers).toBe(1)
  })

  it('retention = andel kunder med fler än 1 bokning i perioden', () => {
    const s = aggregateStats(
      input({
        rows: [
          booking({ status: 'completed', customerId: 'c1' }),
          booking({ status: 'completed', customerId: 'c1' }),
          booking({ status: 'completed', customerId: 'c2' }),
        ],
        customers: [
          { id: 'c1', firstSeenAt: '2020-01-01T00:00:00.000Z' },
          { id: 'c2', firstSeenAt: '2020-01-01T00:00:00.000Z' },
        ],
      }),
    )
    expect(s.retentionRate).toBeCloseTo(0.5, 6)
  })
})

describe('aggregateStats — tiden', () => {
  it('veckodagsserien börjar på MÅNDAG, inte söndag', () => {
    const s = aggregateStats(
      input({
        // 2026-06-01 = måndag, 2026-06-07 = söndag (svensk tid).
        rows: [
          booking({ startTs: '2026-06-01T08:00:00.000Z', endTs: '2026-06-01T09:00:00.000Z' }),
          booking({ startTs: '2026-06-07T08:00:00.000Z', endTs: '2026-06-07T09:00:00.000Z' }),
        ],
      }),
    )
    expect(s.byWeekday[0]).toBe(1) // måndag
    expect(s.byWeekday[6]).toBe(1) // söndag
    expect(s.byWeekday.reduce((a, b) => a + b, 0)).toBe(2)
  })

  it('bucketar timmar i tenantens tidszon (08:00Z = 10 i Stockholm sommartid)', () => {
    const s = aggregateStats(
      input({
        shifts: [{ staffId: 's1', weekday: 1, startTime: '09:00', endTime: '12:00' }],
        rows: [booking({ startTs: '2026-06-01T08:00:00.000Z', endTs: '2026-06-01T09:00:00.000Z' })],
      }),
    )
    expect(s.byHour.map((h) => h.hour)).toEqual([9, 10, 11])
    expect(s.byHour.find((h) => h.hour === 10)!.count).toBe(1)
    expect(s.peakHours[0]).toEqual({ hour: 10, count: 1 })
    expect(s.quietHours).toHaveLength(3)
  })

  it('12-månaderstrenden har 12 hinkar och behåller tomma månader', () => {
    const s = aggregateStats(
      input({
        trendRows: [booking({ startTs: '2026-06-01T08:00:00.000Z', priceCents: 20_000 })],
      }),
    )
    expect(s.byMonth).toHaveLength(12)
    expect(s.byMonth.at(-1)!.month).toBe('2026-06')
    expect(s.byMonth.at(-1)!.bookings).toBe(1)
    expect(s.byMonth.at(-1)!.bookedValueCents).toBe(20_000)
    expect(s.byMonth.at(-1)!.realizedValueCents).toBe(0)
    expect(s.byMonth[0]!.bookings).toBe(0)
  })
})

describe('periodväljaren', () => {
  it('accepterar bara kända perioder', () => {
    expect(isPeriod('30d')).toBe(true)
    expect(isPeriod('ar')).toBe(true)
    expect(isPeriod('evigt')).toBe(false)
    expect(isPeriod(undefined)).toBe(false)
  })

  it('föregående period är lika lång och slutar där perioden börjar', () => {
    const now = new Date('2026-07-14T12:00:00.000Z')
    const { from, to, prevFrom } = periodRange('7d', now)
    expect(to).toBe(now.toISOString())
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(7 * 86_400_000)
    expect(new Date(from).getTime() - new Date(prevFrom).getTime()).toBe(7 * 86_400_000)
  })
})
