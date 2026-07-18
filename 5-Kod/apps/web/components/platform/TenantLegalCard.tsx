'use client'

import { useActionState } from 'react'
import { saveTenantLegal, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Juridikuppgifter (goal-72 etapp 1c): org-nr + moms-sats → settings.legal.
 * Konsumeras av villkorssidan och kvittomejlet (plan 003) — tomt = raden utelämnas.
 */
export function TenantLegalCard({
  tenantId,
  orgNr,
  vatRate,
}: {
  tenantId: string
  orgNr: string | null
  vatRate: number | null
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveTenantLegal, {})

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <label className={styles.field}>
        <span>Organisationsnummer</span>
        <input
          name="org_nr"
          defaultValue={orgNr ?? ''}
          placeholder="556677-8899"
          autoComplete="off"
          spellCheck={false}
        />
        <span className={styles.hint}>
          Visas på villkorssidan och kvittomejlet. Tomt = raden utelämnas.
        </span>
      </label>
      <label className={styles.field}>
        <span>Momssats (%)</span>
        <input
          name="vat_rate"
          defaultValue={vatRate ?? ''}
          placeholder="25"
          inputMode="decimal"
          autoComplete="off"
        />
        <span className={styles.hint}>Momsraden på kvittot (t.ex. 25). Tomt = ingen momsrad.</span>
      </label>
      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara juridikuppgifter'}
        </button>
        {state.error ? (
          <span className={`${styles.feedback} auth-error`} role="alert">
            {state.error}
          </span>
        ) : null}
        {state.success ? (
          <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
            Sparat.
          </span>
        ) : null}
      </div>
    </form>
  )
}
