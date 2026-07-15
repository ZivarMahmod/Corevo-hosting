import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm } from '@/lib/platform/verticals-shared'
import {
  listBookings,
  listBookingPayments,
  listLocations,
  listServices,
  staffDay,
  type AdminBooking,
  type BookingPayment,
} from '@/lib/admin/data'
import {
  dayRangeUtc,
  isValidDate,
  monthGridRangeUtc,
  todayInTz,
  weekRangeUtc,
} from '@/lib/admin/dates'
import { listTimeOffOverlapping } from '@/lib/admin/schedule-data'
import { resolvePlats } from '@/lib/admin/plats'
import { PageHead } from '@/components/portal/ui'
import {
  CalendarBoard,
  type CalendarBlock,
  type CalendarView,
} from '@/components/admin/CalendarBoard'
import type { BookingRow } from '@/components/admin/BookingDrawer'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kalender · Adminpanel' }

const VIEWS: CalendarView[] = ['dag', 'vecka', 'manad']

/** Kalendern — kund-adminens arbetsbord (goal-66). ETT ställe för bokningsarbetet:
 *  dag, vecka och månad är vyer av samma data, inte tre sidor. Ersätter den gamla
 *  lista+veckoraster-sidan OCH helskärmskiosken (/vy) — de var två system över samma
 *  bokningar.
 *
 *  Vy och datum kommer ur URL:en, så en länk öppnar exakt det arbetsbord man delade
 *  (Översiktens "Öppna kalendern" och dess bokningsrader länkar hit). */
export default async function KalenderPage({
  searchParams,
}: {
  searchParams: Promise<{ vy?: string; datum?: string; plats?: string; open?: string }>
}) {
  const sp = await searchParams
  const user = await requireAdminArea('bokningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Kalender" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const tz = tenant.timeZone
  const today = todayInTz(tz)
  const view: CalendarView = VIEWS.includes(sp.vy as CalendarView) ? (sp.vy as CalendarView) : 'dag'
  const date = isValidDate(sp.datum) ? sp.datum : today

  // Plats-filtret finns bara som yta när tenanten har >1 AKTIV plats. Ett påhittat
  // ?plats= kan aldrig peka utanför RLS-fencet — det blir bara "alla platser".
  const locations = (await listLocations(tenant.id)).filter((l) => l.active)
  const locationFilter =
    locations.length > 1 ? await resolvePlats(sp.plats, locations.map((l) => l.id)) : ''

  // Fönstret följer vyn. Månadsvyn hämtar HELA rutnätet (inkl. randdagarna från
  // grannmånaderna) — annars ser rutnätets kanter tomma ut fast de har bokningar.
  const range =
    view === 'manad'
      ? monthGridRangeUtc(date, tz)
      : view === 'vecka'
        ? weekRangeUtc(date, tz)
        : dayRangeUtc(date, tz)

  // Veckodagen i salongens tidszon (0=sön…6=lör, samma konvention som
  // working_hours.weekday) — inte serverns lokala dag.
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()

  // Frånvaro = kalenderns blockeringar. EN modell för "resursen kan inte bokas" —
  // rast, frånvaro och avvikande arbetstid är samma sak (Wavys universalmekanism).
  // Intervall-överlapp, så en semester som började i förra fönstret syns ändå.
  const [bookings, roster, timeOff, allServices] = await Promise.all([
    listBookings(tenant.id, {
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      locationId: locationFilter || undefined,
    }),
    staffDay(tenant.id, weekday),
    // Blockeringar ritas bara i dag- och veckovyn. Månadsvyn visar antal per dag, så
    // en 42-dagars frånvarofråga där vore ren spilld last.
    view === 'manad'
      ? Promise.resolve([])
      : listTimeOffOverlapping(tenant.id, range.fromUtc, range.toUtc),
    listServices(tenant.id),
  ])

  const blocks: CalendarBlock[] = timeOff.map((t) => ({
    id: t.id,
    staffId: t.staff_id,
    startTs: t.start_ts,
    endTs: t.end_ts,
    reason: t.reason?.trim() || 'Blockerad',
    seriesId: t.series_id,
  }))

  // Betalstatus i EN batchad läsning över fönstrets bokningar (inte en per rad).
  //
  // Hoppas HELT i månadsvyn: den visar antal per dag, aldrig en enskild boknings
  // betalstatus — och fönstret är 42 dagar. Att slå upp betalningar för hela månaden
  // för att sedan inte visa dem är den dyraste sortens död kod: den syns inte, men
  // databasen betalar för den vid varje månadsbläddring.
  const payments =
    view === 'manad'
      ? new Map<string, BookingPayment>()
      : await listBookingPayments(
          tenant.id,
          bookings.map((b) => b.id),
        )

  const now = Date.now()
  const NO_PAYMENT: BookingPayment = { status: null, amountCents: null }
  const rows: BookingRow[] = bookings.map((b: AdminBooking) => {
    const pay = payments.get(b.id) ?? NO_PAYMENT
    return {
      id: b.id,
      startTs: b.startTs,
      endTs: b.endTs,
      serviceName: b.serviceName,
      staffTitle: b.staffTitle,
      staffId: b.staffId,
      priceCents: b.priceCents,
      status: b.status,
      createdAt: b.createdAt,
      note: b.note,
      customerId: b.customerId,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      locationName: b.locationName,
      isPast: new Date(b.startTs).getTime() < now,
      paymentStatus: pay.status,
      paymentAmountCents: pay.amountCents,
    }
  })

  return (
    <CalendarBoard
      bookings={rows}
      blocks={blocks}
      staff={roster.map((s) => ({
        id: s.staffId,
        name: s.name,
        start: s.start,
        end: s.end,
        color: s.color,
        // Serverberäknade arbetsminuter (sammanslagna pass) — nämnaren i kalenderns
        // beläggningssiffra. Klienten räknar statistiken så den följer resursfiltret.
        workedMinutes: s.workedMinutes,
      }))}
      // Bara aktiva tjänster kan bokas — en inaktiv tjänst ska inte gå att välja i
      // drawern och sedan avvisas av servern.
      services={allServices
        .filter((s) => s.active)
        .map((s) => ({
          id: s.id,
          name: s.name,
          durationMin: s.duration_min ?? 30,
          priceCents: s.price_cents ?? null,
        }))}
      tz={tz}
      view={view}
      date={date}
      today={today}
      locationId={locationFilter || undefined}
      staffNoun={resolveTerm(tenant.terminology, 'staff', 'Personal')}
      openBookingId={sp.open}
    />
  )
}
