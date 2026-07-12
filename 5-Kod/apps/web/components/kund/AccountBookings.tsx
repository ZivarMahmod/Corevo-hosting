import type { KundBooking } from '@/lib/kund/bookings'
import { Icon } from '@/components/portal/ui'
import { RebookPanel } from './RebookPanel'
import { CancelButton } from './CancelButton'
import styles from './account.module.css'

/**
 * MINA BOKNINGAR (§4.8) — upcoming bookings as cards: weekday/time block,
 * service + "who · when", a status pill, and inline Omboka/Avboka ONLY when the
 * booking is still active (Kommande). Both actions reuse the EXISTING client
 * components (RebookPanel → rebookBooking, CancelButton → cancelBooking) — the
 * cancel/rebook actions are NOT reinvented; Avboka therefore keeps its full röd-
 * tråd (status→cancelled, slot freed, refund, admin/personal reflect it).
 *
 * The mock's per-booking "Meddela något inför besöket" input has NO customer-
 * writable note action in the consume-only lib (bookings.note is only set at
 * creation via the RPC's p_note), so it is intentionally omitted — never a dead
 * input that silently drops the message.
 *
 * Cancelled bookings render as a dimmed, struck-through row (kept, not removed —
 * mirrors Customer.jsx + the admin "avbokad = struken, ej borttagen" rule).
 */

function timeParts(iso: string, timeZone: string): { day: string; time: string } {
  const day = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(new Date(iso))
  const time = new Intl.DateTimeFormat('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
  return { day, time }
}

const ACTIVE = new Set(['pending', 'confirmed'])

function UpcomingCard({ b }: { b: KundBooking }) {
  const { day, time } = timeParts(b.startTs, b.timeZone)
  const isActive = ACTIVE.has(b.status)
  const statusText = b.status === 'pending' ? 'Ej bekräftad' : 'Kommande'
  return (
    <div className={styles.booking}>
      <div className={styles.bookingHead}>
        <div className={styles.bookingDate}>
          <div className={styles.bookingDay}>{day}</div>
          <div className={styles.bookingTime}>{time}</div>
        </div>
        <div className={styles.bookingDivider} aria-hidden />
        <div className={styles.bookingMain}>
          <div className={styles.bookingService}>{b.serviceName ?? 'Tjänst'}</div>
          <div className={styles.bookingMeta}>
            {b.staffTitle ? `hos ${b.staffTitle}` : 'på plats'}
          </div>
        </div>
        <span className={`${styles.pill} ${styles.pillUpcoming}`}>{statusText}</span>
        {isActive ? (
          <div className={styles.bookingActions}>
            {/* Inline reuse of the shipped controls (NOT reimplemented). */}
            <RebookPanel bookingId={b.id} serviceId={b.serviceId} />
            <CancelButton bookingId={b.id} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CancelledRow({ b }: { b: KundBooking }) {
  const { day, time } = timeParts(b.startTs, b.timeZone)
  return (
    <div className={styles.cancelledRow}>
      <div className={styles.cancelledTime}>{time}</div>
      <div className={styles.bookingMain}>
        <div className={styles.bookingService}>{b.serviceName ?? 'Tjänst'}</div>
        <div className={styles.bookingMeta}>
          {day}
          {b.staffTitle ? ` · ${b.staffTitle}` : ''}
        </div>
      </div>
      <span className={`${styles.pill} ${styles.pillCancelled}`}>Avbokad</span>
    </div>
  )
}

export function AccountBookings({ upcoming }: { upcoming: KundBooking[] }) {
  const active = upcoming.filter((b) => ACTIVE.has(b.status))

  return (
    <section>
      <h2 className={styles.sectionTitle}>Mina bokningar</h2>
      {active.length === 0 ? (
        <div className={styles.card}>
          <div style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 15, color: 'var(--color-fg-2)' }}>
              Du har inga kommande tider.
            </div>
            <a href="/boka" className={styles.btn} style={{ marginTop: 16 }}>
              <Icon name="calendar" size={16} style={{ marginRight: 8 }} /> Boka ny tid
            </a>
          </div>
        </div>
      ) : (
        active.map((b) => <UpcomingCard key={b.id} b={b} />)
      )}
    </section>
  )
}

/** Cancelled bookings split out so the page can render them after the active
 *  cards (matches Customer.jsx ordering). Hidden entirely when there are none. */
export function CancelledBookings({ cancelled }: { cancelled: KundBooking[] }) {
  if (cancelled.length === 0) return null
  return (
    <div>
      {cancelled.map((b) => (
        <CancelledRow key={b.id} b={b} />
      ))}
    </div>
  )
}
