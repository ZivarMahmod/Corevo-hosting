'use client'

import { useActionState } from 'react'
import { saveTenantData, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

/**
 * Google-recensionslänken — flyttad från Drifts OperativeControls till
 * Integrationer (det ÄR en integration). saveTenantData kräver name och
 * nollar review-länken om fältet saknas, därför skickas namnet som hidden.
 */
export function GoogleReviewCard({
  tenantId,
  tenantName,
  googleReviewUrl,
}: {
  tenantId: string
  tenantName: string
  googleReviewUrl: string | null
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveTenantData, {})

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="name" value={tenantName} />
      <label className={styles.field}>
        <span>Google-recensionslänk</span>
        <input
          name="google_review_url"
          type="url"
          defaultValue={googleReviewUrl ?? ''}
          placeholder="https://g.page/r/.../review"
          autoCapitalize="none"
          spellCheck={false}
        />
        <span className={styles.hint}>
          Skickas i recensions-nudgen efter ett klart besök. Tom = avstängd. Delas med
          kundens egen inställning.
        </span>
      </label>
      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara länk'}
        </button>
        {state.error ? (
          <span className={`${styles.feedback} auth-error`} role="alert">
            {state.error}
          </span>
        ) : null}
        {state.success ? (
          <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
            Länken sparad.
          </span>
        ) : null}
      </div>
    </form>
  )
}
