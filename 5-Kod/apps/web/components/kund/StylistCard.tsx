import Link from 'next/link'
import type { StaffFavorite } from '@/lib/kund/favorites'
import type { StaffBand } from '@/lib/kund/loyalty'
import { FavoriteStaffButton } from './FavoriteStaffButton'
import styles from './account.module.css'

/**
 * DIN FRISÖR card (§4.8) — the emotional core of /konto. Surfaces the ONE staff
 * the customer favorited (getCustomerStaffFavorite). The mock also shows a
 * personal stylist quote + "minns om dig" memory chips + a "din stil"-galleri —
 * but those are read from customer_notes, which is staff-only by RLS (0011,
 * role>=3). A logged-in customer CANNOT read their own notes, so those parts are
 * a DATA-GATED, WRITTEN empty-state ("Din frisör lär känna dig med tiden."),
 * never fabricated.
 *
 * States:
 *   · favorite present → name + relationship line + the written empty-state note
 *     + "Boka hos {frisör}".
 *   · no favorite, but visited stylists exist → re-homed staff-band from the old
 *     LoyaltyCard ("sett Erik 3 gånger" + the inline FavoriteStaffButton) so the
 *     shipped favoriting capability is preserved, not dropped.
 *   · no favorite, no visits → honest CTA to find a frisör.
 *
 * The "Skriv till {frisör}" message input the mock shows has NO customer-writable
 * action (no note/message channel exists in the consume-only lib) — so it is
 * intentionally omitted (no dead control). "Boka hos {frisör}" deep-links into
 * the real /boka flow carrying the staff id (mirrors FavoritesList's quick-book).
 */
export function StylistCard({
  favorite,
  staffBands,
  favoriteStaffIds,
}: {
  favorite: StaffFavorite | null
  staffBands: StaffBand[]
  favoriteStaffIds: string[]
}) {
  if (favorite) {
    const name = favorite.title?.trim() || 'Din frisör'
    const initial = name.charAt(0).toUpperCase()
    const band = staffBands.find((b) => b.staffId === favorite.staffId)
    const rel = band
      ? band.visits === 1
        ? 'Din sparade frisör · ni har setts 1 gång'
        : `Din sparade frisör · ni har setts ${band.visits} gånger`
      : 'Din sparade frisör hos salongen.'
    return (
      <section className={styles.card}>
        <div className={styles.stylistHead}>
          <div className={styles.heroAvatar} aria-hidden>
            {initial}
          </div>
          <div className={styles.heroText}>
            <div className={styles.sectionEyebrow}>Din frisör</div>
            <div className={styles.stylistName}>{name}</div>
            <div className={styles.stylistRel}>{rel}</div>
          </div>
        </div>

        {/* Data-gated written empty-state: customer_notes is staff-only (RLS), so a
            customer cannot read the stylist's "minns om dig" chips or a personal
            quote. We say so honestly rather than faking memory/notes. */}
        <div className={styles.emptyNote}>
          <p>
            Din frisör lär känna dig med tiden. Det ni går igenom under besöket stannar hos din
            frisör.
          </p>
        </div>

        <div className={styles.cardFoot}>
          <Link href={`/boka?staff=${favorite.staffId}`} className={styles.btn}>
            Boka hos {name}
          </Link>
        </div>
      </section>
    )
  }

  // No favorite yet — if the customer has visited stylists, re-home the staff-band
  // (visit count + inline favoriting) so they can pick their frisör. Otherwise a
  // plain CTA.
  const favSet = new Set(favoriteStaffIds)
  return (
    <section className={styles.card}>
      <div className={styles.stylistHead}>
        <div className={styles.heroAvatar} aria-hidden>
          ?
        </div>
        <div className={styles.heroText}>
          <div className={styles.sectionEyebrow}>Din frisör</div>
          <div className={styles.stylistName}>Välj din frisör</div>
          <div className={styles.stylistRel}>
            Spara din favoritfrisör så samlar vi din relation och dina bokningar på ett ställe.
          </div>
        </div>
      </div>

      {staffBands.length > 0 ? (
        <div className={styles.cardBlock}>
          <div className={styles.blockLabel}>Frisörer du träffat</div>
          <ul className={styles.bandList}>
            {staffBands.map((b) => (
              <li key={b.staffId} className={styles.bandRow}>
                <span className={styles.bandName}>{b.staffTitle ?? 'Frisör'}</span>
                <span className={styles.bandMeta}>
                  <span className={styles.bandVisits}>
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
      ) : null}

      <div className={styles.stylistEmpty}>
        <Link href="/boka" className={styles.btn}>
          Hitta din frisör
        </Link>
      </div>
    </section>
  )
}
