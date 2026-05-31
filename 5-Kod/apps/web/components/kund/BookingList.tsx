import Link from 'next/link'
import type { KundBooking } from '@/lib/kund/bookings'
import { formatSlot, formatPrice, statusLabel } from '@/lib/kund/format'
import styles from './kund.module.css'

function badgeClass(status: string): string {
  const key = `badge${status.charAt(0).toUpperCase()}${status.slice(1)}`
  return [styles.badge, styles[key]].filter(Boolean).join(' ')
}

/** Presentational list of a customer's bookings. Each row links to its detail. */
export function BookingList({ bookings, empty }: { bookings: KundBooking[]; empty: string }) {
  if (bookings.length === 0) {
    return <p className="prose">{empty}</p>
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
