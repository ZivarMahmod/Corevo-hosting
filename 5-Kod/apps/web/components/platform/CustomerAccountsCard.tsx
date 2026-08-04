'use client'

import { useActionState } from 'react'
import { setTenantCustomerPortalMode } from '@/lib/platform/actions/data'
import type { CustomerPortalMode } from '@/lib/customer-portal/mode'
import type { ActionState } from '@/lib/platform/actions/shared'
import styles from './platform.module.css'

/** Selects the tenant's one canonical customer-portal mode. */
export function CustomerAccountsCard({
  tenantId,
  mode,
}: {
  tenantId: string
  mode: CustomerPortalMode | null
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setTenantCustomerPortalMode, {})

  return (
    <form action={formAction} className={styles.domainRow}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
        <label htmlFor={`customer-portal-mode-${tenantId}`} style={{ fontWeight: 600 }}>
          Kundportal
        </label>
        <select
          id={`customer-portal-mode-${tenantId}`}
          name="customer_portal_mode"
          defaultValue={mode ?? 'off'}
          disabled={pending}
        >
          <option value="off">Av — endast gäst</option>
          <option value="legacy_account">Kundkonto med lösenord</option>
          <option value="passwordless_tenant">Lösenordsfri portal</option>
          {mode === 'global_account' ? (
            <option value="global_account" disabled>Globalt konto (kan inte aktiveras i v1)</option>
          ) : null}
        </select>
        <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>
          Välj exakt en väg. Byte från lösenordsfri portal återkallar dess aktiva länkar och sessioner.
        </div>
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

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara läge'}
        </button>
      </div>
    </form>
  )
}
