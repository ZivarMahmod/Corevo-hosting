import type { KundBooking } from '@/lib/kund/bookings'
import type { LoyaltyVisitPoints } from '@/lib/kund/loyalty'
import { Icon } from '@/components/portal/ui'
import { formatPrice } from '@/lib/kund/format'
import styles from './account.module.css'

/**
 * TIDIGARE BESÖK (§4.8) — history rows: service + date + price + "+{points} p"
 * per visit in the THEME accent (--color-primary). Points-per-visit is derived
 * from the loyalty_ledger via getCustomerLoyaltyPointsPerVisit (keyed on
 * booking_id) — passed in as a map. When a visit has no positive ledger entry
 * (the common case until earning lands in migration 0013) the "+p" is omitted,
 * never shown as "+0 p" and never fabricated.
 *
 * Only genuinely past visits are shown (completed / no_show / cancelled history
 * the page already split via getMyBookings.past). Honest empty-state when none.
 */
function visitDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  }).format(new Date(iso))
}

export function AccountHistory({
  past,
  pointsPerVisit,
}: {
  past: KundBooking[]
  pointsPerVisit: LoyaltyVisitPoints[]
}) {
  // Only "real" history reads cleanly here: completed visits + no-shows. Cancelled
  // rows are surfaced in MINA BOKNINGAR as struck-through, so exclude them here to
  // avoid double-listing.
  const rows = past.filter((b) => b.status !== 'cancelled')
  const pointsById = new Map(pointsPerVisit.map((p) => [p.bookingId, p.pointsDelta]))

  if (rows.length === 0) {
    return (
      <section>
        <h2 className={styles.sectionTitle}>Tidigare besök</h2>
        <div className={styles.card}>
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--color-fg-2)', fontSize: 15 }}>
            Ingen bokningshistorik ännu. Dina genomförda besök dyker upp här.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className={styles.sectionTitle}>Tidigare besök</h2>
      <div className={styles.history}>
        {rows.map((b) => {
          const pts = pointsById.get(b.id) ?? 0
          return (
            <div key={b.id} className={styles.historyRow}>
              <div className={styles.historyIcon} aria-hidden>
                <Icon name="scissors" size={17} />
              </div>
              <div className={styles.historyMain}>
                <div className={styles.historyService}>{b.serviceName ?? 'Tjänst'}</div>
                <div className={styles.historyMeta}>
                  {visitDate(b.startTs, b.timeZone)}
                  {b.staffTitle ? ` · ${b.staffTitle}` : ''}
                </div>
              </div>
              <div className={styles.historyRight}>
                {b.priceCents != null ? (
                  <div className={styles.historyPrice}>{formatPrice(b.priceCents)}</div>
                ) : null}
                {pts > 0 ? <div className={styles.historyPoints}>+{pts} p</div> : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
