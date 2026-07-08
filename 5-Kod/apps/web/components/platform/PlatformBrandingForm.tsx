'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { injectTenantTokens, type TenantBranding } from '@corevo/ui'
import { savePlatformBranding, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

// Snygga, salong-neutrala standardfärger (visas när kunden inte satt en egen) — varm
// charcoal/mässing istället för generisk blå/svart.
const NICE = {
  color_primary: '#33302B',
  color_bg: '#FAF8F4',
  color_fg: '#2A2622',
  color_accent: '#B08D57',
} as const

// Varje färg + VAD den styr på den publika sidan, så operatören förstår innan hen ändrar.
const COLORS: { name: keyof typeof NICE; label: string; what: string }[] = [
  { name: 'color_primary', label: 'Primärfärg', what: 'Rubriker, länkar & accenter' },
  { name: 'color_bg', label: 'Bakgrund', what: 'Sidans bakgrundsfärg' },
  { name: 'color_fg', label: 'Text', what: 'Brödtext' },
  { name: 'color_accent', label: 'Accent', what: 'Knappar & "Boka tid"' },
]

type Vals = Record<string, string>

export function PlatformBrandingForm({
  tenantId,
  branding,
  onLiveTokens,
}: {
  tenantId: string
  branding: TenantBranding
  /** Live-preview: fired with the CSS-var patch on every edit so the parent can push it
   *  into the preview iframe BEFORE save. */
  onLiveTokens?: (tokens: Record<string, string>) => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(savePlatformBranding, {})

  // The SAVED baseline (falls back to the nice defaults when the tenant set nothing).
  // Keyed on the actual values, NOT the branding object identity, so an unrelated parent
  // re-render never wipes in-progress edits — only a real save (new saved values) resets.
  const initial: Vals = useMemo(
    () => ({
      color_primary: branding.color_primary || NICE.color_primary,
      color_bg: branding.color_bg || NICE.color_bg,
      color_fg: branding.color_fg || NICE.color_fg,
      color_accent: branding.color_accent || NICE.color_accent,
      font_body: branding.font_body ?? '',
    }),
    [branding.color_primary, branding.color_bg, branding.color_fg, branding.color_accent, branding.font_body],
  )

  const [vals, setVals] = useState<Vals>(initial)
  useEffect(() => setVals(initial), [initial]) // save → new baseline → reset the form

  const push = (v: Vals) =>
    onLiveTokens?.(
      injectTenantTokens({
        color_primary: v.color_primary,
        color_bg: v.color_bg,
        color_fg: v.color_fg,
        color_accent: v.color_accent,
        font_body: v.font_body || undefined,
      } as TenantBranding),
    )
  const set = (name: string, value: string) => {
    const next = { ...vals, [name]: value }
    setVals(next)
    push(next)
  }
  const revert = () => {
    setVals(initial)
    push(initial)
  }

  const changed = [
    ...COLORS.filter((c) => vals[c.name] !== initial[c.name]).map((c) => c.label),
    ...(vals.font_body !== initial.font_body ? ['Typsnitt'] : []),
  ]
  const dirty = changed.length > 0

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <div style={grid}>
        {COLORS.map((c) => {
          const ch = vals[c.name] !== initial[c.name]
          return (
            <div key={c.name} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <b style={{ fontSize: 13 }}>{c.label}</b>
                {ch ? <span style={dot} title="Ändrat" aria-label="ändrat" /> : null}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--c-ink-3)', lineHeight: 1.3 }}>{c.what}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 7, cursor: 'pointer' }}>
                <input
                  type="color"
                  name={c.name}
                  value={vals[c.name]}
                  onChange={(e) => set(c.name, e.target.value)}
                  style={swatch}
                  aria-label={`${c.label} — ${c.what}`}
                />
                <span style={hex}>{(vals[c.name] || '').toUpperCase()}</span>
              </label>
            </div>
          )
        })}
      </div>

      <label className={styles.field}>
        <span>Typsnitt</span>
        <input
          name="font_body"
          value={vals.font_body}
          onChange={(e) => set('font_body', e.target.value)}
          placeholder="t.ex. Inter, system-ui, sans-serif"
        />
        <span className={styles.hint}>Teckensnitt för hela sidan (CSS font-family). Tomt = temats standard.</span>
      </label>

      <div className={styles.field}>
        <span>Logotyp</span>
        {branding.logo_url ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={branding.logo_url} alt="Nuvarande logotyp" className={styles.logoPreview} />
            <label className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" name="remove_logo" value="true" />
              Ta bort logotyp
            </label>
          </span>
        ) : (
          <span className={styles.muted}>Ingen logotyp uppladdad.</span>
        )}
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" />
        <span className={styles.hint}>Visas i sidhuvudet. PNG/JPG/WEBP/SVG/GIF, max 2 MB.</span>
      </div>

      <p className={styles.hint} style={{ margin: 0 }}>
        Ändringar syns direkt i previewen till höger — de går <strong>inte live</strong> förrän du sparar.
      </p>

      {dirty ? (
        <div className={styles.dirtyRow} role="status">
          <span className={styles.dirtyDot} aria-hidden="true" />
          Osparade ändringar: <strong>{changed.join(', ')}</strong>
        </div>
      ) : null}

      <div className={styles.actions}>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Sparar…' : 'Spara & lägg live'}
        </button>
        <button type="button" className={styles.btn} onClick={revert} disabled={pending || !dirty}>
          Återställ
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

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 10,
}
const card: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: 11,
  borderRadius: 7,
  border: '1px solid var(--c-line, #e2e7de)',
  background: 'var(--c-paper, #fff)',
}
const swatch: CSSProperties = {
  width: 42,
  height: 30,
  padding: 0,
  border: '1px solid var(--c-line, #e2e7de)',
  borderRadius: 5,
  background: 'none',
  cursor: 'pointer',
  flex: 'none',
}
const hex: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  color: 'var(--c-ink-2)',
  letterSpacing: '0.02em',
}
const dot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: 'var(--c-warning, #a37d3c)',
  flex: 'none',
}
