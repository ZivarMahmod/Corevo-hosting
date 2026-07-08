'use client'

import { useActionState } from 'react'
import { setTenantTheme, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

// The six named storefront themes (STOREFRONT_THEMES) with friendly labels. Changing
// the mall writes settings.theme; the preview reloads via onSaved so the new layout shows.
const THEMES = [
  { key: 'freshcut', label: 'FreshCut' },
  { key: 'salvia', label: 'Salvia' },
  { key: 'leander', label: 'Leander' },
  { key: 'zigge', label: 'Zigge' },
  { key: 'linnea', label: 'Linnea' },
  { key: 'edit', label: 'Edit' },
] as const

export function ThemePicker({
  tenantId,
  current,
  onSaved,
}: {
  tenantId: string
  current: string
  onSaved?: () => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await setTenantTheme(prev, fd)
    if (res.success) onSaved?.()
    return res
  }, {})

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {THEMES.map((t) => (
          <label
            key={t.key}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '8px 12px',
              borderRadius: 9,
              border: '1px solid var(--c-line, #e5e2da)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <input type="radio" name="theme" value={t.key} defaultChecked={t.key === current} />
            {t.label}
          </label>
        ))}
      </div>
      <div className={styles.actions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? 'Byter…' : 'Byt mall'}
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
