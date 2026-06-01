// Tenant theming — level 1 (config). ADR 01 §3.
// Server reads tenant_settings.branding (jsonb) and injects these as CSS custom
// properties on the layout wrapper; components only reference the variables.

export type TenantBranding = {
  color_primary?: string | null
  color_bg?: string | null
  color_fg?: string | null
  color_accent?: string | null
  font_body?: string | null
  logo_url?: string | null
}

/**
 * Pick a legible foreground (text) colour for a given accent background, based on
 * the accent's perceived luminance. Pure, no deps.
 *
 * Accepts `#rgb` or `#rrggbb` (case-insensitive). Returns the dark-forest default
 * (`#15281f`) for light accents (e.g. the default gold `#f5a623`, Y ≈ 0.69) and
 * white for dark accents, so a tenant who picks a dark accent never gets
 * dark-on-dark CTA text. Returns `null` on malformed input so callers can skip
 * setting the fg and leave the existing default untouched.
 */
export function accentForeground(hex: string | null | undefined): string | null {
  if (!hex) return null
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  // Perceived luminance (Rec. 601), normalised 0..1.
  const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return y >= 0.6 ? '#15281f' : '#ffffff'
}

/**
 * Maps a tenant's branding jsonb to inline CSS custom properties
 * (e.g. `style={injectTenantTokens(branding)}` on <body>).
 */
export function injectTenantTokens(
  branding: TenantBranding | null | undefined,
): Record<string, string> {
  const vars: Record<string, string> = {}
  if (branding?.color_primary) vars['--color-primary'] = branding.color_primary
  if (branding?.color_bg) vars['--color-bg'] = branding.color_bg
  if (branding?.color_fg) vars['--color-fg'] = branding.color_fg
  if (branding?.color_accent) {
    vars['--color-accent'] = branding.color_accent
    // Keep CTA text legible on the chosen accent (a dark accent would otherwise
    // render dark-on-dark). Only set when accent is set + parseable; otherwise
    // leave the default --color-accent-fg untouched.
    const fg = accentForeground(branding.color_accent)
    if (fg) vars['--color-accent-fg'] = fg
  }
  if (branding?.font_body) vars['--font-body'] = branding.font_body
  return vars
}
