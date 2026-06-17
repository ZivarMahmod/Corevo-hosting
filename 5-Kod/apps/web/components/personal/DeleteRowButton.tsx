'use client'

import { useActionState } from 'react'
import type { ActionState } from '@/lib/personal/actions'
import styles from './personal.module.css'

type DeleteAction = (prev: ActionState, formData: FormData) => Promise<ActionState>

/**
 * Generic delete-one-row button backed by a server action (working_hours / time_off).
 *
 * NOTE (goal-46 audit 2026-06-17): delad återanvändbar primitiv. Enda nuvarande
 * konsument (TimeOffManager) är deprecated → f.n. oanvänd, MEN ej ersatt — behålls
 * som delad util (DeleteAbsenceButton speglar denna, inte tvärtom). Build-once.
 */
export function DeleteRowButton({
  id,
  action,
  label = 'Ta bort',
}: {
  id: string
  action: DeleteAction
  label?: string
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {})

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`${styles.btn} ${styles.btnDanger}`} disabled={pending}>
        {pending ? '…' : label}
      </button>
      {state.error ? (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}
