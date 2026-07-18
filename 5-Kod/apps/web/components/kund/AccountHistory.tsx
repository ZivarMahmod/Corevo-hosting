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
 * Only status=completed is a visit. No-show, cancelled and passed-but-unresolved
 * rows are shown separately with their real state and never receive visit points.
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
  const rows = past.filter((b) => b.status === 'completed')
  const outcomes = past.filter((b) => b.status !== 'completed')
  const pointsById = new Map(pointsPerVisit.map((p) => [p.bookingId, p.pointsDelta]))

  return (
    <>
      <section>
        <h2 className={styles.sectionTitle}>Tidigare besök</h2>
        {rows.length === 0 ? (
          <div className={styles.card}>
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--color-fg-2)', fontSize: 15 }}>
              Inga genomförda besök ännu.
            </div>
          </div>
        ) : (
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
        )}
      </section>

      {outcomes.length > 0 ? (
        <section>
          <h2 className={styles.sectionTitle}>Övriga bokningar</h2>
          <div className={styles.history}>
            {outcomes.map((b) => (
              <div key={b.id} className={styles.historyRow}>
                <div className={styles.historyIcon} aria-hidden>
                  <Icon name="clock" size={17} />
                </div>
                <div className={styles.historyMain}>
                  <div className={styles.historyService}>{b.serviceName ?? 'Tjänst'}</div>
                  <div className={styles.historyMeta}>
                    {visitDate(b.startTs, b.timeZone)}
                    {b.staffTitle ? ` · ${b.staffTitle}` : ''}
                  </div>
                </div>
                <div className={styles.historyRight}>
                  <div className={styles.historyMeta}>
                    {b.status === 'no_show'
                      ? 'Uteblev'
                      : b.status === 'cancelled'
                        ? 'Avbokad'
                        : 'Väntar på avslut från verksamheten'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
