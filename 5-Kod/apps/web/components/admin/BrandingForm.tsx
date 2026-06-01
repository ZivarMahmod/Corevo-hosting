'use client'

import { useActionState, useEffect, useState, type CSSProperties } from 'react'
import type { TenantBranding } from '@corevo/ui'
import { saveBranding, type ActionState } from '@/lib/admin/actions'
import styles from './admin.module.css'

const FALLBACK = {
  color_primary: '#1f6feb',
  color_bg: '#ffffff',
  color_fg: '#111111',
  // Default = storefront-guldet (--gold / --color-accent). Inget ändras visuellt
  // förrän salongen själv väljer en accentfärg. Håll i synk med packages/ui/tokens.css.
  color_accent: '#f5a623',
}

// Legible text colour for a given accent background — mirrors injectTenantTokens'
// accentForeground() in @corevo/ui (identical luminance threshold + values) so the
// preview's accent CTA matches what the published storefront renders. Kept local
// because @corevo/ui only re-exports injectTenantTokens, not the helper.
function accentFg(hex: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return '#15281f'
  let h = m[1]
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 >= 0.6 ? '#15281f' : '#ffffff'
}

export function BrandingForm({ branding }: { branding: TenantBranding }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveBranding, {})

  // Live-preview state mirrors the form fields so the owner sees the storefront
  // theme update as they pick colours — purely presentational, the save still
  // goes through the form/server action below (these inputs ARE the form fields).
  const [primary, setPrimary] = useState(branding.color_primary || FALLBACK.color_primary)
  const [bg, setBg] = useState(branding.color_bg || FALLBACK.color_bg)
  const [fg, setFg] = useState(branding.color_fg || FALLBACK.color_fg)
  const [accent, setAccent] = useState(branding.color_accent || FALLBACK.color_accent)
  const [font, setFont] = useState(branding.font_body ?? '')
  const [removeLogo, setRemoveLogo] = useState(false)
  const [localLogo, setLocalLogo] = useState<string | null>(null)

  // Preview the file the owner just chose (before upload) via an object URL.
  useEffect(() => {
    return () => {
      if (localLogo) URL.revokeObjectURL(localLogo)
    }
  }, [localLogo])

  // After a successful save the server has the canonical logo URL; drop the
  // local object-URL preview + remove-flag so the persisted state shows through
  // (the page also revalidates, re-feeding `branding`).
  useEffect(() => {
    if (state.success) {
      setLocalLogo((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setRemoveLogo(false)
    }
  }, [state.success])

  const shownLogo = localLogo ?? (removeLogo ? null : branding.logo_url ?? null)

  return (
    <div className={styles.brandGrid}>
      <form action={formAction} className={`${styles.form} ${styles.formStacked}`} style={{ margin: 0 }}>
        <div className={styles.fieldRow}>
          <ColorField
            name="color_primary"
            label="Primärfärg"
            value={primary}
            onChange={setPrimary}
          />
          <ColorField name="color_bg" label="Bakgrund" value={bg} onChange={setBg} />
          <ColorField name="color_fg" label="Text" value={fg} onChange={setFg} />
          <ColorField name="color_accent" label="Accent" value={accent} onChange={setAccent} />
        </div>

        <div className={styles.swatchRow}>
          <Chip label="Primär" hex={primary} />
          <Chip label="Bakgrund" hex={bg} />
          <Chip label="Text" hex={fg} />
          <Chip label="Accent" hex={accent} />
        </div>

        <label className={styles.field}>
          <span>Typsnitt (CSS font-family)</span>
          <input
            name="font_body"
            value={font}
            onChange={(e) => setFont(e.target.value)}
            placeholder="t.ex. Inter, system-ui, sans-serif"
          />
        </label>

        <div className={styles.field}>
          <span>Logotyp</span>
          {branding.logo_url && !localLogo ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={branding.logo_url} alt="Nuvarande logotyp" className={styles.logoPreview} />
              <label className={styles.check}>
                <input
                  type="checkbox"
                  name="remove_logo"
                  value="true"
                  checked={removeLogo}
                  onChange={(e) => setRemoveLogo(e.target.checked)}
                />
                Ta bort logotyp
              </label>
            </span>
          ) : !branding.logo_url && !localLogo ? (
            <span className={styles.muted}>Ingen logotyp uppladdad ännu.</span>
          ) : null}
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0]
              setLocalLogo((prev) => {
                if (prev) URL.revokeObjectURL(prev)
                return f ? URL.createObjectURL(f) : null
              })
              if (f) setRemoveLogo(false)
            }}
          />
          <span className={styles.muted}>PNG/JPG/WEBP/SVG/GIF, max 2 MB.</span>
        </div>

        <div className={styles.actions}>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Sparar…' : 'Spara varumärke'}
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

      <BrandingPreview primary={primary} bg={bg} fg={fg} accent={accent} font={font} logo={shownLogo} />
    </div>
  )
}

/** Mini, self-themed storefront so the owner sees their palette live. */
function BrandingPreview({
  primary,
  bg,
  fg,
  accent,
  font,
  logo,
}: {
  primary: string
  bg: string
  fg: string
  accent: string
  font: string
  logo: string | null
}) {
  const bodyStyle = {
    background: bg,
    color: fg,
    fontFamily: font || undefined,
    ['--prev-fg']: fg,
  } as CSSProperties

  return (
    <div className={styles.preview} aria-label="Förhandsvisning av publik sajt">
      <span className={styles.previewLabel}>Förhandsvisning · publik sajt</span>
      <div className={styles.previewBody} style={bodyStyle}>
        <div className={styles.previewNav}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className={styles.previewLogo} />
          ) : (
            <span className={styles.previewBrand} style={{ color: primary }}>
              Din salong
            </span>
          )}
        </div>
        <div className={styles.previewHero}>
          {/* Eyebrow + price use PRIMARY (forest) to match the live storefront's
              .eyebrow / .menuPrice (WCAG AA: small accent text fails contrast).
              The accent field is demoed by the CTA chip below, which is the
              element that genuinely uses --color-accent on the storefront. */}
          <p className={styles.previewEyebrow} style={{ color: primary }}>
            Välkommen
          </p>
          <h3 className={styles.previewTitle}>Boka din tid online</h3>
          <p className={styles.previewText}>Enkel bokning, dygnet runt — direkt hos din salong.</p>
          {/* Mirrors the storefront's .btn-accent: accent background + auto-picked
              legible foreground, so the Accent field gets a truthful live demo. */}
          <span className={styles.previewCta} style={{ background: accent, color: accentFg(accent) }}>
            Boka tid
          </span>
        </div>
        <div className={styles.previewCard}>
          <div>
            <div className={styles.previewCardName}>Klippning</div>
            <div className={styles.previewCardMeta}>30 min</div>
          </div>
          <div className={styles.previewCardPrice} style={{ color: primary }}>
            450 kr
          </div>
        </div>
      </div>
    </div>
  )
}

function Chip({ label, hex }: { label: string; hex: string }) {
  return (
    <span className={styles.swatchChip}>
      <span className={styles.swatchDot} style={{ background: hex }} />
      <span>
        {label} <span className={styles.code}>{hex}</span>
      </span>
    </span>
  )
}

function ColorField({
  name,
  label,
  value,
  onChange,
}: {
  name: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className={styles.field} style={{ flex: '1 1 6rem' }}>
      <span>{label}</span>
      <input type="color" name={name} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
