'use client'

import { useActionState } from 'react'
import { injectTenantTokens, type TenantBranding } from '@corevo/ui'
import { savePlatformBranding, type ActionState } from '@/lib/platform/actions'
import styles from './platform.module.css'

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

  // Read the live field values, shape them like a branding row, and reuse the exact
  // token mapper the storefront uses — so the preview mirrors the saved result 1:1.
  function emitLive(form: HTMLFormElement) {
    if (!onLiveTokens) return
    const g = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value || undefined
    onLiveTokens(
      injectTenantTokens({
        color_primary: g('color_primary'),
        color_bg: g('color_bg'),
        color_fg: g('color_fg'),
        font_body: g('font_body'),
      } as TenantBranding),
    )
  }

  return (
    <form
      action={formAction}
      className={styles.form}
      onInput={(e) => emitLive(e.currentTarget)}
    >
      <input type="hidden" name="tenantId" value={tenantId} />

      <div className={styles.fieldRow}>
        <ColorField name="color_primary" label="Primärfärg" value={branding.color_primary} fallback="#1f6feb" />
        <ColorField name="color_bg" label="Bakgrund" value={branding.color_bg} fallback="#ffffff" />
        <ColorField name="color_fg" label="Text" value={branding.color_fg} fallback="#111111" />
      </div>

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
        <span className={styles.hint}>PNG/JPG/WEBP/SVG/GIF, max 2 MB. Slår igenom på publika sajten direkt.</span>
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
