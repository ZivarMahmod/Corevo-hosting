'use client'

import { useActionState, useState } from 'react'
import { createTenant, type ActionState } from '@/lib/platform/actions'
import { BILLING_MODELS, BILLING_MODEL_LABELS, type BillingModel } from '@/lib/platform/billing'
import styles from './platform.module.css'

const ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se'

export function CreateTenantForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTenant, {})
  const [model, setModel] = useState<BillingModel>('per_booking')

  return (
    <form action={formAction} className={styles.form}>
      <label className={styles.field}>
        <span>Salongsnamn</span>
        <input name="name" required placeholder="t.ex. Frisör Tre" />
      </label>

      <label className={styles.field}>
        <span>Subdomän</span>
        <input name="slug" required placeholder="frisor3" autoCapitalize="none" spellCheck={false} />
        <span className={styles.hint}>
          Blir <code className={styles.code}>&lt;subdomän&gt;.{ROOT}</code>. a–z, 0–9, bindestreck.
          Reserverade namn (booking, admin, app, www, api …) avvisas.
        </span>
      </label>

      <label className={styles.field}>
        <span>Salongsadmin e-post (valfritt)</span>
        <input name="admin_email" type="email" placeholder="agare@salong.se" autoCapitalize="none" />
        <span className={styles.hint}>Bjuds in som salon_admin. Kräver att e-post/SMTP är konfigurerat.</span>
      </label>

      <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}>
        <span>Prismodell (FLÖDE 2)</span>
        <select
          name="billing_model"
          value={model}
          onChange={(e) => setModel(e.target.value as BillingModel)}
        >
          {BILLING_MODELS.map((m) => (
            <option key={m} value={m}>
              {BILLING_MODEL_LABELS[m]}
            </option>
          ))}
        </select>
      </fieldset>

      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Startavgift (kr)</span>
          <input name="setup_fee" inputMode="decimal" placeholder="0" />
        </label>
        {model === 'per_booking' ? (
          <label className={styles.field}>
            <span>Avgift per bokning (kr)</span>
            <input name="per_booking_fee" inputMode="decimal" placeholder="0" />
          </label>
        ) : (
          <label className={styles.field}>
            <span>Fast månadsavgift (kr)</span>
            <input name="flat_monthly_fee" inputMode="decimal" placeholder="0" />
          </label>
        )}
      </div>

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Skapar…' : 'Skapa salong'}
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
