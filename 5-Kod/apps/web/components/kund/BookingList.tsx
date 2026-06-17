import Link from 'next/link'
import type { KundBooking } from '@/lib/kund/bookings'
import { formatSlot, formatPrice, statusLabel } from '@/lib/kund/format'
import styles from './kund.module.css'

function badgeClass(status: string): string {
  const key = `badge${status.charAt(0).toUpperCase()}${status.slice(1)}`
  return [styles.badge, styles[key]].filter(Boolean).join(' ')
}

/**
 * @deprecated goal-46 audit 2026-06-17: oanvänd build-once-dubblett. Ersatt av
 * AccountBookings (components/kund/AccountBookings.tsx) på worldade /konto §4.8,
 * samma KundBooking-källa. Behålls (build-once-never-delete), ej raderad.
 *
 * Presentational list of a customer's bookings. Each row links to its detail.
 * When `emptyCta` is set the empty state offers a primary "Boka tid" action,
 * which is the meaningful next step for the upcoming list.
 */
export function BookingList({
  bookings,
  empty,
  emptyCta = false,
}: {
  bookings: KundBooking[]
  empty: string
  emptyCta?: boolean
}) {
  if (bookings.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>{empty}</p>
        {emptyCta ? (
          <Link href="/boka" className="btn-primary">
            Boka tid
          </Link>
        ) : null}
      </div>
    )
  }
  return (
    <ul className={styles.list}>
      {bookings.map((b) => (
        <li key={b.id} className={styles.item}>
          <Link href={`/konto/bokningar/${b.id}`} className={styles.link}>
            <span className={styles.main}>
              <strong>{b.serviceName ?? 'Tjänst'}</strong>
              <span className={styles.sub}>
                {formatSlot(b.startTs, b.timeZone)}
                {b.staffTitle ? ` · ${b.staffTitle}` : ''}
              </span>
            </span>
            <span className={styles.meta}>
              <span className={badgeClass(b.status)}>{statusLabel(b.status)}</span>
              {b.priceCents != null ? <span>{formatPrice(b.priceCents)}</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
