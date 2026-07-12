'use client'

import { useActionState } from 'react'
import { setSajtbyggareEnabled, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Per-tenant edit-toggle for the site editor (sajtbyggaren). Platform-only control
 * (lives in the salong-detalj Drift-tab). Posts the NEXT state so one button flips it.
 * Mirrors StatusControl's form + feedback pattern exactly.
 */
export function SajtbyggareControl({ tenantId, enabled }: { tenantId: string; enabled: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setSajtbyggareEnabled, {})
  const next = !enabled

  return (
    <form action={formAction} className={styles.actions}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="enabled" value={String(next)} />
      <button
        type="submit"
        className={`${styles.btn}${enabled ? ` ${styles.btnDanger}` : ''}`}
        disabled={pending}
      >
        {pending
          ? 'Uppdaterar…'
          : enabled
            ? 'Stäng av sajtbyggaren för kunden'
            : 'Aktivera sajtbyggaren för kunden'}
      </button>
      {state.error ? (
        <span className={`${styles.feedback} auth-error`} role="alert">
          {state.error}
        </span>
      ) : null}
      {state.success ? (
        <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
          {state.success}
        </span>
      ) : null}
    </form>
  )
}
