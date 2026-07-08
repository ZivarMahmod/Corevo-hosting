import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant, storefrontUrl } from '@/lib/admin/tenant'
import { resolveTerm } from '@/lib/platform/verticals-shared'
import {
  listBookings,
  listBookingPayments,
  listLocations,
  listStaff,
  listWorkingHours,
  listWorkingHourSlots,
  type AdminBooking,
  type BookingPayment,
} from '@/lib/admin/data'
import { dayRangeUtc, isValidDate, todayInTz, weekRangeUtc } from '@/lib/admin/dates'
import { PageHead, Button, Icon } from '@/components/portal/ui'
import { BookingsClient, type BookingRow, type WeekTemplate } from '@/components/admin/BookingsClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokningar · Salongsadmin' }

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; personal?: string; plats?: string }>
}) {
  const sp = await searchParams
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Bokningar" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const tz = tenant.timeZone
  const today = todayInTz(tz)

  const [staff, allLocations] = await Promise.all([
    listStaff(tenant.id),
    listLocations(tenant.id),
  ])

  // ── URL-styrda serverfilter (validerade mot tenantens egna rader — ett påhittat
  //    ?personal=/?plats= kan aldrig peka utanför RLS-fencet, det blir bara Alla). ──
  // ?week= ankrar Vecka-vyn; vilken dag som helst i veckan duger (weekRangeUtc
  // snappar själv till måndag) så bakåt-/framåt-länkar är rena ±7-dagar.
  const weekAnchor = isValidDate(sp.week) ? sp.week : today
  const staffFilter = staff.some((s) => s.id === sp.personal) ? sp.personal! : ''
  // Plats-filtret finns bara som yta när tenanten har >1 AKTIV plats (FreshCut har
  // 1 → helt osynligt). Inaktiva platser erbjuds inte som val.
  const locations = allLocations.filter((l) => l.active)
  const showLocation = locations.length > 1
  const locationFilter =
    showLocation && locations.some((l) => l.id === sp.plats) ? sp.plats! : ''

  const serverFilters = {
    staffId: staffFilter || undefined,
    locationId: locationFilter || undefined,
  }

  // Två separata fönster (vyerna har olika tidskontrakt):
  //  • Lista = kommande från idag (open-ended) — operativ kö.
  //  • Vecka = HELA den valda veckan, även bakåt i tiden → historik-bläddring.
  const week = weekRangeUtc(weekAnchor, tz)
  const [listaBookings, veckaBookings] = await Promise.all([
    listBookings(tenant.id, { fromUtc: dayRangeUtc(today, tz).fromUtc, ...serverFilters }),
    listBookings(tenant.id, { fromUtc: week.fromUtc, toUtc: week.toUtc, ...serverFilters }),
  ])

  // Week raster (mock SLOT_TEMPLATE + WEEK_DAYS.closed): two independent axes per
  // weekday (0=Sun…6=Sat), so the Vecka grid fills with the real raster even at
  // zero bookings — the empty scaffold IS the empty-state (what the salon sees
  // live now). Aggregated across all staff:
  //   • OPEN/CLOSED comes from working_hours presence (no row for a weekday →
  //     genuinely Stängt). Never inferred from missing slot rows.
  //   • The slot start-times come from explicit working_hour_slots when seeded;
  //     otherwise they are DERIVED from the working-hours window (start→end at a
  //     fixed display step), mirroring the booking engine's two-mode raster
  //     (lib/booking/availability: explicit slots, else a stepped window).
  // Vid personal-filter byggs rastret av BARA den medarbetarens schema, så
  // "Ledig"-cellerna i Vecka-vyn matchar filtret.
  const rasterStaff = staffFilter ? staff.filter((s) => s.id === staffFilter) : staff
  const [slotRowsByStaff, whRowsByStaff] = await Promise.all([
    Promise.all(rasterStaff.map((s) => listWorkingHourSlots(tenant.id, s.id))),
    Promise.all(rasterStaff.map((s) => listWorkingHours(tenant.id, s.id))),
  ])
  const slotRows = slotRowsByStaff.flat()
  const whRows = whRowsByStaff.flat()

  // Display granularity for the DERIVED raster (no effect when explicit slots
  // exist). 30 min keeps the week-overview column readable; the per-service
  // booking engine still computes its own finer availability elsewhere.
  const RASTER_STEP_MIN = 30
  const hhmm = (t: string) => t.slice(0, 5)
  const toMin = (t: string) => {
    const [h, m] = hhmm(t).split(':').map(Number)
    return h! * 60 + m!
  }
  const fromMin = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

  // Explicit slot start-times per weekday (distinct, across staff).
  const explicitByWeekday: Record<number, Set<string>> = {}
  for (const r of slotRows) {
    ;(explicitByWeekday[r.weekday] ??= new Set<string>()).add(hhmm(r.start_time))
  }
  // Open window per weekday = the union [earliest start, latest end) across staff.
  const openByWeekday: Record<number, { start: number; end: number }> = {}
  for (const r of whRows) {
    const s = toMin(r.start_time)
    const e = toMin(r.end_time)
    const cur = openByWeekday[r.weekday]
    openByWeekday[r.weekday] = cur
      ? { start: Math.min(cur.start, s), end: Math.max(cur.end, e) }
      : { start: s, end: e }
  }

  const weekTemplate: WeekTemplate = {}
  for (let wd = 0; wd <= 6; wd++) {
    const explicit = explicitByWeekday[wd]
    if (explicit && explicit.size > 0) {
      weekTemplate[wd] = { closed: false, slots: [...explicit].sort() }
      continue
    }
    const open = openByWeekday[wd]
    if (!open) {
      weekTemplate[wd] = { closed: true, slots: [] } // genuinely closed (no hours)
      continue
    }
    const slots: string[] = []
    for (let t = open.start; t < open.end; t += RASTER_STEP_MIN) slots.push(fromMin(t))
    weekTemplate[wd] = { closed: false, slots }
  }

  // Enrich with the REAL payment rows (or the honest no-payment null) — ONE batched
  // read over the union of both windows (dedupad) i stället för en per bokning.
  const allIds = [...new Set([...listaBookings, ...veckaBookings].map((b) => b.id))]
  const payments = await listBookingPayments(tenant.id, allIds)

  const now = Date.now()
  const NO_PAYMENT: BookingPayment = { status: null, amountCents: null }
  const toRow = (b: AdminBooking): BookingRow => {
    const pay = payments.get(b.id) ?? NO_PAYMENT
    return {
      id: b.id,
      startTs: b.startTs,
      endTs: b.endTs,
      serviceName: b.serviceName,
      staffTitle: b.staffTitle,
      priceCents: b.priceCents,
      status: b.status,
      createdAt: b.createdAt,
      note: b.note,
      customerId: b.customerId,
      customerName: b.customerName,
      locationName: b.locationName,
      // Derived (pure): the slot's start instant is already in the past.
      isPast: new Date(b.startTs).getTime() < now,
      paymentStatus: pay.status,
      paymentAmountCents: pay.amountCents,
    }
  }
  const listaRows = listaBookings.map(toRow)
  const veckaRows = veckaBookings.map(toRow)

  // PageHead ghost date button: today in the salon tz ("tis 2 juni"-style) — en
  // RIKTIG länk tillbaka till innevarande vecka (behåller aktiva filter).
  const todayLabel = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
  const todayParams = new URLSearchParams()
  todayParams.set('week', today)
  if (staffFilter) todayParams.set('personal', staffFilter)
  if (locationFilter) todayParams.set('plats', locationFilter)

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title="Bokningar"
        lede="En kontrollyta — välj den vy du jobbar bäst i. Ditt val sparas automatiskt."
      >
        <Button href={`/admin/bokningar?${todayParams.toString()}`} variant="ghost" icon="calendar" size="sm">
          {todayLabel}
        </Button>
        {/* Admin kan inte skapa bokningar härifrån ännu — ärlig UI: länka till
            tenantens PUBLIKA bokningsflöde (ny flik) i stället för en död knapp. */}
        <a
          href={storefrontUrl(tenant.slug)}
          target="_blank"
          rel="noreferrer"
          className="pbtn pbtn--primary pbtn--md"
        >
          <Icon name="external" size={17} />
          Boka åt kund på din sida
        </a>
      </PageHead>

      <BookingsClient
        bookings={listaRows}
        weekBookings={veckaRows}
        weekAnchor={weekAnchor}
        tz={tz}
        weekTemplate={weekTemplate}
        staffNoun={resolveTerm(tenant.terminology, 'staff', 'Frisör')}
        staffOptions={staff.map((s) => ({ id: s.id, name: s.displayName }))}
        staffFilter={staffFilter}
        locationOptions={locations.map((l) => ({ id: l.id, name: l.name }))}
        locationFilter={locationFilter}
        showLocation={showLocation}
      />
    </section>
  )
}
