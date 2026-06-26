// feane — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for feane means THIS file is green. It asserts the template's
// UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 14 editable-region identities (key + type + layer),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the template mounts (type=booking,
//                  pos=book — the Book-A-Table mount that replaced the native form).
//   3. canon     — the exact hex/font values LIFTED from the vendor style.css
//                  (#ffbe33 / #ffffff / #0c0c0c / "Open Sans"); drift = FAIL, and no
//                  colour/font literal exists that the vendor CSS lacks.
//   4. coverage  — every vendor content section is structurally reproduced
//                  (hero/offer/menu/about/booking/testimonial/footer).
//
// feane-specific traps guarded here (vs the carserv exemplar this is modelled on):
//   - attribution is ThemeWagon + html.design ("Free Html Templates") — NOT htmlcodex.
//   - media live in an `images/` dir (not `img/`).
//   - feane has TWO <form>s: the booking form is REPLACED by the module marker, but
//     the inert navbar icon-search <form class="form-inline"> legitimately remains —
//     so we assert the booking-form CONTENTS are gone + exactly one booking marker,
//     NOT "zero forms".

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { FEANE_PAGE_HTML } from './feane'
import { FEANE_REGION_MANIFEST } from '../manifest/feane'
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
const { regions } = FEANE_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(FEANE_REGION_MANIFEST, FEANE_PAGE_HTML)

const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('feane template — render-proof invariants', () => {
  it('FEANE_PAGE_HTML is a non-empty string', () => {
    expect(typeof FEANE_PAGE_HTML).toBe('string')
    expect(FEANE_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(FEANE_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(FEANE_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(FEANE_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + the navbar-toggler chrome (static-first)', () => {
    expect(FEANE_PAGE_HTML).not.toContain('<script')
    expect(FEANE_PAGE_HTML).not.toContain('navbar-toggler')
    expect(FEANE_PAGE_HTML).not.toContain('data-toggle')
    expect(FEANE_PAGE_HTML).not.toContain('data-target')
  })

  it('keeps the inert Bootstrap slider markup verbatim (renders first slide statically)', () => {
    // data-ride / data-slide-to are NOT in the JS-only strip set — kept inert (no JS
    // loaded). All three slides + the carousel-indicators survive; the indicators'
    // data-target attrs ARE stripped (in the JS-only set).
    expect(FEANE_PAGE_HTML).toContain('id="customCarousel1"')
    expect(FEANE_PAGE_HTML).toContain('data-ride="carousel"')
    expect(FEANE_PAGE_HTML).toContain('carousel-indicators')
    expect(FEANE_PAGE_HTML).toContain('data-slide-to="0"')
  })

  it('keeps the inert isotope menu-filter markup verbatim (shows all cards)', () => {
    expect(FEANE_PAGE_HTML).toContain('filters_menu')
    expect(FEANE_PAGE_HTML).toContain('data-filter="*"')
  })

  it('REPLACES the Book-A-Table <form> with the module; the inert nav search form remains', () => {
    // The booking form's own fields are gone (replaced by the module)…
    expect(FEANE_PAGE_HTML).not.toContain('placeholder="Your Name"')
    expect(FEANE_PAGE_HTML).not.toContain('placeholder="Phone Number"')
    expect(FEANE_PAGE_HTML).not.toContain('How many persons?')
    expect(FEANE_PAGE_HTML).not.toContain('Book Now') // the form's submit button text
    // …but the Book A Table HEADING stays (it's the section title, not the form).
    expect(FEANE_PAGE_HTML).toContain('Book A Table')
    // feane has TWO <form>s; only the navbar icon-search form survives (1 left).
    expect(FEANE_PAGE_HTML.match(/<form\b/g) ?? []).toHaveLength(1)
    expect(FEANE_PAGE_HTML).toContain('class="form-inline"')
  })

  it('rewrites all image assets to the served public path (no bare vendor images/ refs)', () => {
    expect(FEANE_PAGE_HTML).toContain('/sajtbyggare/feane/images/')
    expect(FEANE_PAGE_HTML).not.toMatch(/src=["']images\//)
  })

  it('repoints the cross-page nav to in-page anchors with matching section ids', () => {
    expect(FEANE_PAGE_HTML).toContain('href="#menu"')
    expect(FEANE_PAGE_HTML).toContain('href="#about"')
    expect(FEANE_PAGE_HTML).toContain('href="#book"')
    expect(FEANE_PAGE_HTML).toContain('id="menu"')
    expect(FEANE_PAGE_HTML).toContain('id="about"')
    expect(FEANE_PAGE_HTML).toContain('id="book"')
    // no dead sibling-page links survive
    expect(FEANE_PAGE_HTML).not.toContain('book.html')
    expect(FEANE_PAGE_HTML).not.toContain('menu.html')
  })

  it('keeps the vendor attribution (kräver-kredit licence: ThemeWagon + html.design)', () => {
    expect(FEANE_PAGE_HTML).toContain('themewagon.com')
    expect(FEANE_PAGE_HTML).toContain('html.design')
    expect(FEANE_PAGE_HTML).toContain('Free Html Templates')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('feane booking variant', () => {
  it('mounts the booking module at the book position (the Book-A-Table section)', () => {
    const marker = firstModuleMarker(FEANE_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('book')
  })
})

// ── 3. SECTION COVERAGE (structural, feane-specific) ─────────────────────────
describe('feane section coverage', () => {
  const lc = FEANE_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    'hero-slider': lc.includes('slider_section') && lc.includes('fast food restaurant'),
    offer: lc.includes('offer_section') && lc.includes('tasty thursdays') && lc.includes('pizza days'),
    menu: lc.includes('food_section') && lc.includes('id="menu"') && lc.includes('our menu') && lc.includes('delicious pizza'),
    about: lc.includes('about_section') && lc.includes('id="about"') && lc.includes('we are feane'),
    booking: /<corevo-module\b[^>]*type=["']booking["']/.test(FEANE_PAGE_HTML) && lc.includes('id="book"') && lc.includes('book a table'),
    testimonial: lc.includes('client_section') && lc.includes('what says our customers') && lc.includes('moana michell'),
    footer: lc.includes('footer_section') && lc.includes('themewagon'),
  }
  it('reproduces every vendor content section (7/7)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('FEANE_REGION_MANIFEST', () => {
  it('targets the feane template', () => {
    expect(FEANE_REGION_MANIFEST.templateKey).toBe('feane')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'hero.title',
      'menu.title',
      'about.title', 'about.copy',
      'booking.title',
      'testimonial.title',
      'hero.image', 'about.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
    expect(regions).toHaveLength(14)
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
    expect(get('color.primary').default).toBe('#ffbe33')
    expect(get('color.bg').default).toBe('#ffffff')
    expect(get('color.fg').default).toBe('#0c0c0c')
    expect(get('color.accent').default).toBe('#ffbe33')
    expect(get('font.body').default).toBe('"Open Sans", sans-serif')
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings', () => {
    expect(get('hero.title').default).toBe('Fast Food Restaurant')
    expect(get('menu.title').default).toBe('Our Menu')
    expect(get('about.title').default).toBe('We Are Feane')
    expect(get('about.copy').default).toContain("randomised words which don't look even slightly believable")
    expect(get('booking.title').default).toBe('Book A Table')
    expect(get('testimonial.title').default).toBe('What Says Our Customers')
    expect(get('hero.image').default).toBe('/sajtbyggare/feane/images/hero-bg.jpg')
    expect(get('about.image').default).toBe('/sajtbyggare/feane/images/about-img.png')
  })

  it('every text/image default appears in the page HTML (whitespace-normalised — mirrors the vendor copy)', () => {
    // The normalised text defaults collapse the vendor's multi-line, word-wrapped
    // copy (e.g. about.copy) to a single line, so compare both sides whitespace-
    // normalised; image paths carry no whitespace so they match either way.
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
    const pageNorm = norm(FEANE_PAGE_HTML)
    for (const r of regions) {
      if (r.type !== 'text' && r.type !== 'image') continue
      if (!r.default) continue
      expect(pageNorm, `default not in page: ${r.key}`).toContain(norm(r.default))
    }
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('feane')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(vendorCssLc).toContain('#ffbe33') // the lifted brand gold is really in style.css
    expect(countTokenMismatches(tokenScanText(FEANE_PAGE_HTML, FEANE_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(FEANE_REGION_MANIFEST, {
  verticalDefaults: { 'menu.title': '— Restaurang (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Vår restaurang: egen rubrik' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('feane MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of FEANE_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('hero.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="hero\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Vår restaurang: egen rubrik')
  })

  it('menu.title → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="menu\.title"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Restaurang (bransch-default)')
  })

  it('about.title → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})

// ── 6. RENDER-BRON round-trip: PAGE_HTML actually parses + the marker swaps ───
// Proves the verbatim vendor HTML (incl. feane's heavy inline cart/arrow SVG) parses
// through html-react-parser without throwing AND that the booking marker is REPLACED
// by a live module node (not degraded to an orphan/render-error). The "render-bevisa" gate.
describe('feane render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderTemplate(FEANE_PAGE_HTML, {
        booking: createElement('div', { 'data-testid': 'booking-mounted' }),
      }),
    ),
  )

  it('parses the full vendor HTML through the render-bridge (no degrade-to-error)', () => {
    expect(out).not.toContain('data-corevo-render-error')
    expect(out).toContain('Book A Table') // the booking section heading rendered
    expect(out).toContain('ThemeWagon') // footer credit near the end → whole doc parsed
  })

  it('swaps the booking marker for the live module (no orphaned/missing marker)', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
