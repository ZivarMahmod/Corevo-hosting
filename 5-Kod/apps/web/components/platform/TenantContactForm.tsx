'use client'

import { useActionState } from 'react'
import { saveTenantContact, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Publik kontakt (e-post + telefon → settings.contact) + adress (primär location) för
 * en vald salong — redigeras från super-admin, syns i storefrontens footer. Öppettider
 * redigeras INTE här; de härleds ur personalens veckoscheman (Personal-fliken).
 */
export function TenantContactForm({
  tenantId,
  email,
  phone,
  address,
}: {
  tenantId: string
  email: string | null
  phone: string | null
  address: string | null
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveTenantContact, {})

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>E-post</span>
          <input name="email" type="email" defaultValue={email ?? ''} placeholder="salong@exempel.se" />
        </label>
        <label className={styles.field}>
          <span>Telefon</span>
          <input name="phone" defaultValue={phone ?? ''} placeholder="013-12 34 56" />
        </label>
      </div>

      <label className={styles.field}>
        <span>Adress</span>
        <input name="address" defaultValue={address ?? ''} placeholder="Storgatan 1, 582 22 Linköping" />
      </label>

      <div className={styles.actions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? 'Sparar…' : 'Spara kontakt'}
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
