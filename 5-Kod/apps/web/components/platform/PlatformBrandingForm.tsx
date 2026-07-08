'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { injectTenantTokens, type TenantBranding } from '@corevo/ui'
import { savePlatformBranding, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

// The colour/font fields + their SAVED value (what the input shows on load). Used both
// to seed the inputs and to detect what the operator changed vs. the live-saved state.
const C_FALLBACK: Record<string, string> = {
  color_primary: '#1f6feb',
  color_bg: '#ffffff',
  color_fg: '#111111',
  color_accent: '#1f6feb',
}
const FIELDS: { name: string; label: string }[] = [
  { name: 'color_primary', label: 'Primärfärg' },
  { name: 'color_bg', label: 'Bakgrund' },
  { name: 'color_fg', label: 'Text' },
  { name: 'color_accent', label: 'Accent' },
  { name: 'font_body', label: 'Typsnitt' },
]

export function PlatformBrandingForm({
  tenantId,
  branding,
  onLiveTokens,
}: {
  tenantId: string
  branding: TenantBranding
  /** Live-preview hook: fired on every colour/font edit with the CSS-var patch, so a
   *  parent can push it into the preview iframe BEFORE the form is saved. */
  onLiveTokens?: (tokens: Record<string, string>) => void
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(savePlatformBranding, {})
  const formRef = useRef<HTMLFormElement>(null)
  // Which fields differ from the saved value (drives the "osparade ändringar"-rad).
  const [changed, setChanged] = useState<string[]>([])

  // The saved value each input holds on load (colour falls back to its default swatch).
  const savedOf = (name: string): string => {
    if (name === 'font_body') return branding.font_body ?? ''
    return (branding as Record<string, string | null | undefined>)[name] || C_FALLBACK[name] || ''
  }

  // Push the current field values into the preview (reuses the storefront's own token
  // mapper → preview mirrors the saved result 1:1) AND recompute what changed.
  function sync(form: HTMLFormElement) {
    const g = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? ''
    onLiveTokens?.(
      injectTenantTokens({
        color_primary: g('color_primary') || undefined,
        color_bg: g('color_bg') || undefined,
        color_fg: g('color_fg') || undefined,
        color_accent: g('color_accent') || undefined,
        font_body: g('font_body') || undefined,
      } as TenantBranding),
    )
    setChanged(FIELDS.filter((f) => g(f.name) !== savedOf(f.name)).map((f) => f.label))
  }

  // On a successful save the current values ARE the saved values → nothing pending.
  useEffect(() => {
    if (state.success) setChanged([])
  }, [state])

  // Revert to the saved state: reset the inputs to their defaults, re-push the saved
  // tokens so the preview reverts too, and clear the changed-list.
  function revert() {
    const form = formRef.current
    if (!form) return
    form.reset()
    sync(form)
  }

  const dirty = changed.length > 0

  return (
    <form ref={formRef} action={formAction} className={styles.form} onInput={(e) => sync(e.currentTarget)}>
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className={styles.fieldRow}>
        <ColorField name="color_primary" label="Primärfärg" value={branding.color_primary} fallback="#1f6feb" />
        <ColorField name="color_bg" label="Bakgrund" value={branding.color_bg} fallback="#ffffff" />
        <ColorField name="color_fg" label="Text" value={branding.color_fg} fallback="#111111" />
        <ColorField name="color_accent" label="Accent (knappar)" value={branding.color_accent} fallback="#1f6feb" />
      </div>
      <p className={styles.hint} style={{ marginTop: -2 }}>
        Ändringar syns direkt i previewen till höger — de går <strong>inte live</strong> förrän du sparar.
      </p>

      <label className={styles.field}>
        <span>Typsnitt (CSS font-family)</span>
        <input name="font_body" defaultValue={branding.font_body ?? ''} placeholder="t.ex. Inter, system-ui, sans-serif" />
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
        <span className={styles.hint}>PNG/JPG/WEBP/SVG/GIF, max 2 MB.</span>
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

function ColorField({
  name,
  label,
  value,
  fallback,
}: {
  name: string
  label: string
  value?: string | null
  fallback: string
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input type="color" name={name} defaultValue={value || fallback} />
    </label>
  )
}
