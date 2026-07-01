// Leander template — editable-region manifest (Sajtbyggare, tema 2/5).
//
// Declares the regions a tenant may edit on the `leander` storefront theme, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; mirrors the salvia manifest (manifest/salvia.ts) exactly.
//
// Single source of truth: text + image defaults are referenced LIVE from
// THEME_CONTENT.leander (components/storefront/theme-content) — never re-typed —
// so they can never drift from what the storefront actually renders. Colour/font
// defaults are lifted verbatim from packages/ui/tokens.css
// ([data-world="storefront"][data-theme="leander"]); that file is CSS, not
// importable as data, so the exact values are mirrored here with their source.
//
// Region set = what the leander SITE actually renders: hero copy/photo on the
// home layout (LeanderLayout), about copy/italic/photo + closing photo on the
// shared subpages (om/kontakt via sections.tsx — theme-agnostic). `footer.tagline`
// is intentionally ABSENT: only salvia's FooterFull renders the tagline; leander
// uses the compact MiniFooter (name only), so the field would edit nothing here.

import { THEME_CONTENT } from '@/components/storefront/theme-content'
import type { RegionManifest } from './types'

const leander = THEME_CONTENT.leander

/**
 * Leander colour/font defaults, mirrored EXACTLY from
 * packages/ui/tokens.css → [data-world="storefront"][data-theme="leander"]
 * (and the storefront base block for `--color-accent`). Keep in sync if tokens
 * change; tokens.css is the canonical source.
 */
const LEANDER_TOKEN_DEFAULTS = {
  /** --color-primary (lavender / mauve). */
  colorPrimary: '#7E6E92',
  /** --color-bg (warm off-white). */
  colorBg: '#FBFAF8',
  /** --color-fg (dark plum ink). */
  colorFg: '#2A2630',
  /** Leander's [data-theme] block declares NO bare `--color-accent`; the
   *  storefront base block re-points it with `--color-accent: var(--color-primary)`
   *  ("never Corevo gold"), so leander's resolved accent default = its primary. */
  colorAccent: '#7E6E92',
  /** --font-body. */
  fontBody: "'Inter', system-ui, sans-serif",
} as const

/**
 * The editable regions for leander. Order is editorial (hero → about → colour →
 * font → logo); it carries no semantics. `utility` (the thin top micro-copy
 * strip) is intentionally absent — it is theme-only, never owner-editable (see
 * resolveTenantCopy in theme-content).
 */
export const LEANDER_REGION_MANIFEST: RegionManifest = {
  templateKey: 'leander',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    { key: 'hero.eyebrow', type: 'text', default: leander.heroEyebrow, tenantBinding: { store: 'copy', field: 'heroEyebrow' } },
    { key: 'hero.title', type: 'text', default: leander.heroTitle, tenantBinding: { store: 'copy', field: 'heroTitle' } },
    { key: 'hero.lede', type: 'text', default: leander.heroLede, tenantBinding: { store: 'copy', field: 'heroLede' } },
    { key: 'about.copy', type: 'text', default: leander.aboutCopy, tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'about.italic', type: 'text', default: leander.italic, tenantBinding: { store: 'copy', field: 'italic' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    { key: 'hero.image', type: 'image', default: leander.heroImages[0] ?? null, tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: leander.aboutImage, tenantBinding: { store: 'branding', field: 'about_image' } },
    { key: 'closing.image', type: 'image', default: leander.closingImage, tenantBinding: { store: 'branding', field: 'closing_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: LEANDER_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: LEANDER_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: LEANDER_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: LEANDER_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: LEANDER_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
