import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm } from '@/lib/platform/verticals-shared'
import { listBookings, listLocations, listServices, listStaff } from '@/lib/admin/data'
import { listTimeOffOverlapping } from '@/lib/admin/schedule-data'
import { dayRangeUtc, isValidDate, todayInTz } from '@/lib/admin/dates'
import { resolvePlats, PLATS_ALLA } from '@/lib/admin/plats'
import { weekdayOf, zonedTimeToUtc } from '@/lib/booking/tz'
import { createClient } from '@/lib/supabase/server'
import { KioskAutoRefresh } from '@/components/admin/KioskAutoRefresh'
import {
  DropInColumn,
  type KioskBooking,
  type KioskFreeSlot,
} from '@/components/admin/DropInColumn'
import { Icon } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokningsvy · Salongsadmin' }

/**
 * BOKNINGSVY — helskärms-kiosken (Zivar 2026-07-10): dagens bokningar OCH lediga
 * tider per medarbetare, dag-bläddring, drop-in-bokning med 2 tryck. Tänkt att
 * stå öppen på en iPad i salongen hela dagen: admin-chromet göms via
 * .portal-shell:has(.admin-kiosk) i portal-global.css och datat hämtas om varje
 * minut (KioskAutoRefresh). Lediga tider = medarbetarens bokningsbara starttider
 * (working_hour_slots) minus bokningar/frånvaro/passerad tid — samma rådata som
 * publika flödet, så vyn och onlinebokningen kan inte säga olika saker.
 */

function addDaysDate(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export default async function BookingsKioskPage({
  searchParams,
}: {
  searchParams: Promise<{ dag?: string; plats?: string }>
}) {
  const sp = await searchParams
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Bokningsvy</h1>
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const tz = tenant.timeZone
  const today = todayInTz(tz)
  const day = isValidDate(sp.dag) ? sp.dag! : today

  const [staff, allLocations, allServices] = await Promise.all([
    listStaff(tenant.id),
    listLocations(tenant.id),
    listServices(tenant.id),
  ])
  const locations = allLocations.filter((l) => l.active)
  const showLocation = locations.length > 1
  // ?plats= vinner; utan param gäller topbarens valda butik (corevo-plats-cookien).
  const plats = showLocation
    ? await resolvePlats(
        sp.plats,
        locations.map((l) => l.id),
      )
    : ''

  const range = dayRangeUtc(day, tz)
  const wd = weekdayOf(day)

  // Dagens bokningsbara starttider (rastret publika flödet bokar ur) + frånvaro.
  const supabase = await createClient()
  let slotQuery = supabase
    .from('working_hour_slots')
    .select('staff_id, start_time, location_id, active')
    .eq('tenant_id', tenant.id)
    .eq('weekday', wd)
  if (plats) slotQuery = slotQuery.eq('location_id', plats)
  const [bookingsRaw, { data: slotRows }, timeOff] = await Promise.all([
    listBookings(tenant.id, {
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      locationId: plats || undefined,
    }),
    slotQuery,
    listTimeOffOverlapping(tenant.id, range.fromUtc, range.toUtc),
  ])
  const bookings = bookingsRaw.filter((b) => b.status !== 'cancelled')

  const timeFmt = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  const dayLabel = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`))

  // Aktiva tjänster i drop-in-panelen (första = förvald → 2 tryck totalt).
  const services = allServices
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, durationMin: s.duration_min ?? 30 }))

  const activeStaff = staff.filter((s) => s.active)
  const staffById = new Map(activeStaff.map((s) => [s.id, s]))
  const now = Date.now()

  // Bokningar per medarbetar-id (kolumnens övre halva av sanningen).
  const bookingsByStaff = new Map<string, KioskBooking[]>()
  const otherBookings: KioskBooking[] = []
  for (const b of bookings) {
    const row: KioskBooking = {
      id: b.id,
      startMs: new Date(b.startTs).getTime(),
      timeLabel: `${timeFmt.format(new Date(b.startTs))}–${timeFmt.format(new Date(b.endTs))}`,
      customerName: b.customerName ?? 'Gäst',
      serviceName: b.serviceName,
      pending: b.status === 'pending',
      locationName: showLocation && !plats ? (b.locationName ?? null) : null,
    }
    if (staffById.has(b.staffId)) {
      const arr = bookingsByStaff.get(b.staffId)
      if (arr) arr.push(row)
      else bookingsByStaff.set(b.staffId, [row])
    } else otherBookings.push(row)
  }

  // Lediga tider: slot-raster − passerad tid − bokningstäckning − frånvaro.
  // Dubbelbokning avgörs ALLTID av RPC:n vid bokningsklicket — det här är vyn.
  const freeByStaff = new Map<string, KioskFreeSlot[]>()
  for (const r of slotRows ?? []) {
    if (r.active === false) continue
    if (!staffById.has(r.staff_id)) continue
    const startUtc = zonedTimeToUtc(day, r.start_time, tz)
    const ms = startUtc.getTime()
    const covered = bookings.some((b) => {
      if (b.staffId !== r.staff_id) return false
      return new Date(b.startTs).getTime() <= ms && ms < new Date(b.endTs).getTime()
    })
    if (covered) continue
    const off = timeOff.some(
      (t) => t.staff_id === r.staff_id && new Date(t.start_ts).getTime() <= ms && ms < new Date(t.end_ts).getTime(),
    )
    if (off) continue
    const arr = freeByStaff.get(r.staff_id) ?? []
    // Samma tid på två platser (utan filter) visas EN gång — bokningen bär slotens plats.
    if (arr.some((x) => x.startMs === ms)) continue
    arr.push({
      startIso: startUtc.toISOString(),
      startMs: ms,
      label: timeFmt.format(startUtc),
      locationId: r.location_id ?? null,
      // Passerade tider visas dimmade (bokas ej) — dagens raster ska inte
      // krympa allteftersom klockan går (Zivar 2026-07-10).
      past: ms <= now,
    })
    freeByStaff.set(r.staff_id, arr)
  }

  // Plats skrivs alltid explicit vid flera platser ('alla' = sentinel) så
  // butik-cookien inte återtar valet vid dag-bläddring (lib/admin/plats.ts).
  const withPlats = (q: URLSearchParams, p: string) => {
    if (p) q.set('plats', p)
    else if (showLocation) q.set('plats', PLATS_ALLA)
  }
  const href = (d: string) => {
    const q = new URLSearchParams()
    q.set('dag', d)
    withPlats(q, plats)
    return `/admin/bokningar/vy?${q.toString()}`
  }
  const platsHref = (p: string) => {
    const q = new URLSearchParams()
    q.set('dag', day)
    withPlats(q, p)
    return `/admin/bokningar/vy?${q.toString()}`
  }

  const staffNoun = resolveTerm(tenant.terminology, 'staff', 'Frisör')

  return (
    <section className="admin-kiosk">
      <KioskAutoRefresh seconds={60} />

      <div className="admin-kiosk-head">
        <span className="admin-kiosk-brand">{tenant.name}</span>
        <Link href="/admin/bokningar" className="admin-kiosk-back">
          <Icon name="chevronLeft" size={14} />
          Till admin
        </Link>
      </div>

      {/* Dag-bläddring: stora touch-mål för surfplattan */}
      <div className="admin-kiosk-nav">
        <Link
          href={href(addDaysDate(day, -1))}
          prefetch
          className="admin-kiosk-navbtn"
          aria-label="Föregående dag"
        >
          <Icon name="chevronLeft" size={26} />
        </Link>
        <span className="admin-kiosk-day">{dayLabel}</span>
        <Link
          href={href(addDaysDate(day, 1))}
          prefetch
          className="admin-kiosk-navbtn"
          aria-label="Nästa dag"
        >
          <Icon name="chevronRight" size={26} />
        </Link>
        {day !== today ? (
          <Link href={href(today)} className="admin-kiosk-navbtn is-emph" aria-label="Hoppa till idag">
            Idag
          </Link>
        ) : null}
        {showLocation ? (
          <span className="admin-kiosk-plats">
            <Link href={platsHref('')} className={`admin-kiosk-chip${plats === '' ? ' is-on' : ''}`}>
              Alla platser
            </Link>
            {locations.map((l) => (
              <Link key={l.id} href={platsHref(l.id)} className={`admin-kiosk-chip${plats === l.id ? ' is-on' : ''}`}>
                {l.name}
              </Link>
            ))}
          </span>
        ) : null}
      </div>

      {/* En kolumn per medarbetare — bokat + ledigt i tidsordning, drop-in med 2 tryck */}
      <div className="admin-kiosk-cols">
        {activeStaff.map((s) => (
          <DropInColumn
            key={s.id}
            staffId={s.id}
            staffName={s.displayName}
            bookings={bookingsByStaff.get(s.id) ?? []}
            freeSlots={(freeByStaff.get(s.id) ?? []).sort((a, b) => a.startMs - b.startMs)}
            services={services}
            showLoc={showLocation && !plats}
          />
        ))}
        {otherBookings.length > 0 ? (
          <div className="admin-kiosk-col">
            <div className="admin-kiosk-colhead">Övriga ({staffNoun.toLowerCase()} som slutat m.m.)</div>
            {otherBookings.map((b) => (
              <div key={b.id} className="admin-kiosk-slot">
                <span className="admin-kiosk-time num">{b.timeLabel}</span>
                <span className="admin-kiosk-cust">{b.customerName}</span>
                <span className="admin-kiosk-svc">{b.serviceName}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
