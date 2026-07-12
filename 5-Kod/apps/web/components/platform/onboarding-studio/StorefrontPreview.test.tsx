// goal-48 W2 — StorefrontPreview RENDER smoke + invariants. Proves the real per-theme
// layout renders client-side from an unsaved StudioCfg without throwing, the theme
// guard falls back on an unknown key, accent-ONLY injection (no theme-mask), the
// resolveModuleState gating (present/absent/paused), and services=[] honest empty-state.
// node env + renderToStaticMarkup (no DOM). Bookable (in the real layout) calls
// useRouter → mock next/navigation, like render-smoke mocks the createTenant action.
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))

import type { StudioCfg } from '@/lib/platform/onboarding-studio/model'
import { initStudioCfg } from '@/lib/platform/onboarding-studio/model'
import type { ModuleState } from '@/lib/tenant-modules'
import { StorefrontPreview } from './StorefrontPreview'

function cfgWith(over: Partial<StudioCfg> = {}): StudioCfg {
  return { ...initStudioCfg('salvia'), ...over }
}
function render(cfg: StudioCfg): string {
  return renderToStaticMarkup(<StorefrontPreview cfg={cfg} />)
}

describe('W2 StorefrontPreview', () => {
  it('renders the real themed storefront from an unsaved cfg (no crash)', () => {
    const html = render(cfgWith({ branch: 'frisor', name: 'Klippoteket' }))
    expect(html).toContain('data-world="storefront"')
    expect(html).toContain('data-theme="salvia"')
    // hero copy comes from the theme content (Salvia default), not the operator
    expect(html).toContain('Varsamt utfört')
  })

  it('theme guard falls back to the default on an unknown key (no crash)', () => {
    const html = render(cfgWith({ theme: 'Bohem' })) // design 6th key with no real layout
    expect(html).toContain('data-theme="leander"')
  })

  it('injects ACCENT ONLY — never color_primary/-bg/-fg (theme-mask trap)', () => {
    const html = render(cfgWith({ accent: '#c81d4e' }))
    // declaration form (key + colon) — references like var(--color-primary) end in ")"
    expect(html).toContain('--color-accent:#c81d4e')
    expect(html).not.toContain('--color-primary:')
    expect(html).not.toContain('--color-bg:')
    expect(html).not.toContain('--color-fg:')
  })

  it('no accent picked → no inline --color-accent declaration (theme primary wins)', () => {
    const html = render(cfgWith({ accent: '' }))
    expect(html).not.toContain('--color-accent:')
  })

  it('resolveModuleState gates sections: live → present, off → absent, paused → notice', () => {
    const states: Record<string, ModuleState> = {
      booking: 'live',
      shop: 'live',
      offert: 'off',
      lojalitet: 'paused',
    }
    const html = render(cfgWith({ branch: 'frisor', moduleStates: states }))
    expect(html).toContain('Webshop') // shop live → section present
    expect(html).not.toContain('Begär offert') // offert off → absent
    expect(html).toContain('Stammis') // lojalitet paused → present
    expect(html).toContain('Pausad') // …with the read-only paused notice
    // every live mock carries the honest visible marker
    expect(html).toContain('byggs vid lansering')
  })

  it('services=[] → the layout honest empty-state, never fake sample services', () => {
    const html = render(cfgWith({ branch: 'frisor' }))
    expect(html).toContain('Tjänster läggs upp inom kort')
  })

  it('branch=null (studio first render, before a bransch is picked) does not crash', () => {
    const html = render(cfgWith({ branch: null }))
    expect(html).toContain('data-world="storefront"')
    // no module states seeded → no main sections, bare layout chrome only
    expect(html).not.toContain('Webshop')
  })
})
