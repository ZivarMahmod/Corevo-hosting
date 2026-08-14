'use client'

import { useActionState } from 'react'
import { createBillingDraft } from '@/lib/platform/actions/billing'
import type { ActionState } from '@/lib/platform/actions/shared'
import { isRetryableBillingDraft } from '@/lib/platform/billing'
import styles from './platform.module.css'

export function BillingDraftButton({
  tenantId,
  year,
  month,
  disabled,
  existingStatus,
  errorCode,
}: {
  tenantId: string
  year: number
  month: number
  disabled: boolean
  existingStatus: string | null
  errorCode: string | null
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createBillingDraft, {})
  const retryableDraft = isRetryableBillingDraft(existingStatus, errorCode)
  const locked = disabled || pending || (Boolean(existingStatus) && !retryableDraft)

  return (
    <form action={action} style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <button type="submit" className={styles.btn} disabled={locked}>
        {pending
          ? 'Skapar…'
          : retryableDraft
            ? 'Försök igen'
            : existingStatus
              ? `Stripe: ${existingStatus}`
              : 'Skapa utkast'}
      </button>
      {state.error ? <span className="auth-error" role="alert">{state.error}</span> : null}
      {state.success ? <span className={styles.feedbackOk} role="status">{state.success}</span> : null}
    </form>
  )
}
