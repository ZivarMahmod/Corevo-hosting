'use client'

import { useActionState, useState } from 'react'
import { setCustomerPrivacy, type ActionState } from '@/lib/admin/actions'
import styles from './admin.module.css'

type Mode = 'full' | 'chosen' | 'initial'

const OPTS: { value: Mode; label: string }[] = [
  { value: 'full', label: 'Fullt namn' },
  { value: 'chosen', label: 'Valt namn' },
  { value: 'initial', label: 'Initial' },
]

/**
 * Owner-side control for the customer's display-name privacy (M6 §4). Writes via
 * setCustomerPrivacy → customers.{name_hidden, display_name}. The same stored
 * fields drive get_customer_contact's display_name everywhere, so this is a TRUE
 * control (no dead toggle): changing it changes how the name renders for everyone.
 */
export function CustomerPrivacyForm({
  customerId,
  nameHidden,
  displayName,
}: {
  customerId: string
  nameHidden: boolean
  displayName: string | null
}) {
  const initialMode: Mode = nameHidden ? 'initial' : displayName ? 'chosen' : 'full'
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState(displayName ?? '')
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setCustomerPrivacy, {})

  return (
    <form action={formAction} className={`${styles.form} ${styles.formStacked}`} style={{ margin: 0 }}>
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="mode" value={mode} />

      <div style={{ display: 'flex', gap: 6, background: 'var(--c-paper-2)', padding: 4, borderRadius: 10 }}>
        {OPTS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setMode(o.value)}
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              fontSize: 12.5,
              fontWeight: 600,
              background: mode === o.value ? 'var(--c-forest)' : 'transparent',
              color: mode === o.value ? '#fff' : 'var(--c-ink-2)',
            }}
            aria-pressed={mode === o.value}
          >
            {o.label}
          </button>
        ))}
      </div>

      {mode === 'chosen' && (
        <label className={styles.field} style={{ marginTop: 12 }}>
          <span>Valt visningsnamn</span>
          <input
            name="display_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="t.ex. förnamn eller smeknamn"
            maxLength={80}
          />
        </label>
      )}

      <div className={styles.actions} style={{ marginTop: 12 }}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara visningsnamn'}
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
