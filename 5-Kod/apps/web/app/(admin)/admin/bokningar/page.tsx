import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listBookings, listStaff } from '@/lib/admin/data'
import { dayRangeUtc, isValidDate, todayInTz } from '@/lib/admin/dates'
import { statusLabel, BOOKING_STATUSES } from '@/lib/admin/format'
import { PageHead } from '@/components/portal/ui'
import { BookingsClient } from '@/components/admin/BookingsClient'
import styles from '@/components/admin/admin.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokningar · Salongsadmin' }

type SP = { from?: string; to?: string; staff?: string; status?: string; q?: string }

export default async function BookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
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
  const fromDate = isValidDate(sp.from) ? sp.from : today
  const toDate = isValidDate(sp.to) ? sp.to : ''
  const staffFilter = sp.staff && sp.staff !== 'all' ? sp.staff : undefined
  const statusFilter =
    sp.status && BOOKING_STATUSES.includes(sp.status as (typeof BOOKING_STATUSES)[number])
      ? sp.status
      : undefined

  const query = sp.q?.trim() || undefined
  const staff = await listStaff(tenant.id)
  const bookings = await listBookings(tenant.id, {
    fromUtc: dayRangeUtc(fromDate, tz).fromUtc,
    toUtc: toDate ? dayRangeUtc(toDate, tz).toUtc : undefined,
    staffId: staffFilter,
    status: statusFilter,
    query,
  })

  return (
    <section className="portal-section">
      <PageHead eyebrow={tenant.name} title="Bokningar" />
      <p className="prose">
        Alla bokningar för {tenant.name}. Tider visas i {tz}. När en kund avbokar uppdateras
        statusen här och tiden frigörs automatiskt på din publika sajt.
      </p>

      <form method="get" className={styles.filters}>
        <label className={styles.field} style={{ flex: '1 1 12rem' }}>
          <span>Sök</span>
          <input type="text" name="q" defaultValue={sp.q ?? ''} placeholder="Tjänst, medarbetare…" />
        </label>
        <label className={styles.field}>
          <span>Från</span>
          <input type="date" name="from" defaultValue={fromDate} />
        </label>
        <label className={styles.field}>
          <span>Till</span>
          <input type="date" name="to" defaultValue={toDate} />
        </label>
        <label className={styles.field}>
          <span>Medarbetare</span>
          <select name="staff" defaultValue={staffFilter ?? 'all'}>
            <option value="all">Alla</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select name="status" defaultValue={statusFilter ?? 'all'}>
            <option value="all">Alla</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.btn}>
          Filtrera
        </button>
      </form>

      {bookings.length === 0 ? (
        <div className={styles.empty}>
          <strong>Inga bokningar matchar filtret.</strong>
          Justera datum, medarbetare eller status ovan — eller{' '}
          <Link href="/admin/bokningar" className={styles.navLink} style={{ fontSize: 'inherit' }}>
            nollställ filtret
          </Link>{' '}
          för att se alla.
        </div>
      ) : (
        <BookingsClient
          bookings={bookings.map((b) => ({
            id: b.id,
            startTs: b.startTs,
            serviceName: b.serviceName,
            staffTitle: b.staffTitle,
            priceCents: b.priceCents,
            status: b.status,
            createdAt: b.createdAt,
          }))}
          tz={tz}
        />
      )}
    </section>
  )
}
