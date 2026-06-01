'use client'

import { useActionState, useState } from 'react'
import { saveBilling, type ActionState } from '@/lib/platform/actions'
import {
  BILLING_MODELS,
  BILLING_MODEL_LABELS,
  centsToKronorInput,
  type BillingModel,
} from '@/lib/platform/billing'
import styles from './platform.module.css'

export function BillingForm({
  tenantId,
  billingModel,
  setupFeeCents,
  perBookingFeeCents,
  flatMonthlyFeeCents,
}: {
  tenantId: string
  billingModel: string
  setupFeeCents: number
  perBookingFeeCents: number
  flatMonthlyFeeCents: number
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveBilling, {})
  const initial: BillingModel = billingModel === 'flat_monthly' ? 'flat_monthly' : 'per_booking'
  const [model, setModel] = useState<BillingModel>(initial)

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <label className={styles.field}>
        <span>Prismodell</span>
        <select name="billing_model" value={model} onChange={(e) => setModel(e.target.value as BillingModel)}>
          {BILLING_MODELS.map((m) => (
            <option key={m} value={m}>
              {BILLING_MODEL_LABELS[m]}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Startavgift (kr)</span>
          <input name="setup_fee" inputMode="decimal" defaultValue={centsToKronorInput(setupFeeCents)} />
        </label>
        {model === 'per_booking' ? (
          <label className={styles.field}>
            <span>Avgift per bokning (kr)</span>
            <input name="per_booking_fee" inputMode="decimal" defaultValue={centsToKronorInput(perBookingFeeCents)} />
          </label>
        ) : (
          <label className={styles.field}>
            <span>Fast månadsavgift (kr)</span>
            <input name="flat_monthly_fee" inputMode="decimal" defaultValue={centsToKronorInput(flatMonthlyFeeCents)} />
          </label>
        )}
      </div>
      <span className={styles.hint}>
        Faktureringsunderlaget räknas av Corevo manuellt — ingen Stripe-koppling.
      </span>

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara prismodell'}
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
