// Salvia template — editable-region manifest (Sajtbyggare S1, F1).
//
// Declares the regions a tenant may edit on the `salvia` storefront theme, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; imported by the F2 resolver / F1 test only — NOT by any
// rendered route yet (the surface is wired behind the SAJTBYGGARE_ENABLED flag
// in a later slice).
//
// Single source of truth: text + image defaults are referenced LIVE from
// THEME_CONTENT.salvia (components/storefront/theme-content) — never re-typed —
// so they can never drift from what the storefront actually renders. Colour/font
// defaults are lifted verbatim from packages/ui/tokens.css
// ([data-world="storefront"][data-theme="salvia"]); that file is CSS, not
// importable as data, so the exact values are mirrored here with their source.

import { THEME_CONTENT } from '@/components/storefront/theme-content'
import type { Region, RegionManifest } from './types'

const salvia = THEME_CONTENT.salvia

/**
 * Salvia colour/font defaults, mirrored EXACTLY from
 * packages/ui/tokens.css → [data-world="storefront"][data-theme="salvia"]
 * (and the storefront base block for `--color-accent`). Keep in sync if tokens
 * change; tokens.css is the canonical source.
 */
const SALVIA_TOKEN_DEFAULTS = {
  /** --color-primary (sage). */
  colorPrimary: '#5E7361',
  /** --color-bg (warm paper). */
  colorBg: '#F6F4EE',
  /** --color-fg (near-black olive ink). */
  colorFg: '#232520',
  /** Salvia's [data-theme] block declares NO bare `--color-accent`; the
   *  storefront base block re-points it with `--color-accent: var(--color-primary)`
   *  ("never Corevo gold"), so salvia's resolved accent default = its primary. */
  colorAccent: '#5E7361',
  /** --font-body. */
  fontBody: "'Jost', 'Inter', sans-serif",
} as const

/**
 * The editable regions for salvia. Order is editorial (hero → about → footer →
 * colour → font → logo); it carries no semantics. `utility` (the thin top
 * micro-copy strip) is intentionally absent — it is theme-only, never owner-
 * editable (see resolveTenantCopy in theme-content).
 */
export const SALVIA_REGION_MANIFEST: RegionManifest = {
  templateKey: 'salvia',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    { key: 'hero.eyebrow', type: 'text', default: salvia.heroEyebrow, tenantBinding: { store: 'copy', field: 'heroEyebrow' } },
    { key: 'hero.title', type: 'text', default: salvia.heroTitle, tenantBinding: { store: 'copy', field: 'heroTitle' } },
    { key: 'hero.lede', type: 'text', default: salvia.heroLede, tenantBinding: { store: 'copy', field: 'heroLede' } },
    { key: 'about.copy', type: 'text', default: salvia.aboutCopy, tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'footer.tagline', type: 'text', default: salvia.tagline, tenantBinding: { store: 'copy', field: 'tagline' } },
    { key: 'about.italic', type: 'text', default: salvia.italic, tenantBinding: { store: 'copy', field: 'italic' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    { key: 'hero.image', type: 'image', default: salvia.heroImages[0] ?? null, tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: salvia.aboutImage, tenantBinding: { store: 'branding', field: 'about_image' } },
    { key: 'closing.image', type: 'image', default: salvia.closingImage, tenantBinding: { store: 'branding', field: 'closing_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: SALVIA_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: SALVIA_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: SALVIA_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: SALVIA_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: SALVIA_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
