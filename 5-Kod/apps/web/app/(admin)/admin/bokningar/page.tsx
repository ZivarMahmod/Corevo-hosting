import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { DEFAULT_MEMBER_PERMISSIONS, getMemberPermissions } from '@/lib/admin/member-permissions'
import { resolveTerm } from '@/lib/platform/verticals-shared'
import {
  countBookings,
  listBookings,
  listBookingPayments,
  listLocations,
  listServices,
  listStaffBookingResources,
  staffDays,
  type AdminBooking,
  type BookingPayment,
} from '@/lib/admin/data'
import {
  calendarDayTriplet,
  dayKey,
  dayRangeUtc,
  isValidDate,
  monthGridRangeUtc,
  todayInTz,
  weekRangeUtc,
} from '@/lib/admin/dates'
import { listTimeOffOverlapping } from '@/lib/admin/schedule-data'
import { resolvePlats } from '@/lib/admin/plats'
import { requiredLocationId } from '@/lib/admin/location-scope'
import { getAdminLocationPreferences } from '@/lib/admin/location-context'
import { Icon, PageHead } from '@/components/portal/ui'
import { CalendarBoardLazy } from '@/components/admin/CalendarBoardLazy'
import type {
  CalendarBlock,
  CalendarDayData,
  CalendarDayNeighbors,
  CalendarStaff,
  CalendarView,
} from '@/components/admin/CalendarBoard'
import type { BookingRow } from '@/components/admin/BookingDrawer'
import calendarStyles from '@/components/admin/calendar.module.css'

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
  // Personalens tillägg (tenant_member_permissions, goal-71) styr kalenderns
  // handlingsrätt + synfält. Ägare (6+) behöver ingen rad — full rätt.
  const memberPermissions =
    user.roleLevel === 3 && user.tenantId && user.staffId
      ? await getMemberPermissions({ tenantId: user.tenantId, staffId: user.staffId }).catch(
          () => DEFAULT_MEMBER_PERMISSIONS,
        )
      : null
  // PLATSCHEF (operational_role='manager') får skapa/flytta/blockera — servern
  // stödjer det redan (require_location_admin, migr 0081); UI:t ska inte låsa ute.
  const canManageBookings = user.roleLevel >= 6 || memberPermissions?.operationalRole === 'manager'
  // "Ser alla kalendrar — annars bara sin egen" (MemberPermissions-löftet): utan
  // flaggan filtreras vyn till egna kolumnen. Manager ser alltid alla.
  const ownCalendarOnly =
    memberPermissions !== null &&
    memberPermissions.operationalRole !== 'manager' &&
    !memberPermissions.canViewAllCalendars &&
    user.staffId !== null
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Kalender" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const locations = (await listLocations(tenant.id)).filter((l) => l.active)
  const allowedLocationIds = locations.map((location) => location.id)
  const [requestedLocation, preferences] = await Promise.all([
    resolvePlats(sp.plats, allowedLocationIds),
    getAdminLocationPreferences(user.id),
  ])
  const locationId = requiredLocationId(
    requestedLocation,
    allowedLocationIds,
    preferences.primaryLocationId,
  )
  const location = locations.find((candidate) => candidate.id === locationId)
  if (!locationId || !location) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Kalender" />
        <p className="prose">Välj en tillåten primär plats innan kalendern kan öppnas.</p>
      </section>
    )
  }

  const tz = location.timezone || tenant.timeZone
  const today = todayInTz(tz)
  const view: CalendarView = VIEWS.includes(sp.vy as CalendarView) ? (sp.vy as CalendarView) : 'dag'
  const date = isValidDate(sp.datum) ? sp.datum : today
  const dayDates = calendarDayTriplet(date)
  const dayRanges = dayDates.map((day) => dayRangeUtc(day, tz))

  // Fönstret följer vyn. Månadsvyn hämtar HELA rutnätet (inkl. randdagarna från
  // grannmånaderna) — annars ser rutnätets kanter tomma ut fast de har bokningar.
  const range =
    view === 'manad'
      ? monthGridRangeUtc(date, tz)
      : view === 'vecka'
        ? weekRangeUtc(date, tz)
        : { fromUtc: dayRanges[0]!.fromUtc, toUtc: dayRanges[2]!.toUtc }

  // Veckodagen i salongens tidszon (0=sön…6=lör, samma konvention som
  // working_hours.weekday) — inte serverns lokala dag.
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  const weekdays =
    view === 'dag' ? dayDates.map((day) => new Date(`${day}T12:00:00Z`).getUTCDay()) : [weekday]

  // Frånvaro = kalenderns blockeringar. EN modell för "resursen kan inte bokas" —
  // rast, frånvaro och avvikande arbetstid är samma sak (Wavys universalmekanism).
  // Intervall-överlapp, så en semester som började i förra fönstret syns ändå.
  const nowIso = new Date().toISOString()
  const unresolvedFilters = {
    endToUtc: nowIso,
    statuses: ['pending', 'confirmed'],
    locationId,
    staffId: ownCalendarOnly ? (user.staffId ?? undefined) : undefined,
  }
  const [
    bookings,
    unresolved,
    unresolvedCount,
    rostersByWeekday,
    timeOff,
    allServices,
    staffResources,
  ] = await Promise.all([
    listBookings(tenant.id, {
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      locationId,
    }),
    listBookings(tenant.id, {
      ...unresolvedFilters,
      limit: 50,
    }),
    countBookings(tenant.id, unresolvedFilters),
    staffDays(tenant.id, weekdays, locationId),
    // Blockeringar ritas bara i dag- och veckovyn. Månadsvyn visar antal per dag, så
    // en 42-dagars frånvarofråga där vore ren spilld last.
    view === 'manad'
      ? Promise.resolve([])
      : listTimeOffOverlapping(tenant.id, range.fromUtc, range.toUtc, locationId),
    listServices(tenant.id),
    listStaffBookingResources(tenant.id),
  ])

  const resourcesByStaff = new Map(staffResources.map((resource) => [resource.staffId, resource]))
  const activeLocationIds = new Set(locations.map((location) => location.id))
  const roster = rostersByWeekday.get(weekday) ?? []

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
  // "Bara sin egen": filtrera bokningar, blockeringar och personalkolumner till den
  // inloggades staff-rad. Endast nivå 3 utan can_view_all_calendars — ägaren ser allt.
  const visibleBookings = ownCalendarOnly
    ? bookings.filter((b) => b.staffId === user.staffId)
    : bookings
  const visibleUnresolved = unresolved
  const visibleBlocks = ownCalendarOnly ? blocks.filter((b) => b.staffId === user.staffId) : blocks
  const visibleRoster = ownCalendarOnly ? roster.filter((s) => s.staffId === user.staffId) : roster

  const payments =
    view === 'manad'
      ? new Map<string, BookingPayment>()
      : await listBookingPayments(
          tenant.id,
          visibleBookings.map((b) => b.id),
        )

  const now = Date.now()
  const NO_PAYMENT: BookingPayment = { status: null, amountCents: null }
  const allRows: BookingRow[] = visibleBookings.map((b: AdminBooking) => {
    const pay = payments.get(b.id) ?? NO_PAYMENT
    return {
      id: b.id,
      startTs: b.startTs,
      endTs: b.endTs,
      serviceName: b.serviceName,
      staffTitle: b.staffTitle,
      staffId: b.staffId,
      serviceId: b.serviceId,
      priceCents: b.priceCents,
      status: b.status,
      createdAt: b.createdAt,
      note: b.note,
      customerId: b.customerId,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      locationName: b.locationName,
      locationId: b.locationId,
      // Ett utfall kan registreras först när hela den bokade behandlingen är slut.
      isPast: new Date(b.endTs).getTime() <= now,
      paymentStatus: pay.status,
      paymentAmountCents: pay.amountCents,
    }
  })

  const staffRows = (dayRoster: typeof roster): CalendarStaff[] => {
    const visible = ownCalendarOnly
      ? dayRoster.filter((person) => person.staffId === user.staffId)
      : dayRoster
    return visible.map((person) => ({
      id: person.staffId,
      name: person.name,
      start: person.start,
      end: person.end,
      color: person.color,
      workedMinutes: person.workedMinutes,
      serviceIds: resourcesByStaff.get(person.staffId)?.serviceIds ?? [],
      locationIds:
        resourcesByStaff
          .get(person.staffId)
          ?.locationIds.filter((resourceLocationId) => activeLocationIds.has(resourceLocationId)) ??
        [],
    }))
  }

  const rowsForDate = (day: string) =>
    allRows.filter((booking) => dayKey(booking.startTs, tz) === day)
  const blocksForDate = (day: string) => {
    const dayRange = dayRangeUtc(day, tz)
    const from = new Date(dayRange.fromUtc).getTime()
    const to = new Date(dayRange.toUtc).getTime()
    return visibleBlocks.filter(
      (block) => new Date(block.startTs).getTime() < to && new Date(block.endTs).getTime() > from,
    )
  }
  const dayData = (day: string): CalendarDayData => ({
    date: day,
    bookings: rowsForDate(day),
    blocks: blocksForDate(day),
    staff: staffRows(rostersByWeekday.get(new Date(`${day}T12:00:00Z`).getUTCDay()) ?? []),
  })
  const dayNeighbors: CalendarDayNeighbors | undefined =
    view === 'dag' ? { previous: dayData(dayDates[0]), next: dayData(dayDates[2]) } : undefined
  const rows = view === 'dag' ? rowsForDate(date) : allRows
  const currentBlocks = view === 'dag' ? blocksForDate(date) : visibleBlocks
  const currentStaff = staffRows(visibleRoster)

  return (
    <>
      {unresolvedCount > 0 ? (
        <div className={calendarStyles.unresolvedHost}>
          <details className={calendarStyles.unresolvedQueue}>
            <summary
              className={calendarStyles.unresolvedSummary}
              aria-label={`${unresolvedCount} besök att stämma av`}
              title={`${unresolvedCount} besök att stämma av`}
            >
              <Icon name="clock" size={18} />
              <span>{unresolvedCount}</span>
            </summary>
            <div className={calendarStyles.unresolvedPanel}>
              <div className={calendarStyles.unresolvedNotice}>
                <div>
                  <strong>{unresolvedCount} tidigare bokningar saknar resultat.</strong> Det är ingen
                  driftstörning: tiden har passerat utan att någon valt Genomförd eller Uteblev.
                  Öppna dem här och välj rätt resultat när du stämmer av dagen. Tryck på klockan
                  igen för att stänga listan.
                </div>
                <div className={calendarStyles.unresolvedLinks}>
                  {visibleUnresolved.slice(0, 12).map((booking) => {
                    const localDate = new Intl.DateTimeFormat('en-CA', {
                      timeZone: tz,
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    }).format(new Date(booking.startTs))
                    return (
                      <Link
                        key={booking.id}
                        href={`/admin/bokningar?vy=dag&datum=${localDate}&plats=${locationId}&open=${booking.id}`}
                        className="pbtn pbtn--ghost pbtn--sm"
                      >
                        {booking.serviceName} · {booking.staffTitle}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </details>
        </div>
      ) : null}
      <CalendarBoardLazy
        bookings={rows}
        blocks={currentBlocks}
        staff={currentStaff}
        dayNeighbors={dayNeighbors}
        // Bara aktiva tjänster kan bokas — en inaktiv tjänst ska inte gå att välja i
        // drawern och sedan avvisas av servern.
        services={allServices
          .filter((s) => s.active && (s.location_id === null || s.location_id === locationId))
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
        locationId={locationId}
        staffNoun={resolveTerm(tenant.terminology, 'staff', 'Personal')}
        openBookingId={sp.open}
        onlinePaymentsActive={tenant.paymentsEnabled && tenant.stripeChargesEnabled}
        canManageBookings={canManageBookings}
      />
    </>
  )
}
