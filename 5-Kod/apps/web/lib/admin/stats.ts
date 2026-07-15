import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Statistik-aggregeringen (goal: Statistik-ytan).
 *
 * Kontrakt: EN läsväg — getStats gör 3 breda selects och all aggregering sker i JS
 * (aggregateStats, ren funktion → testbar utan databas). Inga per-tjänst/per-personal
 * -frågor (N+1 dödar ytan när en kund har 40 tjänster).
 *
 * Läsningarna går genom den cookie-bundna klienten → RLS (tenant_id = private.tenant_id())
 * fencar dem. tenant_id skickas ändå explicit: defence-in-depth + stabil ordning, samma
 * mönster som lib/admin/data.ts.
 */

/** Bokningar som räknas som pengar/besök. `no_show` står MEDVETET utanför: en kund som
 *  aldrig kom är varken omsättning, genomförd bokning, bokad minut, topplistetjänst
 *  eller en punkt i trendgrafen. Räknades den med skulle statistiken påstå intäkter
 *  företaget aldrig fick. */
const ACTIVE: readonly string[] = ['pending', 'confirmed', 'completed']
const CANCELLED = 'cancelled'
/** Uteblivet besök — RIKTIG status i DB:n (0063). Räknas separat: antal + förlorad
 *  intäkt (priset står kvar på raden, det är hela poängen med att kunna registrera den). */
const NO_SHOW = 'no_show'

/** Antaget arbetspass när tenanten inte lagt in några arbetstider alls. */
export const DEFAULT_WORKDAY_MIN = 8 * 60

// ── in-typer (rena, DB-fria — testerna matar dem direkt) ─────────────────────

export type StatBooking = {
  startTs: string
  endTs: string
  status: string
  priceCents: number | null
  staffId: string | null
  staffName: string
  serviceName: string
  customerId: string | null
}

export type StatCustomer = { id: string; firstSeenAt: string }

/** Ett arbetspass ur working_hours: 0 = sön … 6 = lör (samma konvention som DB:n). */
export type StatShift = { staffId: string; weekday: number; startTime: string; endTime: string }

export type StatsInput = {
  /** Bokningar i den VALDA perioden. */
  rows: StatBooking[]
  /** Bokningar i FÖREGÅENDE lika långa period (jämförelsetalen). */
  prevRows: StatBooking[]
  /** Bokningar i 12-månadersfönstret fram till `to` (trendgrafen). */
  trendRows: StatBooking[]
  customers: StatCustomer[]
  shifts: StatShift[]
  /** Aktiv personal — kapacitets-fallbacken när inga arbetstider finns. */
  activeStaff: number
  from: string
  to: string
  timeZone: string
}

// ── ut-typer ─────────────────────────────────────────────────────────────────

export type TopEntry = { name: string; count: number; revenueCents: number }
export type HourEntry = { hour: number; count: number }
export type MonthEntry = { month: string; bookings: number; revenueCents: number }

/** Förändring mot föregående period i procent. null = föregående period var 0 →
 *  "∞ %" är ingen sanning, det är en division med noll. UI:t visar "–". */
export type Delta = number | null

export type Stats = {
  revenueCents: number
  bookings: number
  cancellations: number
  /** avbokade / (aktiva + avbokade), 0–1. */
  cancellationRate: number
  /** Antal bokningar med status 'no_show' i perioden. */
  noShows: number
  /** Förlorad intäkt: summa price_cents på de uteblivna. Ingår ALDRIG i revenueCents. */
  noShowLostCents: number
  /** bokade minuter / tillgängliga arbetsminuter, 0–1 (kan överstiga 1 vid dubbelbokning). */
  occupancyRate: number
  bookedMinutes: number
  availableMinutes: number
  avgOrderCents: number
  avgPerMinuteCents: number
  avgPerHourCents: number
  avgDurationMin: number
  topServices: TopEntry[]
  topStaff: TopEntry[]
  newCustomers: number
  returningCustomers: number
  /** andel kunder i perioden med fler än 1 bokning, 0–1. */
  retentionRate: number
  /** 7 tal, index 0 = måndag … 6 = söndag (läsordning, inte DB-ordning). */
  byWeekday: number[]
  byHour: HourEntry[]
  peakHours: HourEntry[]
  quietHours: HourEntry[]
  byMonth: MonthEntry[]
  deltas: {
    revenue: Delta
    bookings: Delta
    occupancy: Delta
    avgOrder: Delta
    cancellationRate: Delta
  }
}

// ── perioder ─────────────────────────────────────────────────────────────────

export const PERIODS = ['7d', '30d', '90d', 'ar'] as const
export type Period = (typeof PERIODS)[number]

export function isPeriod(v: string | undefined | null): v is Period {
  return typeof v === 'string' && (PERIODS as readonly string[]).includes(v)
}

const PERIOD_DAYS: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, ar: 365 }

export const PERIOD_LABEL: Record<Period, string> = {
  '7d': '7 dagar',
  '30d': '30 dagar',
  '90d': '90 dagar',
  ar: '12 månader',
}

const DAY_MS = 86_400_000

/** [from, to) för perioden + [prevFrom, from) för jämförelsen. `to` = nu. */
export function periodRange(
  period: Period,
  now = new Date(),
): { from: string; to: string; prevFrom: string } {
  const to = now.getTime()
  const span = PERIOD_DAYS[period] * DAY_MS
  return {
    from: new Date(to - span).toISOString(),
    to: new Date(to).toISOString(),
    prevFrom: new Date(to - span * 2).toISOString(),
  }
}

// ── tidszons-hjälpare (rena) ─────────────────────────────────────────────────

function partsInTz(iso: string, timeZone: string): { weekday: number; hour: number; month: string } {
  const d = new Date(iso)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(d),
  )
  // en-CA ger YYYY-MM-DD i tenantens tidszon → månadsnyckel + veckodag utan UTC-drift.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(d)
  const weekday = new Date(`${ymd}T12:00:00Z`).getUTCDay() // 0 = sön
  return {
    weekday,
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 0,
    month: ymd.slice(0, 7),
  }
}

/** 'HH:MM(:SS)' → minuter sedan midnatt. */
function minutesOfClock(t: string): number {
  const [h, m] = t.split(':')
  return Number(h) * 60 + Number(m)
}

function pct(cur: number, prev: number): Delta {
  if (prev === 0) return null
  return ((cur - prev) / prev) * 100
}

// ── aggregeringen (ren — testad i stats.test.ts) ─────────────────────────────

function durationMin(b: StatBooking): number {
  const ms = new Date(b.endTs).getTime() - new Date(b.startTs).getTime()
  return ms > 0 ? Math.round(ms / 60_000) : 0
}

function sums(rows: StatBooking[]): {
  active: StatBooking[]
  revenueCents: number
  bookedMinutes: number
  cancellations: number
  noShows: number
  noShowLostCents: number
} {
  const active = rows.filter((b) => ACTIVE.includes(b.status))
  const noShow = rows.filter((b) => b.status === NO_SHOW)
  return {
    active,
    // Uteblivna ligger utanför `active` → varken omsättning eller bokade minuter.
    revenueCents: active.reduce((s, b) => s + (b.priceCents ?? 0), 0),
    bookedMinutes: active.reduce((s, b) => s + durationMin(b), 0),
    cancellations: rows.filter((b) => b.status === CANCELLED).length,
    noShows: noShow.length,
    noShowLostCents: noShow.reduce((s, b) => s + (b.priceCents ?? 0), 0),
  }
}

/** Tillgängliga arbetsminuter i [from, to) enligt schemat. Finns inga arbetstider
 *  antas 8 h/dag och aktiv medarbetare (DEFAULT_WORKDAY_MIN) — ANTAGANDE, inte data. */
export function availableMinutes(
  shifts: StatShift[],
  activeStaff: number,
  from: string,
  to: string,
  timeZone: string,
): number {
  // Minuter per veckodag enligt schemat (summa över all personal).
  const perWeekday = new Array<number>(7).fill(0)
  for (const s of shifts) {
    if (s.weekday < 0 || s.weekday > 6) continue
    const mins = minutesOfClock(s.endTime) - minutesOfClock(s.startTime)
    if (mins > 0) perWeekday[s.weekday]! += mins
  }
  const hasSchedule = perWeekday.some((m) => m > 0)

  // Räkna kalenderdagar per veckodag i fönstret (tenantens tidszon).
  const start = new Date(from).getTime()
  const end = new Date(to).getTime()
  let total = 0
  for (let t = start; t < end; t += DAY_MS) {
    const { weekday } = partsInTz(new Date(t).toISOString(), timeZone)
    total += hasSchedule ? perWeekday[weekday]! : DEFAULT_WORKDAY_MIN * activeStaff
  }
  return total
}

function tops(rows: StatBooking[], keyOf: (b: StatBooking) => string): TopEntry[] {
  const map = new Map<string, TopEntry>()
  for (const b of rows) {
    const name = keyOf(b)
    const e = map.get(name) ?? { name, count: 0, revenueCents: 0 }
    e.count += 1
    e.revenueCents += b.priceCents ?? 0
    map.set(name, e)
  }
  return [...map.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents || b.count - a.count)
    .slice(0, 5)
}

export function aggregateStats(input: StatsInput): Stats {
  const { rows, prevRows, trendRows, customers, shifts, activeStaff, from, to, timeZone } = input

  const cur = sums(rows)
  const prev = sums(prevRows)

  const bookings = cur.active.length
  // Nämnaren = ALLA avgjorda bokningar, alltså även de uteblivna. En utebliven tid var
  // en verklig bokning; låg den utanför nämnaren skulle avbokningsgraden räknas på ett
  // för litet underlag och se värre ut än den är. Täljaren är fortfarande bara avbokat —
  // uteblivet har sitt eget tal (noShows + noShowLostCents).
  const totalDecided = bookings + cur.cancellations + cur.noShows
  const cancellationRate = totalDecided > 0 ? cur.cancellations / totalDecided : 0
  const prevDecided = prev.active.length + prev.cancellations + prev.noShows
  const prevCancellationRate = prevDecided > 0 ? prev.cancellations / prevDecided : 0

  const avail = availableMinutes(shifts, activeStaff, from, to, timeZone)
  const prevSpan = new Date(to).getTime() - new Date(from).getTime()
  const prevFrom = new Date(new Date(from).getTime() - prevSpan).toISOString()
  const prevAvail = availableMinutes(shifts, activeStaff, prevFrom, from, timeZone)

  const occupancyRate = avail > 0 ? cur.bookedMinutes / avail : 0
  const prevOccupancy = prevAvail > 0 ? prev.bookedMinutes / prevAvail : 0

  const avgOrderCents = bookings > 0 ? Math.round(cur.revenueCents / bookings) : 0
  const prevAvgOrder = prev.active.length > 0 ? Math.round(prev.revenueCents / prev.active.length) : 0
  const avgDurationMin = bookings > 0 ? Math.round(cur.bookedMinutes / bookings) : 0
  const avgPerMinuteCents =
    cur.bookedMinutes > 0 ? Math.round(cur.revenueCents / cur.bookedMinutes) : 0
  const avgPerHourCents = avgPerMinuteCents * 60

  // Kunderna: en kund vars first_seen_at ligger i perioden är NY, annars återkommande.
  const firstSeen = new Map(customers.map((c) => [c.id, c.firstSeenAt]))
  const perCustomer = new Map<string, number>()
  for (const b of cur.active) {
    if (!b.customerId) continue
    perCustomer.set(b.customerId, (perCustomer.get(b.customerId) ?? 0) + 1)
  }
  let newCustomers = 0
  let repeat = 0
  for (const [id, count] of perCustomer) {
    const seen = firstSeen.get(id)
    if (seen && seen >= from && seen < to) newCustomers += 1
    if (count > 1) repeat += 1
  }
  const uniqueCustomers = perCustomer.size
  const returningCustomers = uniqueCustomers - newCustomers
  const retentionRate = uniqueCustomers > 0 ? repeat / uniqueCustomers : 0

  // Veckodag: DB:n är 0=sön, läsordningen är mån→sön. Vi vänder EN gång, här.
  const byWeekday = new Array<number>(7).fill(0)
  const hourCounts = new Map<number, number>()
  for (const b of cur.active) {
    const { weekday, hour } = partsInTz(b.startTs, timeZone)
    byWeekday[(weekday + 6) % 7]! += 1
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }

  // Timspannet = öppettiderna om de finns, annars de timmar det faktiskt bokas i.
  let openFrom = 24
  let openTo = 0
  for (const s of shifts) {
    openFrom = Math.min(openFrom, Math.floor(minutesOfClock(s.startTime) / 60))
    openTo = Math.max(openTo, Math.ceil(minutesOfClock(s.endTime) / 60))
  }
  if (openFrom >= openTo) {
    const hours = [...hourCounts.keys()]
    openFrom = hours.length > 0 ? Math.min(...hours) : 8
    openTo = hours.length > 0 ? Math.max(...hours) + 1 : 18
  }
  const byHour: HourEntry[] = []
  for (let h = openFrom; h < openTo; h++) byHour.push({ hour: h, count: hourCounts.get(h) ?? 0 })

  const ranked = [...byHour].sort((a, b) => b.count - a.count || a.hour - b.hour)
  const peakHours = ranked.filter((h) => h.count > 0).slice(0, 3)
  const quietHours = [...ranked].reverse().slice(0, 3)

  // 12-månaderstrend: nycklar i tenantens tidszon, tomma månader ska finnas kvar
  // (ett hål i grafen är information — vi hoppar inte över dem).
  const monthMap = new Map<string, MonthEntry>()
  const end = new Date(to)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - i, 1, 12))
    const key = d.toISOString().slice(0, 7)
    monthMap.set(key, { month: key, bookings: 0, revenueCents: 0 })
  }
  for (const b of trendRows) {
    if (!ACTIVE.includes(b.status)) continue
    const { month } = partsInTz(b.startTs, timeZone)
    const e = monthMap.get(month)
    if (!e) continue
    e.bookings += 1
    e.revenueCents += b.priceCents ?? 0
  }

  return {
    revenueCents: cur.revenueCents,
    bookings,
    cancellations: cur.cancellations,
    cancellationRate,
    noShows: cur.noShows,
    noShowLostCents: cur.noShowLostCents,
    occupancyRate,
    bookedMinutes: cur.bookedMinutes,
    availableMinutes: avail,
    avgOrderCents,
    avgPerMinuteCents,
    avgPerHourCents,
    avgDurationMin,
    topServices: tops(cur.active, (b) => b.serviceName),
    topStaff: tops(cur.active, (b) => b.staffName),
    newCustomers,
    returningCustomers,
    retentionRate,
    byWeekday,
    byHour,
    peakHours,
    quietHours,
    byMonth: [...monthMap.values()],
    deltas: {
      revenue: pct(cur.revenueCents, prev.revenueCents),
      bookings: pct(bookings, prev.active.length),
      occupancy: pct(occupancyRate, prevOccupancy),
      avgOrder: pct(avgOrderCents, prevAvgOrder),
      cancellationRate: pct(cancellationRate, prevCancellationRate),
    },
  }
}

// ── läsvägen (3 selects) ─────────────────────────────────────────────────────

type RawBooking = {
  start_ts: string
  end_ts: string
  status: string
  price_cents: number | null
  staff_id: string | null
  customer_id: string | null
  services: { name: string } | null
  staff: { title: string | null } | null
}

function mapRow(b: RawBooking): StatBooking {
  return {
    startTs: b.start_ts,
    endTs: b.end_ts,
    status: b.status,
    priceCents: b.price_cents,
    staffId: b.staff_id,
    // Samma fallback som listStaff.displayName / listBookings.staffTitle.
    staffName: b.staff?.title?.trim() || 'Medarbetare',
    serviceName: b.services?.name?.trim() || 'Okänd tjänst',
    customerId: b.customer_id,
  }
}

/**
 * All statistik för en tenant i [from, to). Tre läsningar:
 *  1. bookings — ETT brett fönster (max(föregående period, 12 mån bakåt) → to), som
 *     sedan skivas i JS till period / föregående period / trend. Två extra frågor för
 *     samma rader vore två extra rundturer utan ny information.
 *  2. working_hours + staff-räknaren — kapaciteten (beläggningsgraden).
 *  3. customers — first_seen_at (ny vs återkommande).
 */
export async function getStats(
  tenantId: string,
  from: string,
  to: string,
  timeZone = 'Europe/Stockholm',
): Promise<Stats> {
  const supabase = await createClient()

  const span = new Date(to).getTime() - new Date(from).getTime()
  const prevFrom = new Date(new Date(from).getTime() - span).toISOString()
  const trendFrom = new Date(
    Date.UTC(new Date(to).getUTCFullYear() - 1, new Date(to).getUTCMonth(), 1),
  ).toISOString()
  const windowFrom = prevFrom < trendFrom ? prevFrom : trendFrom

  const [bookingRes, shiftRes, staffRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('start_ts, end_ts, status, price_cents, staff_id, customer_id, services(name), staff(title)')
      .eq('tenant_id', tenantId)
      .gte('start_ts', windowFrom)
      .lt('start_ts', to),
    supabase
      .from('working_hours')
      .select('staff_id, weekday, start_time, end_time')
      .eq('tenant_id', tenantId),
    supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('active', true),
  ])

  // Kasta, svälj inte (B-10): en tyst tom statistiksida ser ut som "noll omsättning" —
  // en farligare lögn än en felsida.
  if (bookingRes.error) throw new Error(`getStats: ${bookingRes.error.message}`)

  const all = ((bookingRes.data ?? []) as unknown as RawBooking[]).map(mapRow)
  const rows = all.filter((b) => b.startTs >= from && b.startTs < to)
  const prevRows = all.filter((b) => b.startTs >= prevFrom && b.startTs < from)
  const trendRows = all.filter((b) => b.startTs >= trendFrom)

  const shifts: StatShift[] = (
    (shiftRes.data ?? []) as { staff_id: string; weekday: number; start_time: string; end_time: string }[]
  ).map((s) => ({
    staffId: s.staff_id,
    weekday: s.weekday,
    startTime: s.start_time,
    endTime: s.end_time,
  }))

  // Prestanda C5: hämta first_seen_at BARA för kunderna som faktiskt bokat i perioden.
  // aggregateStats slår bara upp firstSeen för periodens (cur.active) kunder — förr
  // lästes HELA kundtabellen, som PostgREST kapar vid 1000+ rader → newCustomers blev
  // TYST fel (och hela tabellen drogs in i isolatet). En scoped .in()-läsning ger
  // IDENTISKA siffror utan taket; aggregateStats-matematiken är helt oförändrad.
  const periodCustomerIds = [
    ...new Set(rows.map((b) => b.customerId).filter((v): v is string => !!v)),
  ]
  // Chunka i block om 1000: både `.in(...)` (URL-längd) och PostgREST-svaret kan kapas,
  // och en period med 1000+ unika boknings-kunder ska inte tyst tappa firstSeen för
  // svansen → newCustomers-undercount (samma bugg som fixen stänger). Fel kastas, sväljs
  // inte: ett tomt firstSeen ser ut som "alla återkommande", en tyst lögn i statistiken.
  const CHUNK = 1000
  const customers: StatCustomer[] = []
  for (let i = 0; i < periodCustomerIds.length; i += CHUNK) {
    const idChunk = periodCustomerIds.slice(i, i + CHUNK)
    const { data: custData, error: custErr } = await supabase
      .from('customers')
      .select('id, first_seen_at')
      .eq('tenant_id', tenantId) // defense-in-depth (RLS fenceear redan per tenant)
      .in('id', idChunk)
    if (custErr) throw new Error(`getStats customers: ${custErr.message}`)
    for (const c of (custData ?? []) as { id: string; first_seen_at: string }[]) {
      customers.push({ id: c.id, firstSeenAt: c.first_seen_at })
    }
  }

  return aggregateStats({
    rows,
    prevRows,
    trendRows,
    customers,
    shifts,
    activeStaff: staffRes.count ?? 0,
    from,
    to,
    timeZone,
  })
}
