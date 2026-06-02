// Variant selection — consolidated (SF-A).
//
// The old A/B/C nav + 1/2/3 hero system is RETIRED. There is now ONE themed Nav
// (whose layout flexes purely off the [data-theme] ancestor in CSS) and the heroes
// live inside the five storefront layouts (components/storefront/layouts/*).
//
// These exports are KEPT for back-compat: app/boka/layout.tsx and
// app/avboka/[id]/page.tsx (both OUTSIDE the SF-A revir) import `pickNav` +
// `pickTemplate`. They must keep compiling and rendering the unified nav, so:
//   • pickNav(...)      → always returns the single themed Nav (arg ignored).
//   • pickTemplate(...) → still returns a valid string for the data-template attr
//     those routes set (harmless: the new storefront CSS keys off [data-theme],
//     not [data-template] — only these legacy routes still emit data-template).
import { Nav } from './Nav'

/** Single source for the one themed nav. The old A/B/C keys all map to it, so any
 *  stale `nav_variant` value in tenant settings resolves to the same nav. */
export const NAV_VARIANTS = { A: Nav, B: Nav, C: Nav } as const

/** The one themed nav. `variant` is accepted (legacy callers pass nav_variant) but
 *  ignored — the nav flexes per [data-theme], not per a variant key. */
export function pickNav(_variant?: string) {
  return Nav
}

// Editorial template key — legacy axis still set as `data-template` by the
// boka/avboka routes. The new storefront styling keys off [data-theme] instead,
// so this only needs to keep returning a valid, stable string. We map the old nav
// variants A/B/C → A/B/C and default to 'A'.
export const TEMPLATES = ['A', 'B', 'C'] as const
export type TemplateKey = (typeof TEMPLATES)[number]

export function pickTemplate(navVariant?: string): TemplateKey {
  const v = (navVariant ?? 'A').toUpperCase()
  return (TEMPLATES as readonly string[]).includes(v) ? (v as TemplateKey) : 'A'
}
