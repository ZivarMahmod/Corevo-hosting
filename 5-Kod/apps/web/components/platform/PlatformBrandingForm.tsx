'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { injectTenantTokens, type TenantBranding } from '@corevo/ui'
import { savePlatformBranding, type ActionState } from '@/lib/platform/actions'
import { themePalette } from '@/lib/platform/theme-palettes'
import styles from './platform.module.css'

/**
 * Varumärke — v3-modellen (Zivar: "jag får inte ordning på vilken som är till vad").
 * Mental modell: MALLEN äger färgerna. Varje färg visar mallens standard; operatören
 * ändrar BARA det hen vill avvika från — en ändring blir en tydligt markerad "egen
 * färg" med en egen "Använd mallens"-ångra-knapp. En tom override sparas som null →
 * publika sidan faller tillbaka på mallens CSS (tokens.css). Så här kan aldrig fyra
 * lösa testfärger bli "kaos" utan att det SYNS att alla fyra är overrides.
 */
const COLORS: { name: 'color_primary' | 'color_bg' | 'color_fg' | 'color_accent'; label: string; what: string }[] = [
  { name: 'color_primary', label: 'Primärfärg', what: 'Rubriker, länkar & små detaljer' },
  { name: 'color_accent', label: 'Knappfärg', what: 'Alla knappar, t.ex. "Boka tid"' },
  { name: 'color_bg', label: 'Bakgrund', what: 'Hela sidans bakgrund' },
  { name: 'color_fg', label: 'Textfärg', what: 'Brödtext & rubriktext' },
]

/** '' = ingen egen färg → mallens standard gäller. */
type Vals = Record<string, string>

export function PlatformBrandingForm({
  tenantId,
  branding,
  themeKey,
  onLiveTokens,
}: {
  tenantId: string
  branding: TenantBranding
  /** Tenantens SPARADE mall — dess palett är standardfärgerna formuläret utgår från. */
  themeKey: string
  /** Live-preview: fired with the CSS-var patch on every edit so the parent can push it
   *  into the preview iframe BEFORE save. */
  onLiveTokens?: (tokens: Record<string, string>) => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(savePlatformBranding, {})
  const pal = themePalette(themeKey)
  const defaults: Record<string, string> = {
    color_primary: pal.primary,
    color_bg: pal.bg,
    color_fg: pal.fg,
    color_accent: pal.accent,
  }

  // SPARADE overrides ('' = ingen). Keyed on the actual values, NOT the branding object
  // identity, so an unrelated parent re-render never wipes in-progress edits.
  const initial: Vals = useMemo(
    () => ({
      color_primary: branding.color_primary ?? '',
      color_bg: branding.color_bg ?? '',
      color_fg: branding.color_fg ?? '',
      color_accent: branding.color_accent ?? '',
      font_body: branding.font_body ?? '',
    }),
    [branding.color_primary, branding.color_bg, branding.color_fg, branding.color_accent, branding.font_body],
  )

  const [vals, setVals] = useState<Vals>(initial)
  useEffect(() => setVals(initial), [initial]) // save → new baseline → reset the form

  // Push ONLY the overrides into the preview — cleared fields fall back to the
  // mall's own CSS in the iframe (SidaPreviewBridge removes absent vars).
  const push = (v: Vals) =>
    onLiveTokens?.(
      injectTenantTokens({
        color_primary: v.color_primary || undefined,
        color_bg: v.color_bg || undefined,
        color_fg: v.color_fg || undefined,
        color_accent: v.color_accent || undefined,
        font_body: v.font_body || undefined,
      } as TenantBranding),
    )
  const set = (name: string, value: string) => {
    const next = { ...vals, [name]: value }
    setVals(next)
    push(next)
  }
  const clearAllColors = () => {
    const next = { ...vals, color_primary: '', color_bg: '', color_fg: '', color_accent: '' }
    setVals(next)
    push(next)
  }
  const revert = () => {
    setVals(initial)
    push(initial)
  }

  const changed = [
    ...COLORS.filter((c) => vals[c.name] !== initial[c.name]).map((c) =>
      vals[c.name] ? c.label : `${c.label} → mallens standard`,
    ),
    ...(vals.font_body !== initial.font_body ? ['Typsnitt'] : []),
  ]
  const dirty = changed.length > 0
  const anyOverride = COLORS.some((c) => vals[c.name])

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      {/* Overrides skickas via hidden fields ('' = rensa → null i DB). Färg-pickern
          nedan är bara UI — den kan inte vara tom, så den bär inget name. */}
      {COLORS.map((c) => (
        <input key={c.name} type="hidden" name={c.name} value={vals[c.name]} />
      ))}

      <p className={styles.hint} style={{ margin: 0 }}>
        Färgerna kommer från mallen <strong>{pal.name}</strong>. Ändra bara det du vill
        avvika från — allt annat följer mallen automatiskt.
      </p>

      <div style={grid}>
        {COLORS.map((c) => {
          const override = vals[c.name] ?? ''
          const def = defaults[c.name] ?? '#000000'
          const effective = override || def
          const ch = vals[c.name] !== initial[c.name]
          return (
            <div key={c.name} style={card} data-own={override ? 'true' : undefined}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <b style={{ fontSize: 13 }}>{c.label}</b>
                {ch ? <span style={dot} title="Osparad ändring" aria-label="osparad ändring" /> : null}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--c-ink-3)', lineHeight: 1.3 }}>{c.what}</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 7, cursor: 'pointer' }}>
                <input
                  type="color"
                  value={effective}
                  onChange={(e) => set(c.name, e.target.value)}
                  style={swatch}
                  aria-label={`${c.label} — ${c.what}`}
                />
                <span style={hexCss}>{effective.toUpperCase()}</span>
              </label>
              {override ? (
                <button type="button" style={miniBtn} onClick={() => set(c.name, '')}>
                  ↩ Använd mallens ({def.toUpperCase()})
                </button>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--c-ink-3)', marginTop: 5 }}>
                  Mallens standard
                </span>
              )}
            </div>
          )
        })}
      </div>

      {anyOverride ? (
        <button type="button" className={styles.btn} style={{ alignSelf: 'flex-start' }} onClick={clearAllColors}>
          Använd mallens färger för allt
        </button>
      ) : null}

      <label className={styles.field}>
        <span>Typsnitt</span>
        <input
          name="font_body"
          value={vals.font_body}
          onChange={(e) => set('font_body', e.target.value)}
          placeholder="t.ex. Inter, system-ui, sans-serif"
        />
        <span className={styles.hint}>Teckensnitt för sidans brödtext. Tomt = mallens standard.</span>
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
          Ångra ändringar
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))',
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
const hexCss: CSSProperties = {
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
const miniBtn: CSSProperties = {
  marginTop: 6,
  alignSelf: 'flex-start',
  border: '1px solid var(--c-line-strong, #d3dacd)',
  background: 'var(--c-paper-2, #f4f6f2)',
  color: 'var(--c-ink-2)',
  borderRadius: 5,
  padding: '3px 8px',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
}
