// Tenant theming — level 1 (config). ADR 01 §3.
// Server reads tenant_settings.branding (jsonb) and injects these as CSS custom
// properties on the layout wrapper; components only reference the variables.

export type TenantBranding = {
  color_primary?: string | null
  color_bg?: string | null
  color_fg?: string | null
  color_accent?: string | null
  font_body?: string | null
  font_display?: string | null
  logo_url?: string | null
  // Owner-uploaded storefront media (read-path only; no upload UI yet). Optional
  // so existing branding rows parse unchanged; injectTenantTokens reads none of
  // these, so adding them is inert for theming.
  hero_images?: string[] | null
  gallery_images?: string[] | null
  about_image?: string | null
  closing_image?: string | null
  team?: { name: string; role: string; img: string }[] | null
  stats?: [string, string][] | null
}

const ACCENT_INK = '#15281f'
const ACCENT_PAPER = '#ffffff'

/** Parse `#rgb` / `#rrggbb` → [r,g,b] 0..255, eller null om skräp. */
function rgbOf(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return null
  let h = m[1]
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** WCAG relativ luminans (sRGB), 0..1. */
function relLuminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG kontrastkvot mellan två färger (1..21). */
export function contrastRatio(a: string, b: string): number | null {
  const ra = rgbOf(a)
  const rb = rgbOf(b)
  if (!ra || !rb) return null
  const la = relLuminance(ra)
  const lb = relLuminance(rb)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * Väljer en LÄSBAR textfärg på en given accentfyllning.
 *
 * goal-62 B2a: den gamla versionen gissade på upplevd ljushet (Rec. 601, tröskel 0.6).
 * Gissningen sprack i mitten av skalan — onyx korall (#FF6A4A, Y≈0.58) fick vit text
 * = 2.83:1 (mätt), fast mörk ink ger 5.4:1 på samma fyllning. Nu MÄTS båda kandidaterna
 * med WCAG-kontrast och den bästa vinner. Inget tyckande kvar.
 *
 * Returnerar null på trasig input, så anroparen kan låta befintligt värde stå kvar.
 */
export function accentForeground(hex: string | null | undefined): string | null {
  const ink = contrastRatio(ACCENT_INK, hex ?? '')
  const paper = contrastRatio(ACCENT_PAPER, hex ?? '')
  if (ink == null || paper == null) return null
  return ink >= paper ? ACCENT_INK : ACCENT_PAPER
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
  if (branding?.font_display) vars['--font-display'] = branding.font_display
  return vars
}
