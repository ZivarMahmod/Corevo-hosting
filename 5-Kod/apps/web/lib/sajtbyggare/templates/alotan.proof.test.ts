// alotan — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for alotan means THIS file is green. It asserts the template's
// UNIQUE shape (a Colorlib barber-shop look), not a generic smoke test (the M2
// false-green trap):
//   1. regions   — the exact 15 editable-region identities (key + type + layer),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the template mounts (type=booking, pos=booking
//                  — the appointment band where the contact.html form was folded).
//   3. canon     — the exact hex/font values LIFTED from the vendor style.css
//                  (#ff6d24 / #fff / #999999 / "Roboto"); drift = FAIL, and no
//                  colour/font literal exists that the vendor CSS lacks.
//   4. coverage  — every vendor content section is structurally reproduced.
//
// Patterns reused: carserv.proof.test.ts (the hand-built reference), the shared
// _optimize/proof-kit.ts spine, and the R4 proofFloor anti-stub.

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { ALOTAN_PAGE_HTML } from './alotan'
import { ALOTAN_REGION_MANIFEST } from '../manifest/alotan'
import { resolveSiteContent } from '../resolve'
import { MarkedRegions } from '../marked-regions'
import type { Region, RegionType } from '../manifest/types'
import {
  firstModuleMarker,
  moduleMarkerTypes,
  unresolvedModuleMarkers,
  modulesWoven,
  countTokenMismatches,
  readVendorCssLc,
  tokenScanText,
} from '../_optimize/proof-kit'
import { proofFloor } from '../_optimize/proof-floor'

const VALID_TYPES: RegionType[] = ['text', 'image', 'color', 'font', 'logo']
const { regions } = ALOTAN_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(ALOTAN_REGION_MANIFEST, ALOTAN_PAGE_HTML)

const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('alotan template — render-proof invariants', () => {
  it('ALOTAN_PAGE_HTML is a non-empty string', () => {
    expect(typeof ALOTAN_PAGE_HTML).toBe('string')
    expect(ALOTAN_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(ALOTAN_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(ALOTAN_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(ALOTAN_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + loader + JS-only chrome (static-first)', () => {
    expect(ALOTAN_PAGE_HTML).not.toContain('<script')
    // alotan's spinner is id="loader" (NOT id="spinner"); it carried non-vendor
    // hex (#eeeeee/#f4b214) so it MUST be removed or token-drift would fire.
    expect(ALOTAN_PAGE_HTML).not.toContain('id="loader"')
    expect(ALOTAN_PAGE_HTML).not.toContain('navbar-toggler')
    expect(ALOTAN_PAGE_HTML).not.toContain('data-toggle')
    expect(ALOTAN_PAGE_HTML).not.toContain('data-target')
  })

  it('keeps the inert markup verbatim (no JS loaded — renders statically)', () => {
    // element-animate / data-animate-effect / data-stellar-background-ratio are NOT
    // in the enumerated strip set — kept inert (the page renders without JS). The
    // owl Services slider markup + the inert Haircut dropdown survive too.
    expect(ALOTAN_PAGE_HTML).toContain('owl-carousel')
    expect(ALOTAN_PAGE_HTML).toContain('dropdown-menu')
    expect(ALOTAN_PAGE_HTML).toContain('data-stellar-background-ratio')
  })

  it('has NO native <form> (alotan home had none; the folded contact form is REPLACED by the module)', () => {
    expect(ALOTAN_PAGE_HTML).not.toContain('<form')
  })

  it('rewrites all image assets to the served public path (no bare vendor images/ refs)', () => {
    expect(ALOTAN_PAGE_HTML).toContain('/sajtbyggare/alotan/images/')
    expect(ALOTAN_PAGE_HTML).not.toMatch(/src=["']images\//)
    expect(ALOTAN_PAGE_HTML).not.toMatch(/url\(["']?images\//)
  })

  it('keeps the vendor attribution (kräver-kredit / CC BY 3.0 licence)', () => {
    expect(ALOTAN_PAGE_HTML).toContain('colorlib.com')
    expect(ALOTAN_PAGE_HTML).toContain('CC BY 3.0')
  })

  it('copies the vendor content verbatim (incl. the literal "Division Rad" typo)', () => {
    expect(ALOTAN_PAGE_HTML).toContain('249 Division Rad')
    expect(ALOTAN_PAGE_HTML).toContain('Call us 24/7 we will get back to you ASAP')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('alotan booking variant', () => {
  it('mounts the booking module at the appointment band (service+staff+time vertical)', () => {
    const marker = firstModuleMarker(ALOTAN_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('booking')
  })
})

// ── 3. SECTION COVERAGE (structural, alotan-specific) ────────────────────────
describe('alotan section coverage', () => {
  const lc = ALOTAN_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    'header-nav': lc.includes('navbar-brand') && lc.includes('alotan'),
    hero: lc.includes('site-hero') && lc.includes('banner_text_1.png'),
    'quick-info': lc.includes('quick-info') && lc.includes('call us 24/7 we will get back to you asap'),
    services: lc.includes('id="services"') && lc.includes('far far away, behind the word mountains'),
    features: lc.includes('barber features') && lc.includes('mustache expert'),
    // booking band: span-split heading → match the contiguous "get 25% discount".
    booking: /<corevo-module\b[^>]*type=["']booking["']/.test(ALOTAN_PAGE_HTML) && lc.includes('id="booking"') && lc.includes('get 25% discount'),
    about: lc.includes('id="about"') && lc.includes('good looking style') && lc.includes('start with us today'),
    footer: lc.includes('site-footer') && lc.includes('latest blog'),
  }
  it('reproduces every vendor content section (8/8)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('ALOTAN_REGION_MANIFEST', () => {
  it('targets the alotan template', () => {
    expect(ALOTAN_REGION_MANIFEST.templateKey).toBe('alotan')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'services.title', 'services.copy',
      'features.title', 'features.copy',
      'booking.title',
      'about.title', 'about.copy',
      'hero.image', 'about.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
    expect(regions).toHaveLength(15)
  })

  it('has no duplicate keys + every region has a valid type', () => {
    const keys = regions.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const r of regions) expect(VALID_TYPES).toContain(r.type)
  })

  it('text regions bind to settings.copy, branding regions bind to the branding column', () => {
    for (const r of regions) {
      if (r.type === 'text') expect(r.tenantBinding.store).toBe('copy')
      else expect(r.tenantBinding.store).toBe('branding')
      expect(r.tenantBinding.field.length).toBeGreaterThan(0)
    }
  })

  it('colour + font defaults are the EXACT vendor token values; logo has none', () => {
    expect(get('color.primary').default).toBe('#ff6d24')
    expect(get('color.bg').default).toBe('#fff')
    expect(get('color.fg').default).toBe('#999999')
    expect(get('color.accent').default).toBe('#ff6d24')
    expect(get('font.body').default).toBe('"Roboto", arial, sans-serif')
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings', () => {
    expect(get('services.title').default).toBe('Services')
    expect(get('services.copy').default).toBe('Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts.')
    expect(get('features.title').default).toBe('Barber Features')
    expect(get('booking.title').default).toBe('Appoint a Haircut Today and Get 25% discount')
    expect(get('about.title').default).toBe('Good Looking Style')
    expect(get('hero.image').default).toBe('/sajtbyggare/alotan/images/banner_text_1.png')
    expect(get('about.image').default).toBe('/sajtbyggare/alotan/images/img_5.jpg')
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('alotan')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(ALOTAN_PAGE_HTML, ALOTAN_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(ALOTAN_REGION_MANIFEST, {
  verticalDefaults: { 'services.title': '— Frisör (bransch-default)' }, // Bransch
  tenantCopy: { bookingTitle: 'Boka din tid hos oss' }, // Kund (binding field for booking.title)
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('alotan MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of ALOTAN_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('booking.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="booking\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Boka din tid hos oss')
  })

  it('services.title → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="services\.title"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Frisör (bransch-default)')
  })

  it('features.title → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="features\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})

// ── 6. RENDER-BRON round-trip: PAGE_HTML actually parses + the marker swaps ───
describe('alotan render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderTemplate(ALOTAN_PAGE_HTML, {
        booking: createElement('div', { 'data-testid': 'booking-mounted' }),
      }),
    ),
  )

  it('parses the full vendor HTML through the render-bridge (body content renders)', () => {
    expect(out).toContain('Get 25% discount') // booking band heading
    expect(out).toContain('Colorlib') // footer credit near the end → whole doc parsed
  })

  it('swaps the booking marker for the live module (no orphaned/missing marker)', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
