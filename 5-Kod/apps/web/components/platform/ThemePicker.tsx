'use client'

import { useActionState } from 'react'
import type { CSSProperties } from 'react'
import { setTenantTheme, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

// De sex namngivna storefront-mallarna (STOREFRONT_THEMES) med riktig palett + en rad
// om känslan, så operatören SER vad varje mall är innan hen byter. Färgerna speglar
// [data-theme]-blocken i packages/ui/tokens.css. Ett klick på ett kort = byter direkt
// (setTenantTheme → settings.theme); previewen laddas om via onSaved.
type Theme = { key: string; name: string; desc: string; primary: string; bg: string; fg: string }
const THEMES: Theme[] = [
  { key: 'freshcut', name: 'FreshCut', desc: 'Barbershop · vit & guld, skarp', primary: '#B59775', bg: '#FFFFFF', fg: '#252525' },
  { key: 'salvia', name: 'Salvia', desc: 'Sage · luftig, minimal', primary: '#5E7361', bg: '#F6F4EE', fg: '#232520' },
  { key: 'leander', name: 'Leander', desc: 'Lavendel · romantisk editorial', primary: '#7E6E92', bg: '#FBFAF8', fg: '#2A2630' },
  { key: 'zigge', name: 'Zigge', desc: 'Mörk · djärv barber', primary: '#C8743C', bg: '#14120E', fg: '#F2ECE2' },
  { key: 'linnea', name: 'Linnea', desc: 'Terrakotta · varm skandinavisk', primary: '#B0693F', bg: '#F4EDE1', fg: '#2E2820' },
  { key: 'edit', name: 'Edit', desc: 'Charcoal på ivory · stram', primary: '#3A3733', bg: '#F8F6F1', fg: '#232220' },
]

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
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))', gap: 10 }}>
        {THEMES.map((t) => {
          const active = t.key === current
          return (
            <button
              key={t.key}
              type="submit"
              name="theme"
              value={t.key}
              disabled={pending || active}
              aria-current={active ? 'true' : undefined}
              style={cardStyle(active)}
            >
              {/* mini-sida: bg + primär-bar + två text-linjer i temats färger */}
              <span style={{ ...swatch, background: t.bg }} aria-hidden="true">
                <span style={{ height: 9, background: t.primary, borderRadius: 2 }} />
                <span style={{ height: 5, width: '70%', background: t.fg, opacity: 0.85, borderRadius: 2, marginTop: 7 }} />
                <span style={{ height: 5, width: '45%', background: t.fg, opacity: 0.5, borderRadius: 2, marginTop: 4 }} />
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
                <b style={{ fontSize: 13.5 }}>{t.name}</b>
                {active ? <span style={nowTag}>Nuvarande</span> : null}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--c-ink-3)', marginTop: 2, lineHeight: 1.35 }}>{t.desc}</span>
            </button>
          )
        })}
      </div>
      {pending || state.error || state.success ? (
        <div className={styles.actions} style={{ marginTop: 12 }}>
          {pending ? <span className={styles.feedback}>Byter mall…</span> : null}
          {state.error ? (
            <span className={`${styles.feedback} auth-error`} role="alert">{state.error}</span>
          ) : null}
          {state.success ? (
            <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">{state.success}</span>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

function cardStyle(active: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
    padding: 11,
    borderRadius: 8,
    border: `1.5px solid ${active ? 'var(--c-forest, #1f4636)' : 'var(--c-line, #e2e7de)'}`,
    background: 'var(--c-paper, #fff)',
    color: 'var(--c-ink)',
    font: 'inherit',
    cursor: active ? 'default' : 'pointer',
    boxShadow: active ? '0 0 0 3px color-mix(in srgb, var(--c-forest) 12%, transparent)' : 'none',
  }
}
const swatch: CSSProperties = {
  display: 'block',
  borderRadius: 5,
  border: '1px solid var(--c-line, #e2e7de)',
  padding: 10,
  height: 62,
  overflow: 'hidden',
}
const nowTag: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  color: 'var(--c-forest)',
  background: 'color-mix(in srgb, var(--c-forest) 10%, transparent)',
  padding: '1px 6px',
  borderRadius: 999,
}
