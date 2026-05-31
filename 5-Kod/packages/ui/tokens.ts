// Tenant theming — level 1 (config). ADR 01 §3.
// Server reads tenant_settings.branding (jsonb) and injects these as CSS custom
// properties on the layout wrapper; components only reference the variables.

export type TenantBranding = {
  color_primary?: string | null
  color_bg?: string | null
  color_fg?: string | null
  font_body?: string | null
  logo_url?: string | null
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
  if (branding?.font_body) vars['--font-body'] = branding.font_body
  return vars
}
