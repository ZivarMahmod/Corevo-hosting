'use client'

import { useActionState } from 'react'
import { saveTenantName, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Salongsnamn i Sida-flikens Allmänt (Zivar: "salongsnamnet från Drift ska komma in
 * här"). Namnet är sidans identitet: det visas högst upp i sidhuvudet när ingen
 * logotyp är uppladdad, i sidfoten och i bokningen. Thin action (saveTenantName) —
 * rör inget annat.
 */
export function TenantNameCard({
  tenantId,
  name,
  onSaved,
  onFlash,
}: {
  tenantId: string
  name: string
  onSaved?: () => void
  /** "Visa var": blinkar namnet i previewen. */
  onFlash?: (text: string) => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (p, fd) => {
      const r = await saveTenantName(p, fd)
      if (r.success) onSaved?.()
      return r
    },
    {},
  )

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <label className={styles.field}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Salongsnamn
          {onFlash ? (
            <button
              type="button"
              className={styles.btn}
              style={{ padding: '2px 8px', fontSize: 11, marginLeft: 'auto' }}
              onClick={() => onFlash(name)}
              title="Blinkar namnet i previewen så du ser exakt var det syns"
            >
              Visa var
            </button>
          ) : null}
        </span>
        <input name="name" defaultValue={name} required maxLength={120} />
        <span className={styles.hint}>
          Visas högst upp i sidhuvudet (när ingen logotyp finns), i sidfoten och i
          bokningen. Samma namn som i Drift-fliken.
        </span>
      </label>
      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara namn'}
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
      </div>
    </form>
  )
}
