'use client'

// Onboarding-studio (goal-48 W2) — the LIVE storefront preview. Renders the REAL
// per-theme layout (STOREFRONT_LAYOUTS[cfg.theme]) client-side from the unsaved
// StudioCfg, re-themed byte-for-byte via the real mechanism, plus the per-bransch
// module-section mocks. Replaces W1's inert placeholder inside PreviewPane's
// BrowserFrame. Display-only (W2): no BookingProvider, CTAs are inert links, the whole
// storefront subtree is pointer-events:none. Click-edit hero = W5.
//
// Why the real layout renders here: the 5 layouts are pure props-only functions whose
// @/lib/tenant-data imports are TYPE-ONLY (erased), so the server data layer never
// loads — proven by a clean transitive import graph (build-contract §1). We import only
// `type` from @/lib/tenant-data; importing its runtime (parseTheme/STOREFRONT_THEMES)
// would pull next/headers + server supabase into the client bundle.

import type { CSSProperties } from 'react'
import { injectTenantTokens } from '@corevo/ui'
import { STOREFRONT_LAYOUTS } from '@/components/storefront/layouts'
import type { StorefrontLayoutProps } from '@/components/storefront/layouts'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import type { StorefrontTheme } from '@/lib/tenant-data'
import type { StudioCfg } from '@/lib/platform/onboarding-studio/model'
import styles from '@/components/storefront/storefront.module.css'
import { ModuleSections, KontoPanel, PreviewNav, PreviewFooter } from './preview-modules'

// Platform default (DEFAULT_STOREFRONT_THEME, tenant-data.ts:28) — inlined as a literal
// so we never import the runtime guard from the server-poisoned tenant-data module.
const DEFAULT_THEME: StorefrontTheme = 'leander'

export function StorefrontPreview({ cfg }: { cfg: StudioCfg }) {
  // CLIENT-SAFE theme guard: cfg.theme is typed `string`; an unknown key (e.g. the
  // design's "Bohem", which has no real layout) → fall back to the default, never crash.
  const theme: StorefrontTheme = (cfg.theme in STOREFRONT_LAYOUTS ? cfg.theme : DEFAULT_THEME) as StorefrontTheme
  const Layout = STOREFRONT_LAYOUTS[theme]

  // Pure, no-I/O content resolve. branding=null (accent never flows through content —
  // it is injected as a CSS var at the wrapper); only the owner tagline overrides copy.
  const content = resolveThemeContent(theme, null, cfg.tagline.trim() ? { tagline: cfg.tagline } : null)

  const props: StorefrontLayoutProps = {
    tenant: { id: '', name: cfg.name || 'Din salong', slug: cfg.slug || 'dinsalong' },
    theme,
    content,
    services: [], // unsaved → no services; every layout shows its honest empty-state
    location: null,
  }

  // ACCENT-ONLY injection (theme-mask trap): inject ONLY --color-accent, never
  // --color-primary/-bg/-fg — those would mask the [data-theme] palette and make every
  // theme look the same. Spread the inline vars + cast (Record<string,string> → CSSProps).
  const rootStyle = {
    ...injectTenantTokens({ color_accent: cfg.accent || undefined }),
    background: 'var(--color-bg)',
    color: 'var(--color-fg)',
    minHeight: '100%',
    // Display-only preview: neutralize stray clicks (no BookingProvider → CTAs are inert
    // <Link>/router.push; W2 is render-only, interaction is out of scope).
    pointerEvents: 'none',
  } as CSSProperties

  return (
    // ONE storefront root: data-theme selects the global [data-world="storefront"]
    // [data-theme] palette block (tokens.css) → flipping cfg.theme recomputes the whole
    // palette; tplRoot supplies --nav-h/--sf-radius (required by Salvia's hero).
    <div data-world="storefront" data-theme={theme} className={styles.tplRoot} style={rootStyle}>
      {/* Preview-nav chrome, exactly --nav-h tall + normal-flow, so Salvia's hero
          (margin-top: calc(-1*--nav-h)) tucks under it instead of clipping. */}
      <PreviewNav cfg={cfg} />

      {/* The REAL per-theme layout (booking covered by its service rows + Boka CTAs). */}
      <Layout {...props} />

      {/* Module sections appended below the layout — the REAL composition order. */}
      <div style={{ display: 'grid', gap: 44, padding: '44px 40px' }}>
        <ModuleSections cfg={cfg} />
        <KontoPanel cfg={cfg} />
      </div>

      <PreviewFooter cfg={cfg} />
    </div>
  )
}
