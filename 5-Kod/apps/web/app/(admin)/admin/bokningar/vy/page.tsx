import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm } from '@/lib/platform/verticals-shared'
import { listBookings, listLocations, listStaff } from '@/lib/admin/data'
import { dayRangeUtc, isValidDate, todayInTz } from '@/lib/admin/dates'
import { resolvePlats, PLATS_ALLA } from '@/lib/admin/plats'
import { KioskAutoRefresh } from '@/components/admin/KioskAutoRefresh'
import { Icon } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokningsvy · Salongsadmin' }

/**
 * BOKNINGSVY — helskärms-kiosken (Zivar 2026-07-10: "jag menade bokningar-delen"):
 * dagens bokningar per medarbetare + dag-bläddring, inget annat. Tänkt att stå
 * öppen på en iPad i salongen hela dagen: admin-chromet göms via
 * .portal-shell:has(.admin-kiosk) i portal-global.css och datat hämtas om varje
 * minut (KioskAutoRefresh). Läs-läge — inga redigeringsvägar härifrån.
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

  const [staff, allLocations] = await Promise.all([listStaff(tenant.id), listLocations(tenant.id)])
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
  const bookings = (
    await listBookings(tenant.id, {
      fromUtc: range.fromUtc,
      toUtc: range.toUtc,
      locationId: plats || undefined,
    })
  ).filter((b) => b.status !== 'cancelled')

  const timeFmt = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: tz })
  const dayLabel = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`))

  // Kolumner = aktiv personal; bokningar på inaktiv/annan medarbetare hamnar
  // ärligt i en "Övriga"-kolumn i stället för att försvinna.
  const activeStaff = staff.filter((s) => s.active)
  const byStaff = new Map<string, typeof bookings>()
  for (const b of bookings) {
    const key = activeStaff.some((s) => s.displayName === b.staffTitle) ? b.staffTitle : '__other__'
    const arr = byStaff.get(key)
    if (arr) arr.push(b)
    else byStaff.set(key, [b])
  }
  const otherBookings = byStaff.get('__other__') ?? []

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
        <Link href={href(addDaysDate(day, -1))} className="admin-kiosk-navbtn" aria-label="Föregående dag">
          <Icon name="chevronLeft" size={18} /> Föregående
        </Link>
        <Link
          href={href(today)}
          className={`admin-kiosk-navbtn${day !== today ? ' is-emph' : ''}`}
          aria-label="Hoppa till idag"
        >
          Idag
        </Link>
        <Link href={href(addDaysDate(day, 1))} className="admin-kiosk-navbtn" aria-label="Nästa dag">
          Nästa <Icon name="chevronRight" size={18} />
        </Link>
        <span className="admin-kiosk-day">{dayLabel}</span>
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

      {/* En kolumn per medarbetare — dagens bokningar i tidsordning */}
      <div className="admin-kiosk-cols">
        {activeStaff.map((s) => {
          const rows = byStaff.get(s.displayName) ?? []
          return (
            <div key={s.id} className="admin-kiosk-col">
              <div className="admin-kiosk-colhead">
                <span className="admin-kiosk-avatar" aria-hidden="true">
                  {s.displayName.charAt(0).toUpperCase()}
                </span>
                {s.displayName}
                <span className="admin-kiosk-count">{rows.length}</span>
              </div>
              {rows.length === 0 ? (
                <p className="admin-kiosk-empty">Inga bokningar</p>
              ) : (
                rows.map((b) => (
                  <div key={b.id} className={`admin-kiosk-slot${b.status === 'pending' ? ' is-pending' : ''}`}>
                    <span className="admin-kiosk-time num">
                      {timeFmt.format(new Date(b.startTs))}–{timeFmt.format(new Date(b.endTs))}
                    </span>
                    <span className="admin-kiosk-cust">{b.customerName ?? 'Gäst'}</span>
                    <span className="admin-kiosk-svc">{b.serviceName}</span>
                    {b.status === 'pending' ? <span className="admin-kiosk-badge">Obekräftad</span> : null}
                    {showLocation && !plats && b.locationName ? (
                      <span className="admin-kiosk-loc">
                        <Icon name="mapPin" size={10} /> {b.locationName}
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )
        })}
        {otherBookings.length > 0 ? (
          <div className="admin-kiosk-col">
            <div className="admin-kiosk-colhead">Övriga ({staffNoun.toLowerCase()} som slutat m.m.)</div>
            {otherBookings.map((b) => (
              <div key={b.id} className="admin-kiosk-slot">
                <span className="admin-kiosk-time num">
                  {timeFmt.format(new Date(b.startTs))}–{timeFmt.format(new Date(b.endTs))}
                </span>
                <span className="admin-kiosk-cust">{b.customerName ?? 'Gäst'}</span>
                <span className="admin-kiosk-svc">{b.serviceName}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
