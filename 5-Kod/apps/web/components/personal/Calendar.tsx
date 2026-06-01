import type { StaffBooking } from '@/lib/personal/calendar'
import { fmtTime, fmtDateHeading, statusLabel } from '@/lib/personal/format'
import { BookingStatusActions } from './BookingStatusActions'
import styles from './personal.module.css'

const ACTIVE = new Set(['pending', 'confirmed'])

function badgeClass(status: string): string {
  const key = `badge${status.charAt(0).toUpperCase()}${status.slice(1)}`
  return [styles.badge, styles[key]].filter(Boolean).join(' ')
}

export type CalendarGroup = { dateStr: string; bookings: StaffBooking[] }

/** Presentational day/week calendar. Each group = one calendar day. */
export function Calendar({ groups }: { groups: CalendarGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.dateStr} className={styles.dayGroup}>
          <h3 className={styles.dayHeading}>{fmtDateHeading(g.dateStr)}</h3>
          {g.bookings.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Inga bokningar</p>
              <p className={styles.emptyHint}>Den här dagen är fri – inga inbokade kunder.</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {g.bookings.map((b) => (
                <li key={b.id} className={styles.row}>
                  <div className={styles.rowHead}>
                    <div className={styles.rowMain}>
                      <span className={styles.rowTime}>
                        {fmtTime(b.startTs, b.timeZone)}–{fmtTime(b.endTs, b.timeZone)}
                      </span>
                      <span className={styles.rowSub}>
                        {b.serviceName ?? 'Tjänst'} · {b.customerLabel}
                      </span>
                    </div>
                    <span className={badgeClass(b.status)}>{statusLabel(b.status)}</span>
                  </div>
                  {ACTIVE.has(b.status) ? <BookingStatusActions bookingId={b.id} /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  )
}
