'use client'

import { useActionState, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { setTenantTheme, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

// De sex namngivna storefront-mallarna med riktig palett + en rad om känslan, så
// operatören SER vad varje mall är. Klick på ett kort = FÖRHANDSVISAR i previewen (ingen
// spar); en separat Publicera-knapp lägger mallen live (setTenantTheme). Färgerna speglar
// [data-theme]-blocken i packages/ui/tokens.css.
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
  onPreview,
  onPublished,
}: {
  tenantId: string
  current: string
  /** Förhandsvisa en mall i previewen (ingen spar). */
  onPreview?: (theme: string) => void
  /** Efter lyckad publicering (mallen ligger nu live). */
  onPublished?: () => void
}) {
  const [selected, setSelected] = useState(current)
  // När den SPARADE mallen ändras (efter publicering + revalidate) → synka valet.
  useEffect(() => setSelected(current), [current])

  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await setTenantTheme(prev, fd)
    if (res.success) onPublished?.()
    return res
  }, {})

  const previewing = selected !== current
  const selName = THEMES.find((t) => t.key === selected)?.name ?? selected

  return (
    <form action={formAction}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="theme" value={selected} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))', gap: 10 }}>
        {THEMES.map((t) => {
          const isCurrent = t.key === current
          const isSel = t.key === selected
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setSelected(t.key)
                onPreview?.(t.key)
              }}
              aria-pressed={isSel}
              style={cardStyle(isSel)}
            >
              <span style={{ ...swatch, background: t.bg }} aria-hidden="true">
                <span style={{ height: 9, background: t.primary, borderRadius: 2 }} />
                <span style={{ height: 5, width: '70%', background: t.fg, opacity: 0.85, borderRadius: 2, marginTop: 7 }} />
                <span style={{ height: 5, width: '45%', background: t.fg, opacity: 0.5, borderRadius: 2, marginTop: 4 }} />
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13.5 }}>{t.name}</b>
                {isCurrent ? <span style={tag('live')}>Nuvarande</span> : null}
                {isSel && !isCurrent ? <span style={tag('preview')}>Förhandsvisar</span> : null}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--c-ink-3)', marginTop: 2, lineHeight: 1.35 }}>{t.desc}</span>
            </button>
          )
        })}
      </div>

      {previewing ? (
        <div className={styles.dirtyRow} style={{ marginTop: 12, flexWrap: 'wrap' }} role="status">
          <span className={styles.dirtyDot} aria-hidden="true" />
          Förhandsvisar <strong>{selName}</strong> — ännu ej live.
          <span style={{ display: 'inline-flex', gap: 8, marginLeft: 'auto' }}>
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? 'Publicerar…' : `Publicera ${selName}`}
            </button>
            <button
              type="button"
              className={styles.btn}
              disabled={pending}
              onClick={() => {
                setSelected(current)
                onPreview?.(current)
              }}
            >
              Avbryt
            </button>
          </span>
        </div>
      ) : null}

      {state.error ? (
        <div className={styles.actions} style={{ marginTop: 10 }}>
          <span className={`${styles.feedback} auth-error`} role="alert">{state.error}</span>
        </div>
      ) : null}
      {state.success ? (
        <div className={styles.actions} style={{ marginTop: 10 }}>
          <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">{state.success}</span>
        </div>
      ) : null}
    </form>
  )
}

function cardStyle(selected: boolean): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
    padding: 11,
    borderRadius: 8,
    border: `1.5px solid ${selected ? 'var(--c-forest, #1f4636)' : 'var(--c-line, #e2e7de)'}`,
    background: 'var(--c-paper, #fff)',
    color: 'var(--c-ink)',
    font: 'inherit',
    cursor: 'pointer',
    boxShadow: selected ? '0 0 0 3px color-mix(in srgb, var(--c-forest) 12%, transparent)' : 'none',
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
function tag(kind: 'live' | 'preview'): CSSProperties {
  const live = kind === 'live'
  return {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: live ? 'var(--c-forest)' : 'var(--c-warning, #a37d3c)',
    background: live
      ? 'color-mix(in srgb, var(--c-forest) 10%, transparent)'
      : 'color-mix(in srgb, var(--c-warning, #a37d3c) 14%, transparent)',
    padding: '1px 6px',
    borderRadius: 999,
  }
}
