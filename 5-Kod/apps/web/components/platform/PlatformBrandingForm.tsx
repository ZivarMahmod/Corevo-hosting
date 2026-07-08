'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { injectTenantTokens, type TenantBranding } from '@corevo/ui'
import { savePlatformBranding, type ActionState } from '@/lib/platform/actions'
import { themePalette } from '@/lib/platform/theme-palettes'
import styles from './platform.module.css'

/**
 * Varumärke — v4-UI (Zivar: "jag gillar inte UI:t — gör snyggare och mer lättvalt").
 * Mental modell oförändrad från v3: MALLEN äger färgerna; operatören avviker bara
 * där hen vill, en avvikelse är tydligt markerad och har en egen återställ-knapp,
 * tom override sparas som null → mallens CSS gäller. Nytt: sektioner (Färger /
 * Typsnitt / Logotyp) som RADER i stället för trånga kort — swatch, namn, vad den
 * styr, hex och knappar på EN linje per färg.
 */
const COLORS: { name: 'color_primary' | 'color_bg' | 'color_fg' | 'color_accent'; label: string; what: string }[] = [
  { name: 'color_primary', label: 'Primärfärg', what: 'Rubriker, länkar, mörka sektioner' },
  { name: 'color_accent', label: 'Knappfärg', what: 'Alla knappar, t.ex. "Boka tid"' },
  { name: 'color_bg', label: 'Bakgrund', what: 'Hela sidans bakgrund' },
  { name: 'color_fg', label: 'Textfärg', what: 'Brödtext & rubriktext' },
]

// Valbara typsnitt (dropdown). Bara stackar som FAKTISKT finns på sidan: de tre
// next/font-laddade familjerna + robusta systemstackar.
const BODY_FONTS: { label: string; value: string }[] = [
  { label: 'Mallens standard', value: '' },
  { label: 'Inter (modern sans)', value: "var(--font-inter), 'Inter', sans-serif" },
  { label: 'Source Sans (mjuk sans)', value: "var(--font-source-sans), 'Source Sans 3', sans-serif" },
  { label: 'Playfair Display (serif)', value: "var(--font-playfair), 'Playfair Display', Georgia, serif" },
  { label: 'Georgia (klassisk serif)', value: "Georgia, 'Times New Roman', serif" },
  { label: 'System (enhetens)', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Arial / Helvetica', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
]
const DISPLAY_FONTS: { label: string; value: string }[] = [
  { label: 'Mallens standard', value: '' },
  { label: 'Playfair Display (elegant serif)', value: "var(--font-playfair), 'Playfair Display', Georgia, serif" },
  { label: 'Georgia (klassisk serif)', value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: 'Inter (modern sans)', value: "var(--font-inter), 'Inter', sans-serif" },
  { label: 'Source Sans (mjuk sans)', value: "var(--font-source-sans), 'Source Sans 3', sans-serif" },
  { label: 'System (enhetens)', value: 'system-ui, -apple-system, sans-serif' },
]

// "Visa var"-pulsen: vilken CSS-var respektive färgrad styr i previewen.
const FLASH_VAR: Record<string, string> = {
  color_primary: '--color-primary',
  color_bg: '--color-bg',
  color_fg: '--color-fg',
  color_accent: '--color-accent',
}

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
      font_display: branding.font_display ?? '',
    }),
    [branding.color_primary, branding.color_bg, branding.color_fg, branding.color_accent, branding.font_body, branding.font_display],
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
        font_display: v.font_display || undefined,
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
  // "Visa var" — pulsa färgens yta i previewen med en skrikig markörfärg i ~1 s och
  // återställ, så operatören SER exakt vad t.ex. "Primärfärg" styr utan att gissa.
  const flash = (name: string) => {
    const v = FLASH_VAR[name]
    if (!v || !onLiveTokens) return
    const base = injectTenantTokens({
      color_primary: vals.color_primary || undefined,
      color_bg: vals.color_bg || undefined,
      color_fg: vals.color_fg || undefined,
      color_accent: vals.color_accent || undefined,
      font_body: vals.font_body || undefined,
      font_display: vals.font_display || undefined,
    } as TenantBranding)
    onLiveTokens({ ...base, [v]: '#FF2FD6', ...(v === '--color-accent' ? { '--color-accent-fg': '#ffffff' } : {}) })
    window.setTimeout(() => push(vals), 1100)
  }

  const changed = [
    ...COLORS.filter((c) => vals[c.name] !== initial[c.name]).map((c) =>
      vals[c.name] ? c.label : `${c.label} → mallens standard`,
    ),
    ...(vals.font_body !== initial.font_body ? ['Brödtypsnitt'] : []),
    ...(vals.font_display !== initial.font_display ? ['Rubriktypsnitt'] : []),
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

      {/* ── Färger ── */}
      <div style={secHead}>
        <span style={secTitle}>Färger</span>
        <span style={secSub}>
          Mallen <strong>{pal.name}</strong> sätter standarden — ändra bara det du vill avvika från
        </span>
      </div>
      <div style={rows}>
        {COLORS.map((c, i) => {
          const override = vals[c.name] ?? ''
          const def = defaults[c.name] ?? '#000000'
          const effective = override || def
          const unsaved = vals[c.name] !== initial[c.name]
          return (
            <div key={c.name} style={{ ...row, borderTop: i === 0 ? 'none' : '1px solid var(--c-line, #e2e7de)' }}>
              <label style={{ cursor: 'pointer', flex: 'none', display: 'flex' }}>
                <input
                  type="color"
                  value={effective}
                  onChange={(e) => set(c.name, e.target.value)}
                  style={swatch}
                  aria-label={`${c.label} — ${c.what}`}
                />
              </label>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13 }}>{c.label}</b>
                  {override ? <span style={chipOwn}>Egen färg</span> : <span style={chipDef}>Mallens</span>}
                  {unsaved ? <span style={dot} title="Osparad ändring" aria-label="osparad ändring" /> : null}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--c-ink-3)', marginTop: 1 }}>{c.what}</div>
              </div>
              <span style={hexCss}>{effective.toUpperCase()}</span>
              <button type="button" style={miniBtn} onClick={() => flash(c.name)} title="Blinkar den här färgens yta i previewen så du ser exakt vad den styr">
                Visa var
              </button>
              <button
                type="button"
                style={{ ...miniBtn, visibility: override ? 'visible' : 'hidden' }}
                onClick={() => set(c.name, '')}
                title={`Släpp den egna färgen — mallens ${def.toUpperCase()} gäller igen`}
              >
                ↩ Mallens
              </button>
            </div>
          )
        })}
      </div>
      {anyOverride ? (
        <button type="button" className={styles.btn} style={{ alignSelf: 'flex-start', marginTop: -4 }} onClick={clearAllColors}>
          Använd mallens färger för allt
        </button>
      ) : null}

      {/* ── Typsnitt ── */}
      <div style={secHead}>
        <span style={secTitle}>Typsnitt</span>
        <span style={secSub}>Byts direkt i previewen medan du väljer</span>
      </div>
      <div style={fontGrid}>
        <label className={styles.field}>
          <span>Rubriker</span>
          <select name="font_display" value={vals.font_display} onChange={(e) => set('font_display', e.target.value)}>
            {DISPLAY_FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
            {vals.font_display && !DISPLAY_FONTS.some((f) => f.value === vals.font_display) ? (
              <option value={vals.font_display}>Egen (sparad): {vals.font_display.slice(0, 40)}</option>
            ) : null}
          </select>
          <span className={styles.hint}>Hero &amp; sektionsrubriker.</span>
        </label>
        <label className={styles.field}>
          <span>Brödtext</span>
          <select name="font_body" value={vals.font_body} onChange={(e) => set('font_body', e.target.value)}>
            {BODY_FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
            {vals.font_body && !BODY_FONTS.some((f) => f.value === vals.font_body) ? (
              <option value={vals.font_body}>Egen (sparad): {vals.font_body.slice(0, 40)}</option>
            ) : null}
          </select>
          <span className={styles.hint}>All löpande text.</span>
        </label>
      </div>

      {/* ── Logotyp ── */}
      <div style={secHead}>
        <span style={secTitle}>Logotyp</span>
        <span style={secSub}>Visas i sidhuvudet — utan logotyp visas salongsnamnet</span>
      </div>
      <div className={styles.field}>
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
          <span className={styles.muted}>Ingen logotyp uppladdad — salongsnamnet visas i sidhuvudet.</span>
        )}
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" />
        <span className={styles.hint}>PNG/JPG/WEBP/SVG/GIF.</span>
      </div>

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

const secHead: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 2,
}
const secTitle: CSSProperties = {
  fontSize: 11,
  fontWeight: 750,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: 'var(--c-ink-2)',
}
const secSub: CSSProperties = { fontSize: 11.5, color: 'var(--c-ink-3)' }
const rows: CSSProperties = {
  border: '1px solid var(--c-line, #e2e7de)',
  borderRadius: 9,
  background: 'var(--c-paper, #fff)',
  overflow: 'hidden',
}
const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '9px 12px',
}
const fontGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10,
}
const swatch: CSSProperties = {
  width: 40,
  height: 40,
  padding: 0,
  border: '2px solid var(--c-line-strong, #d3dacd)',
  borderRadius: 999,
  background: 'none',
  cursor: 'pointer',
  flex: 'none',
}
const hexCss: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11.5,
  color: 'var(--c-ink-2)',
  letterSpacing: '0.02em',
  flex: 'none',
}
const chipOwn: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.04em',
  padding: '1.5px 7px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--c-gold-600, #a37d3c) 14%, transparent)',
  color: 'var(--c-gold-600, #a37d3c)',
}
const chipDef: CSSProperties = {
  fontSize: 10,
  fontWeight: 650,
  letterSpacing: '0.04em',
  padding: '1.5px 7px',
  borderRadius: 999,
  background: 'var(--c-paper-2, #f4f6f2)',
  color: 'var(--c-ink-3)',
  border: '1px solid var(--c-line, #e2e7de)',
}
const dot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: 'var(--c-warning, #a37d3c)',
  flex: 'none',
}
const miniBtn: CSSProperties = {
  border: '1px solid var(--c-line-strong, #d3dacd)',
  background: 'var(--c-paper-2, #f4f6f2)',
  color: 'var(--c-ink-2)',
  borderRadius: 6,
  padding: '4px 9px',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  flex: 'none',
  whiteSpace: 'nowrap',
}
