// Storefront DB-render gate (goal-47, slice 1) — PURE so the bearing decision is
// unit-testable (an async server component is not). app/(public)/page.tsx calls
// this to decide whether to render the tenant's storefront from the resolved skin
// (content_slots) instead of the hardcoded STOREFRONT_LAYOUTS.
//
// BYTE-IDENTICAL FALLBACK is the whole point: this is wired with the flag ALREADY
// ON in prod, so a wrong `true` here breaks live tenants. The gate is therefore
// deliberately narrow — all four conditions must hold:
//   1. the deploy-wide flag is on (read at call time; never module scope),
//   2. the theme is `salvia` — the only template wired in slice 1,
//   3. a skin actually resolved (template row exists), and
//   4. the tenant AUTHORED content (hasTenantContent) AND it produced sections.
//
// Condition 4 is the correction the brief missed: `sections.length > 0` alone is
// NOT enough, because salvia ships 19 template_slots whose DEFAULTS fill sections
// even for a tenant that authored nothing. Gating on hasTenantContent keeps every
// current tenant (0 content_slots in prod) on the hardcoded layout — byte-identical
// — and flips only a tenant that has real authored content (slice 2 / seeded).

import type { ResolvedSkin } from './types'

export function shouldRenderDbSkin(
  flagEnabled: boolean,
  theme: string,
  skin: ResolvedSkin | null,
): boolean {
  return (
    flagEnabled &&
    theme === 'salvia' &&
    !!skin &&
    skin.hasTenantContent &&
    skin.sections.length > 0
  )
}
