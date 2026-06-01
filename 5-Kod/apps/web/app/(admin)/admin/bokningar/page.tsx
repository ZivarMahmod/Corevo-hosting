import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listBookings, listStaff } from '@/lib/admin/data'
import { dayRangeUtc, isValidDate, todayInTz } from '@/lib/admin/dates'
import { formatDateTime, formatPrice, statusLabel, BOOKING_STATUSES } from '@/lib/admin/format'
import { badgeClass } from '@/components/admin/badge'
import { BookingStatusControl } from '@/components/admin/BookingStatusControl'
import styles from '@/components/admin/admin.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Bokningar · Salongsadmin' }

type SP = { from?: string; to?: string; staff?: string; status?: string }

export default async function BookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Bokningar</h1>
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

  const staff = await listStaff(tenant.id)
  const bookings = await listBookings(tenant.id, {
    fromUtc: dayRangeUtc(fromDate, tz).fromUtc,
    toUtc: toDate ? dayRangeUtc(toDate, tz).toUtc : undefined,
    staffId: staffFilter,
    status: statusFilter,
  })

  return (
    <section className="portal-section">
      <h1>Bokningar</h1>
      <p className="prose">Alla bokningar för {tenant.name}. Tider visas i {tz}.</p>

      <form method="get" className={styles.filters}>
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
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Tid</th>
              <th>Tjänst</th>
              <th>Medarbetare</th>
              <th>Pris</th>
              <th>Status</th>
              <th>Ändra</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>{formatDateTime(b.startTs, tz)}</td>
                <td>{b.serviceName}</td>
                <td>{b.staffTitle}</td>
                <td>{formatPrice(b.priceCents)}</td>
                <td>
                  <span className={badgeClass(b.status)}>{statusLabel(b.status)}</span>
                </td>
                <td>
                  <BookingStatusControl bookingId={b.id} status={b.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
