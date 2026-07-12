'use client'

import { useActionState } from 'react'
import { addFavorite, type FavoriteActionState } from '@/lib/kund/favorites-actions'
import styles from './kund.module.css'

/**
 * Inline "spara frisör som favorit" control for the loyalty staff-band rows.
 * When the staff is already a favorite it renders a static "Favorit" pill instead
 * of a no-op button (no dead toggles). Adding revalidates /konto so the favorites
 * list + this pill update together.
 */
export function FavoriteStaffButton({
  staffId,
  staffTitle,
  alreadyFavorite,
}: {
  staffId: string
  staffTitle: string | null
  alreadyFavorite: boolean
}) {
  const [state, formAction, pending] = useActionState<FavoriteActionState, FormData>(addFavorite, {})

  if (alreadyFavorite) {
    return (
      <span className={styles.favPill} title="Sparad som favorit">
        ★ Favorit
      </span>
    )
  }

  return (
    <form action={formAction} className={styles.favAddForm}>
      <input type="hidden" name="kind" value="staff" />
      <input type="hidden" name="targetId" value={staffId} />
      <button
        type="submit"
        className={styles.favAdd}
        disabled={pending}
        aria-label={`Spara ${staffTitle ?? 'personalen'} som favorit`}
      >
        {pending ? 'Sparar…' : '☆ Spara'}
      </button>
      {state.error ? (
        <span className={styles.favError} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}
