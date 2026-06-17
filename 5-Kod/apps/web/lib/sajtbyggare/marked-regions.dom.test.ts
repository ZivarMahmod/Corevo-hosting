// F4 render proof — the full resolve → marked render → DOM path, rendered to
// static HTML and asserted for the data-editable markers + 3-layer provenance.
// The cascade input below MIRRORS test-barber's live DB state (settings.copy
// heroTitle override + a nagelstudio vertical default on hero.eyebrow, everything
// else theme default) — the same inputs the F3 server loader reads at runtime.
// Uses createElement (not JSX) so it stays a .test.ts under the vitest include.
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SALVIA_REGION_MANIFEST } from './manifest/salvia'
import { resolveSiteContent } from './resolve'
import { MarkedRegions } from './marked-regions'

const regions = resolveSiteContent(SALVIA_REGION_MANIFEST, {
  verticalDefaults: { 'hero.eyebrow': '— Nagelstudio & Spa (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Test-barber: vår egen rubrik' }, // Kund
  tenantBranding: null,
})

const html = renderToStaticMarkup(createElement(MarkedRegions, { regions }))

describe('MarkedRegions DOM markers (F4 render proof)', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of SALVIA_REGION_MANIFEST.regions) {
      expect(html).toContain(`data-editable="${r.key}"`)
    }
  })

  it('hero.title → tenant (Kund) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(
      /data-editable="hero\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/,
    )
    expect(html).toContain('Test-barber: vår egen rubrik')
  })

  it('hero.eyebrow → vertical (Bransch) layer, provenance standard, shows the vertical value', () => {
    expect(html).toMatch(
      /data-editable="hero\.eyebrow"[^>]*data-provenance="standard"[^>]*data-source="vertical"/,
    )
    expect(html).toContain('Nagelstudio &amp; Spa (bransch-default)')
  })

  it('hero.lede → universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(
      /data-editable="hero\.lede"[^>]*data-provenance="standard"[^>]*data-source="universal"/,
    )
  })
})
