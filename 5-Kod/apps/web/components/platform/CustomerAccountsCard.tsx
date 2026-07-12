'use client'

import { useActionState } from 'react'
import { setTenantCustomerAccounts } from '@/lib/platform/actions'
import type { ActionState } from '@/lib/platform/actions/shared'
import styles from './platform.module.css'

/**
 * goal-62 A2 — KUND-KONTON av/på i kundkortet (Drift-fliken).
 *
 * Reglaget fanns bara i kundens egen admin; superbooking saknade det helt.
 * Två knappar (PÅ / AV) i stället för en checkbox: läget syns utan att man
 * behöver tolka en ruta, och knappen man trycker säger vad som HÄNDER.
 * Funktionen är en enda settings-nyckel — ingen ny modul.
 */
export function CustomerAccountsCard({ tenantId, enabled }: { tenantId: string; enabled: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setTenantCustomerAccounts, {})

  return (
    <form action={formAction} className={styles.domainRow}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="customer_accounts_enabled" value={enabled ? 'false' : 'true'} />

      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
        <div style={{ fontWeight: 600 }}>{enabled ? 'Kund-konton är PÅ' : 'Kund-konton är AV'}</div>
        <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>
          {enabled
            ? 'Inloggning och ”Mitt konto” visas på kundens publika sajt.'
            : 'Ingen inloggning på kundens sajt — bara gästbokning och gästköp.'}
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
          {pending ? 'Sparar…' : enabled ? 'Stäng av' : 'Slå på'}
        </button>
      </div>
    </form>
  )
}
