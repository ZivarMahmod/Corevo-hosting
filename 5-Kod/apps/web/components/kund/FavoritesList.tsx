'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import type { Favorite } from '@/lib/kund/favorites'
import { removeFavorite, type FavoriteActionState } from '@/lib/kund/favorites-actions'
import { formatPrice } from '@/lib/kund/format'
import { resolveTerm, type Terminology } from '@/lib/platform/verticals-shared'
import styles from './kund.module.css'

function RemoveButton({ favoriteId, label }: { favoriteId: string; label: string }) {
  const [state, formAction, pending] = useActionState<FavoriteActionState, FormData>(
    removeFavorite,
    {},
  )
  return (
    <form action={formAction} className={styles.favRemoveForm}>
      <input type="hidden" name="favoriteId" value={favoriteId} />
      <button
        type="submit"
        className={styles.favRemove}
        disabled={pending}
        aria-label={`Ta bort ${label} från favoriter`}
        title="Ta bort favorit"
      >
        {pending ? '…' : '✕'}
      </button>
      {state.error ? (
        <span className={styles.favError} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}

/**
 * Favoriter (M4 §2.3): the customer's saved staff + services with quick-rebook
 * and remove. Quick-rebook links into /boka carrying the favorite as a query
 * param (?staff= / ?service=) so the M3 booking wizard can prefill the selection;
 * harmless if M3 ignores it (it just lands on /boka). Honest empty state.
 */
export function FavoritesList({
  favorites,
  terminology = {},
}: {
  favorites: Favorite[]
  /** Bransch label overlay (verticals.terminology). Optional → default {} renders
   *  today's exact text (DIFF-0). Passed by the /konto mount which has tenant ctx. */
  terminology?: Terminology
}) {
  const staffLc = resolveTerm(terminology, 'staff', 'personal') // lowercase nominative
  const staffUc = resolveTerm(terminology, 'staff', 'Personal') // capitalized nominative
  if (favorites.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
          Inga favoriter än. Spara din {staffLc} eller en favorittjänst så får du snabbare till nästa
          bokning.
        </p>
        <Link href="/boka" className="btn-primary">
          Boka tid
        </Link>
      </div>
    )
  }

  return (
    <ul className={styles.favList}>
      {favorites.map((f) => (
        <li key={f.id} className={styles.favItem}>
          <span className={styles.favMain}>
            <span className={styles.favKind} aria-hidden>
              {f.kind === 'staff' ? '✂' : '◆'}
            </span>
            <span className={styles.favText}>
              <strong>{f.name}</strong>
              <span className={styles.sub}>
                {f.kind === 'staff' ? staffUc : 'Tjänst'}
                {f.kind === 'service' && f.priceCents != null ? ` · ${formatPrice(f.priceCents)}` : ''}
              </span>
            </span>
          </span>
          <span className={styles.favActions}>
            <Link
              href={f.kind === 'staff' ? `/boka?staff=${f.staffId}` : `/boka?service=${f.serviceId}`}
              className={styles.favBook}
            >
              Boka
            </Link>
            <RemoveButton favoriteId={f.id} label={f.name} />
          </span>
        </li>
      ))}
    </ul>
  )
}
