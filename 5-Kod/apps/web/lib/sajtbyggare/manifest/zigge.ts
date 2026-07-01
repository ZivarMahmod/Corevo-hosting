// Zigge template — editable-region manifest (Sajtbyggare, tema 3/5).
//
// Declares the regions a tenant may edit on the `zigge` storefront theme, with
// each region's Universal/theme default and the storage binding for a per-tenant
// override. Pure data; mirrors the salvia manifest (manifest/salvia.ts) exactly.
//
// Single source of truth: text + image defaults are referenced LIVE from
// THEME_CONTENT.zigge (components/storefront/theme-content) — never re-typed —
// so they can never drift from what the storefront actually renders. Colour/font
// defaults are lifted verbatim from packages/ui/tokens.css
// ([data-world="storefront"][data-theme="zigge"]); that file is CSS, not
// importable as data, so the exact values are mirrored here with their source.
//
// Region set = what the zigge SITE actually renders: hero copy/photo on the
// home layout (ZiggeLayout), about copy/italic/photo + closing photo on the
// shared subpages (om/kontakt via sections.tsx — theme-agnostic). `footer.tagline`
// is intentionally ABSENT: only salvia's FooterFull renders the tagline; zigge
// uses the compact MiniFooter (name only), so the field would edit nothing here.

import { THEME_CONTENT } from '@/components/storefront/theme-content'
import type { RegionManifest } from './types'

const zigge = THEME_CONTENT.zigge

/**
 * Zigge colour/font defaults, mirrored EXACTLY from
 * packages/ui/tokens.css → [data-world="storefront"][data-theme="zigge"]
 * (and the storefront base block for `--color-accent`). Keep in sync if tokens
 * change; tokens.css is the canonical source.
 */
const ZIGGE_TOKEN_DEFAULTS = {
  /** --color-primary (burnt amber / rust). */
  colorPrimary: '#C8743C',
  /** --color-bg (near-black warm). */
  colorBg: '#14120E',
  /** --color-fg (warm bone). */
  colorFg: '#F2ECE2',
  /** Zigge's [data-theme] block declares NO bare `--color-accent`; the
   *  storefront base block re-points it with `--color-accent: var(--color-primary)`
   *  ("never Corevo gold"), so zigge's resolved accent default = its primary. */
  colorAccent: '#C8743C',
  /** --font-body. */
  fontBody: "'Archivo', 'Inter', sans-serif",
} as const

/**
 * The editable regions for zigge. Order is editorial (hero → about → colour →
 * font → logo); it carries no semantics. `utility` (the thin top micro-copy
 * strip) is intentionally absent — it is theme-only, never owner-editable (see
 * resolveTenantCopy in theme-content).
 */
export const ZIGGE_REGION_MANIFEST: RegionManifest = {
  templateKey: 'zigge',
  regions: [
    // ── TEXT — owner editorial copy → tenant_settings.settings.copy.<field> ──
    { key: 'hero.eyebrow', type: 'text', default: zigge.heroEyebrow, tenantBinding: { store: 'copy', field: 'heroEyebrow' } },
    { key: 'hero.title', type: 'text', default: zigge.heroTitle, tenantBinding: { store: 'copy', field: 'heroTitle' } },
    { key: 'hero.lede', type: 'text', default: zigge.heroLede, tenantBinding: { store: 'copy', field: 'heroLede' } },
    { key: 'about.copy', type: 'text', default: zigge.aboutCopy, tenantBinding: { store: 'copy', field: 'aboutCopy' } },
    { key: 'about.italic', type: 'text', default: zigge.italic, tenantBinding: { store: 'copy', field: 'italic' } },

    // ── IMAGE — owner media → tenant_settings.branding.<field> ──
    { key: 'hero.image', type: 'image', default: zigge.heroImages[0] ?? null, tenantBinding: { store: 'branding', field: 'hero_images', index: 0 } },
    { key: 'about.image', type: 'image', default: zigge.aboutImage, tenantBinding: { store: 'branding', field: 'about_image' } },
    { key: 'closing.image', type: 'image', default: zigge.closingImage, tenantBinding: { store: 'branding', field: 'closing_image' } },

    // ── COLOR — branding tokens → tenant_settings.branding.<field> ──
    { key: 'color.primary', type: 'color', default: ZIGGE_TOKEN_DEFAULTS.colorPrimary, tenantBinding: { store: 'branding', field: 'color_primary' } },
    { key: 'color.bg', type: 'color', default: ZIGGE_TOKEN_DEFAULTS.colorBg, tenantBinding: { store: 'branding', field: 'color_bg' } },
    { key: 'color.fg', type: 'color', default: ZIGGE_TOKEN_DEFAULTS.colorFg, tenantBinding: { store: 'branding', field: 'color_fg' } },
    { key: 'color.accent', type: 'color', default: ZIGGE_TOKEN_DEFAULTS.colorAccent, tenantBinding: { store: 'branding', field: 'color_accent' } },

    // ── FONT — branding token → tenant_settings.branding.font_body ──
    { key: 'font.body', type: 'font', default: ZIGGE_TOKEN_DEFAULTS.fontBody, tenantBinding: { store: 'branding', field: 'font_body' } },

    // ── LOGO — no theme default → tenant_settings.branding.logo_url ──
    { key: 'logo', type: 'logo', default: null, tenantBinding: { store: 'branding', field: 'logo_url' } },
  ],
}
