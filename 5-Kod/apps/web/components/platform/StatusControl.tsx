'use client'

import { useActionState } from 'react'
import { setTenantStatus, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

export function StatusControl({ tenantId, status }: { tenantId: string; status: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setTenantStatus, {})
  const suspend = status === 'active'
  const nextStatus = suspend ? 'suspended' : 'active'

  return (
    <form action={formAction} className={styles.actions}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="status" value={nextStatus} />
      <button
        type="submit"
        className={`${styles.btn}${suspend ? ` ${styles.btnDanger}` : ''}`}
        disabled={pending}
      >
        {pending
          ? 'Uppdaterar…'
          : suspend
            ? 'Pausa kund (blockera publika sajten)'
            : 'Aktivera kund igen'}
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
