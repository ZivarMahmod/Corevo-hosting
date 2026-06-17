// carserv — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for carserv means THIS file is green. It asserts the
// template's UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 19 editable-region identities (key + type + layer),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the template mounts (type=booking,
//                  pos=booking — the Book-For-A-Service mount, not a table).
//   3. canon     — the exact px/hex/font values LIFTED from the vendor CSS
//                  (#D81324 / #fff / #596277 / "Ubuntu"); drift = FAIL, and
//                  no colour/font literal exists that the vendor CSS lacks.
//   4. coverage  — every vendor content section is structurally reproduced
//                  (incl. BOTH service blocks + the Fact section).
//
// Patterns reused: manifest/salvia.test.ts (conformance), marked-regions.dom.test.ts
// (render proof), _optimize/restoran-metrics.test.ts (structural metrics) via the
// shared _optimize/proof-kit.ts spine.

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CARSERV_PAGE_HTML } from './carserv'
import { CARSERV_REGION_MANIFEST } from '../manifest/carserv'
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

const VALID_TYPES: RegionType[] = ['text', 'image', 'color', 'font', 'logo']
const { regions } = CARSERV_REGION_MANIFEST
const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('carserv template — render-proof invariants', () => {
  it('CARSERV_PAGE_HTML is a non-empty string', () => {
    expect(typeof CARSERV_PAGE_HTML).toBe('string')
    expect(CARSERV_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(CARSERV_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(CARSERV_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(CARSERV_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + spinner + animation chrome (static-first)', () => {
    expect(CARSERV_PAGE_HTML).not.toContain('<script')
    expect(CARSERV_PAGE_HTML).not.toContain('id="spinner"')
    expect(CARSERV_PAGE_HTML).not.toContain('data-bs-toggle')
    expect(CARSERV_PAGE_HTML).not.toContain('data-bs-target')
    expect(CARSERV_PAGE_HTML).not.toContain('data-toggle=')
    expect(CARSERV_PAGE_HTML).not.toContain('data-target-input')
    expect(CARSERV_PAGE_HTML).not.toContain('data-wow-delay')
    expect(CARSERV_PAGE_HTML).not.toContain('navbar-toggler')
    expect(CARSERV_PAGE_HTML).not.toContain('back-to-top')
    // carserv's animation classes (never the first class, e.g. "... wow fadeInUp"):
    expect(CARSERV_PAGE_HTML).not.toContain('wow')
    expect(CARSERV_PAGE_HTML).not.toContain('fadeIn')
    expect(CARSERV_PAGE_HTML).not.toContain('slideIn')
    expect(CARSERV_PAGE_HTML).not.toContain('zoomIn')
    expect(CARSERV_PAGE_HTML).not.toContain('animated')
  })

  it('keeps the inert Bootstrap hero-carousel markup verbatim (renders first slide statically)', () => {
    // data-bs-ride / data-bs-slide are NOT in the enumerated JS-only strip set —
    // kept inert (no JS loaded). Both slides + the prev/next controls survive;
    // the prev/next data-bs-target attrs ARE stripped (in the JS-only set).
    expect(CARSERV_PAGE_HTML).toContain('id="header-carousel"')
    expect(CARSERV_PAGE_HTML).toContain('data-bs-ride="carousel"')
    expect(CARSERV_PAGE_HTML).toContain('carousel-control-prev')
    expect(CARSERV_PAGE_HTML).toContain('carousel-control-next')
    expect(CARSERV_PAGE_HTML).toContain('data-bs-slide="prev"')
  })

  it('keeps BOTH vendor Service blocks verbatim (the duplicate-section sentinel)', () => {
    // First block: 3 cards, no heading (fa-certificate / fa-users-cog / fa-tools).
    expect(CARSERV_PAGE_HTML).toContain('fa-certificate')
    // Second block: eyebrow + heading + the (now-inert) nav-pills tabs.
    expect(CARSERV_PAGE_HTML).toContain('nav-pills')
    expect(CARSERV_PAGE_HTML).toContain('Explore Our Services')
    expect(CARSERV_PAGE_HTML).toContain('tab-pane-4')
  })

  it('the booking <form> is the ONLY form, and it is REPLACED by the module (no form survives)', () => {
    // carserv has exactly one <form> (the booking form). The footer "Newsletter"
    // is an input+button <div> (no <form> tag), like klinik. After the weave: zero forms.
    expect(CARSERV_PAGE_HTML).not.toContain('<form')
  })

  it('rewrites all image assets to the served public path (no bare vendor img/ refs)', () => {
    expect(CARSERV_PAGE_HTML).toContain('/sajtbyggare/carserv/img/')
    expect(CARSERV_PAGE_HTML).not.toMatch(/src=["']img\//)
  })

  it('keeps the vendor attribution (kräver-kredit licence)', () => {
    expect(CARSERV_PAGE_HTML).toContain('htmlcodex.com')
    expect(CARSERV_PAGE_HTML).toContain('themewagon.com')
  })

  it('copies the vendor typos verbatim (never "corrected")', () => {
    expect(CARSERV_PAGE_HTML).toContain('Compleate Projects')
    expect(CARSERV_PAGE_HTML).toContain('Vacuam Cleaning')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('carserv booking variant', () => {
  it('mounts the booking module at the booking position (service+staff+time vertical)', () => {
    const marker = firstModuleMarker(CARSERV_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('booking')
  })
})

// ── 3. SECTION COVERAGE (structural, carserv-specific) ───────────────────────
describe('carserv section coverage', () => {
  const lc = CARSERV_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    topbar: lc.includes('mon - fri'),
    'navbar-hero': lc.includes('navbar') && lc.includes('qualified car repair service center'),
    'service-1': lc.includes('fa-certificate') && lc.includes('quality servicing') && lc.includes('modern equipment'),
    about: lc.includes('is the best place for your auto care'),
    fact: lc.includes('fact bg-dark') && lc.includes('expert technicians') && lc.includes('compleate projects'),
    'service-2': lc.includes('nav-pills') && lc.includes('explore our services') && lc.includes('diagnostic test'),
    booking: /<corevo-module\b[^>]*type=["']booking["']/.test(CARSERV_PAGE_HTML) && lc.includes('id="booking"') && lc.includes('book for a service'),
    team: lc.includes('team-item') && lc.includes('our expert technicians'),
    testimonial: lc.includes('testimonial-item') && lc.includes('our clients say'),
    footer: lc.includes('bg-dark text-light footer'),
  }
  it('reproduces every vendor content section (10/10, incl. BOTH service blocks)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('CARSERV_REGION_MANIFEST', () => {
  it('targets the carserv template', () => {
    expect(CARSERV_REGION_MANIFEST.templateKey).toBe('carserv')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'hero.title',
      'about.eyebrow', 'about.title', 'about.copy',
      'service.eyebrow', 'service.title',
      'booking.title',
      'team.eyebrow', 'team.title',
      'testimonial.eyebrow', 'testimonial.title',
      'hero.image', 'about.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
    expect(regions).toHaveLength(19)
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
    expect(get('color.primary').default).toBe('#D81324')
    expect(get('color.bg').default).toBe('#fff')
    expect(get('color.fg').default).toBe('#596277')
    expect(get('color.accent').default).toBe('#D81324')
    expect(get('font.body').default).toBe('"Ubuntu", sans-serif')
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings (incl. the `// … //` eyebrow slashes)', () => {
    expect(get('hero.title').default).toBe('Qualified Car Repair Service Center')
    expect(get('about.eyebrow').default).toBe('// About Us //')
    expect(get('about.title').default).toBe('CarServ Is The Best Place For Your Auto Care')
    expect(get('service.eyebrow').default).toBe('// Our Services //')
    expect(get('service.title').default).toBe('Explore Our Services')
    expect(get('booking.title').default).toBe('Book For A Service')
    expect(get('hero.image').default).toBe('/sajtbyggare/carserv/img/carousel-bg-1.jpg')
    expect(get('about.image').default).toBe('/sajtbyggare/carserv/img/about.jpg')
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('carserv')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(CARSERV_PAGE_HTML, CARSERV_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(CARSERV_REGION_MANIFEST, {
  verticalDefaults: { 'about.eyebrow': '— Bilverkstad (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Vår bilverkstad: egen rubrik' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('carserv MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of CARSERV_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('hero.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="hero\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Vår bilverkstad: egen rubrik')
  })

  it('about.eyebrow → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.eyebrow"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Bilverkstad (bransch-default)')
  })

  it('about.title → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})
