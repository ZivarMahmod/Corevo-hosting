import type { LoyaltyView } from '@/lib/kund/loyalty'
import { LoyaltyBlock, Icon } from '@/components/portal/ui'
import styles from './account.module.css'

/**
 * LOJALITET band (§4.8) — the dark, --color-primary-FILLED card with WHITE
 * content (Customer.jsx's sage band). The accent is the SALON's theme color
 * (--color-primary), NEVER Corevo --c-gold.
 *
 * Earning is NOT wired this wave (points are minted by a separate DB trigger,
 * migration 0013), so loyalty.ts forbids implying accrual when `hasLedger` is
 * false. We therefore branch:
 *   · hasLedger === true → real points exist: render the shared LoyaltyBlock
 *     (world="storefront" onAccent) with the derived points/tier/nextTier — its
 *     own numeral + progress rail + gift.
 *   · hasLedger === false → render the SAME filled band (the composition is the
 *     point — the customer always sees the card, never a blank) but with an
 *     HONEST written empty-state ("Poäng tjänas vid genomförda besök…"), NO
 *     numeral, NO progress rail, NO "X p kvar". Showing 0 points + a rail would
 *     be the fake the mock tempts toward.
 */
export function AccountLoyalty({ view }: { view: LoyaltyView }) {
  if (view.hasLedger) {
    // NOTE (future earning, migration 0013): LoyaltyBlock draws its rail as
    // points/nextTierAt. We pass the spendable balance + the next tier's lifetime
    // threshold, which is a reasonable "progress toward the reward" read for the
    // band. loyalty.ts keeps balance (spendable) and lifetime (tier basis)
    // distinct — view.toNextTier is the lifetime-correct remaining. If a stricter
    // lifetime-based rail is wanted once earning lands, pass lifetime here. Moot
    // for the current FreshCut demo (hasLedger=false → the empty-state branch).
    return (
      <section className={styles.loyalty}>
        <LoyaltyBlock
          world="storefront"
          onAccent
          tier={view.tier.label}
          points={view.balance}
          nextTierAt={view.nextTier ? view.nextTier.threshold : null}
        />
      </section>
    )
  }

  // No real points yet — keep the band, written empty-state inside it.
  const framing =
    view.completedVisits > 0
      ? 'Dina genomförda besök räknas. Så fort poängen börjar registreras ser du din nivå och ditt saldo här.'
      : 'Du tjänar poäng varje gång du varit på ett genomfört besök. När du börjar samla dyker din nivå och dina poäng upp här.'

  return (
    <section className={styles.loyalty}>
      <div className={styles.loyaltyEmpty}>
        <div className={styles.loyaltyEmptyText}>
          <div className={styles.loyaltyEyebrow}>Lojalitet</div>
          <p className={styles.loyaltyEmptyBody}>{framing}</p>
        </div>
        <span className={styles.loyaltyGift} aria-hidden>
          <Icon name="gift" size={30} />
        </span>
      </div>
    </section>
  )
}
