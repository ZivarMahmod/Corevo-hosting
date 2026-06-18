import type { LoyaltyView } from '@/lib/kund/loyalty'
import { FavoriteStaffButton } from './FavoriteStaffButton'
import styles from './kund.module.css'

/**
 * @deprecated goal-46 audit 2026-06-17: oanvänd build-once-dubblett. Ersatt av
 * AccountLoyalty (components/kund/AccountLoyalty.tsx) på worldade /konto §4.8;
 * stamkund-bandet om-hemmat till StylistCard. Behålls (build-once), ej raderad.
 *
 * Loyalty visning (M4 §2.2). Presentational — all derivation lives in
 * lib/kund/loyalty.ts. HONEST about earning, which is NOT wired here (points are
 * minted by a separate DB trigger, migration 0013). Three states:
 *   · hasActivity=false → nothing yet; explain points are earned at completed visits.
 *   · hasActivity=true, hasLedger=false → the customer HAS completed visits but no
 *     points exist yet (the common case until 0013). Show the real staff band
 *     ("sett Erik 3 gånger") + the earning explanation — but NO tier badge, NO
 *     balance, NO progress bar (those would imply accrual that hasn't happened).
 *   · hasLedger=true → real points: tier + balance + progress to next tier + band.
 * Colours use tema tokens (--color-primary / --color-accent) — never hardcoded
 * Corevo gold — so the card matches the salon's storefront theme.
 */
export function LoyaltyCard({
  view,
  favoriteStaffIds,
}: {
  view: LoyaltyView
  /** customers' currently-favorited staff ids → render "Favorit" vs "Spara". */
  favoriteStaffIds: string[]
}) {
  const favSet = new Set(favoriteStaffIds)
  if (!view.hasActivity) {
    return (
      <div className={styles.loyaltyEmpty}>
        <p className={styles.emptyText}>
          Du tjänar poäng varje gång du varit på ett genomfört besök hos salongen. När du börjar
          samla dyker din nivå och dina poäng upp här.
        </p>
      </div>
    )
  }

  const pct =
    view.nextTier && view.nextTier.threshold > view.tier.threshold
      ? Math.min(
          100,
          Math.round(
            ((view.lifetime - view.tier.threshold) /
              (view.nextTier.threshold - view.tier.threshold)) *
              100,
          ),
        )
      : 100

  const band =
    view.staffBands.length > 0 ? (
      <div className={styles.bandWrap}>
        <h3 className={styles.bandTitle}>Dina frisörer</h3>
        <ul className={styles.bandList}>
          {view.staffBands.map((b) => (
            <li key={b.staffId} className={styles.bandRow}>
              <span className={styles.bandName}>{b.staffTitle ?? 'Frisör'}</span>
              <span className={styles.bandMeta}>
                <span className={styles.muted}>
                  {b.visits === 1 ? 'sett 1 gång' : `sett ${b.visits} gånger`}
                </span>
                <FavoriteStaffButton
                  staffId={b.staffId}
                  staffTitle={b.staffTitle}
                  alreadyFavorite={favSet.has(b.staffId)}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null

  // No real points yet — show honest framing + the band, but never a tier badge,
  // balance or progress bar (that would lie about accrual that hasn't happened).
  if (!view.hasLedger) {
    return (
      <div className={styles.loyaltyCard}>
        <p className={styles.emptyText}>
          Poäng tjänas vid genomförda besök hos salongen. Så fort de börjar registreras ser du din
          nivå och ditt saldo här.
        </p>
        {band}
      </div>
    )
  }

  return (
    <div className={styles.loyaltyCard}>
      <div className={styles.loyaltyHead}>
        <div>
          <span className={styles.loyaltyTierLabel}>Din nivå</span>
          <strong className={styles.loyaltyTier}>{view.tier.label}</strong>
        </div>
        <div className={styles.loyaltyBalance}>
          <strong>{view.balance}</strong>
          <span>poäng</span>
        </div>
      </div>

      {view.nextTier ? (
        <div className={styles.loyaltyProgress}>
          <div className={styles.loyaltyBar} aria-hidden>
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className={styles.muted}>
            {view.toNextTier > 0
              ? `${view.toNextTier} poäng kvar till ${view.nextTier.label}.`
              : `Du har nått ${view.nextTier.label}!`}
          </p>
        </div>
      ) : (
        <p className={styles.muted}>Du är på den högsta nivån — tack för din lojalitet!</p>
      )}

      {band}
    </div>
  )
}
