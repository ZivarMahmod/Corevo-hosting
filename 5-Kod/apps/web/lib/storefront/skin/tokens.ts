// Template-skin resolver — token parsing + CSS-variable flattening. PURE: no
// Supabase, no I/O, fully unit-testable.
//
// CSS-var namespace decision (`--sf-*`):
//   @corevo/ui already owns the bare `--color-*` / `--font-*` / `--radius`
//   namespace — injectTenantTokens() emits e.g. `--color-bg`, `--font-body`
//   INLINE on <body> as the per-tenant branding override (ADR 01 §3, "level 1").
//   Template tokens are a DIFFERENT, template-scoped layer; emitting bare
//   `--color-bg` here would clobber that tenant override on the same element.
//   So we MIRROR the existing structure (color-/font-/layout-) but under the
//   documented `--sf-*` namespace (sf = storefront): `color.bg → --sf-color-bg`,
//   `font.heading → --sf-font-heading`, `layout.radius → --sf-layout-radius`.
//   This keeps the template layer composable on top of (never fighting) the
//   tenant-branding vars, and matches the slot-resolver plan's documented shape.

import type { TemplateTokens } from './types'

/** The three known token groups, in emit order. Unknown groups are ignored. */
const TOKEN_GROUPS = ['color', 'font', 'layout'] as const
type TokenGroup = (typeof TOKEN_GROUPS)[number]

/**
 * Defensively coerce a raw `templates.tokens` jsonb into TemplateTokens.
 *
 * Robust to the prod reality (the column is `{}` today) and to malformed input:
 *  - non-object / null / array / primitive  → `{}`
 *  - only the known groups (color/font/layout) are read; others dropped
 *  - within a group, only STRING leaf values survive (numbers, nested objects,
 *    null, arrays are skipped) so a stray non-string never reaches CSS.
 * A group that ends up with no usable string leaves is omitted entirely.
 */
export function parseTokens(raw: unknown): TemplateTokens {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const src = raw as Record<string, unknown>
  const out: TemplateTokens = {}
  for (const group of TOKEN_GROUPS) {
    const node = src[group]
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue
    const entries = node as Record<string, unknown>
    const clean: Record<string, string> = {}
    for (const [k, v] of Object.entries(entries)) {
      if (typeof v === 'string') clean[k] = v
    }
    if (Object.keys(clean).length > 0) out[group] = clean
  }
  return out
}

/**
 * Flatten TemplateTokens to template-scoped CSS custom properties.
 * `{ color: { bg: '#111' }, font: { heading: 'Inter' } }`
 *   → `{ '--sf-color-bg': '#111', '--sf-font-heading': 'Inter' }`.
 * Empty tokens → `{}`. Key names are not transformed beyond the `--sf-<group>-`
 * prefix, so a token key is expected to already be a valid CSS-ident fragment.
 */
export function tokensToCssVars(tokens: TemplateTokens): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const group of TOKEN_GROUPS) {
    const node = tokens[group as TokenGroup]
    if (!node) continue
    for (const [k, v] of Object.entries(node)) {
      vars[`--sf-${group}-${k}`] = v
    }
  }
  return vars
}

/**
 * Return a CSS-var map shaped for use as a React `style` prop. CSS custom
 * properties are valid string keys on a style object, so this is an identity
 * pass that exists to give callers a typed seam (and a single place to adapt if
 * the React style typing ever needs `as React.CSSProperties`). Empty → `{}`.
 */
export function cssVarsToStyle(vars: Record<string, string>): Record<string, string> {
  return { ...vars }
}
