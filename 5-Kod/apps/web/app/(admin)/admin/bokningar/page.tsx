import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import {
  listBookings,
  listStaff,
  listWorkingHours,
  listWorkingHourSlots,
  getBookingPaymentStatus,
} from '@/lib/admin/data'
import { dayRangeUtc, todayInTz } from '@/lib/admin/dates'
import { PageHead, Button } from '@/components/portal/ui'
import { BookingsClient, type BookingRow, type WeekTemplate } from '@/components/admin/BookingsClient'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokningar · Salongsadmin' }

export default async function BookingsPage() {
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

  // Load "today onward" (open-ended) so the Vecka grid + live status-pills show
  // the real, current set. The mock RE-EXPRESSES the old server date-range/staff
  // <form> as the week-grid + status-pills + search the client already owns, so
  // there are no server filter params here anymore.
  const staff = await listStaff(tenant.id)
  const bookings = await listBookings(tenant.id, {
    fromUtc: dayRangeUtc(today, tz).fromUtc,
  })

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
  const [slotRowsByStaff, whRowsByStaff] = await Promise.all([
    Promise.all(staff.map((s) => listWorkingHourSlots(tenant.id, s.id))),
    Promise.all(staff.map((s) => listWorkingHours(tenant.id, s.id))),
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

  // Enrich each booking with its REAL payment row (or the honest no-payment null).
  // payments are Stripe-minted only — getBookingPaymentStatus returns null when no
  // row exists, so the drawer never shows a phantom "Betald".
  const payments = await Promise.all(
    bookings.map((b) => getBookingPaymentStatus(b.id, tenant.id)),
  )

  const now = Date.now()
  const rows: BookingRow[] = bookings.map((b, i) => ({
    id: b.id,
    startTs: b.startTs,
    endTs: b.endTs,
    serviceName: b.serviceName,
    staffTitle: b.staffTitle,
    priceCents: b.priceCents,
    status: b.status,
    createdAt: b.createdAt,
    note: b.note,
    // Derived (pure): the slot's start instant is already in the past.
    isPast: new Date(b.startTs).getTime() < now,
    paymentStatus: payments[i]!.status,
    paymentAmountCents: payments[i]!.amountCents,
  }))

  // PageHead ghost date button label: today in the salon tz ("tis 2 juni"-style).
  const todayLabel = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title="Bokningar"
        lede="En kontrollyta — välj den vy du jobbar bäst i. Ditt val sparas automatiskt."
      >
        <Button variant="ghost" icon="calendar" size="sm">
          {todayLabel}
        </Button>
        <Button href="/admin/bokningar" variant="primary" icon="plus">
          Ny bokning
        </Button>
      </PageHead>

      <BookingsClient bookings={rows} tz={tz} weekTemplate={weekTemplate} />
    </section>
  )
}
