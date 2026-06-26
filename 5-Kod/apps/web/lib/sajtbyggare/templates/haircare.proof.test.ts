// haircare — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for haircare means THIS file is green. It asserts the
// template's UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 22 editable-region identities (key + type + layer),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the template mounts (type=booking,
//                  pos=booking — the "Make an Appointment" mount).
//   3. canon     — the exact hex/font values LIFTED from the THEME body+brand rules
//                  in the vendor CSS (#bf925b / #f5f2ea / gray / "Poppins"); drift
//                  = FAIL, and no colour/font literal exists that the vendor CSS lacks.
//   4. coverage  — every vendor content section is structurally reproduced
//                  (Hero, Intro/About, Services, Booking, Team, Gallery, Pricing,
//                  Testimony, Footer) with verbatim sentinels.
//
// Patterns reused: manifest/salvia.test.ts (conformance), marked-regions.dom.test.ts
// (render proof), _optimize/restoran-metrics.test.ts (structural metrics) via the
// shared _optimize/proof-kit.ts spine. Mirrors templates/carserv.proof.test.ts.

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { HAIRCARE_PAGE_HTML } from './haircare'
import { HAIRCARE_REGION_MANIFEST } from '../manifest/haircare'
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
const { regions } = HAIRCARE_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(HAIRCARE_REGION_MANIFEST, HAIRCARE_PAGE_HTML)

const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('haircare template — render-proof invariants', () => {
  it('HAIRCARE_PAGE_HTML is a non-empty string', () => {
    expect(typeof HAIRCARE_PAGE_HTML).toBe('string')
    expect(HAIRCARE_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(HAIRCARE_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(HAIRCARE_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(HAIRCARE_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + the ftco-loader spinner + the ftco-animate reveal class', () => {
    expect(HAIRCARE_PAGE_HTML).not.toContain('<script')
    // colorlib's JS loader (spinner-equivalent) is removed — it also carried
    // #eeeeee/#F96D00 literals absent from the vendor CSS.
    expect(HAIRCARE_PAGE_HTML).not.toContain('id="ftco-loader"')
    expect(HAIRCARE_PAGE_HTML).not.toContain('ftco-loader')
    // .ftco-animate sets opacity:0;visibility:hidden and its reveal JS is gone →
    // stripped so the static render is visible (colorlib analogue of carserv's `wow`).
    expect(HAIRCARE_PAGE_HTML).not.toContain('ftco-animate')
    // the JS-only nav toggler + its data-toggle/data-target hooks are removed.
    expect(HAIRCARE_PAGE_HTML).not.toContain('navbar-toggler')
    expect(HAIRCARE_PAGE_HTML).not.toContain('data-toggle')
    expect(HAIRCARE_PAGE_HTML).not.toContain('data-target')
  })

  it('keeps the inert owl-carousel markup verbatim (renders stacked, no JS)', () => {
    // The team + testimony carousels are kept verbatim (their owl JS is stripped);
    // without JS they render as a stacked list — same static-mode tradeoff as carserv.
    expect(HAIRCARE_PAGE_HTML).toContain('carousel-team owl-carousel')
    expect(HAIRCARE_PAGE_HTML).toContain('carousel-testimony owl-carousel')
  })

  it('the appointment <form> is the ONLY form, and it is REPLACED by the module (no form survives)', () => {
    // haircare has exactly one <form> (the appointment-form). After the weave: zero forms.
    expect(HAIRCARE_PAGE_HTML).not.toContain('<form')
    expect(HAIRCARE_PAGE_HTML).not.toContain('appointment-form')
  })

  it('rewrites all image assets to the served public path (no bare vendor images/ refs)', () => {
    expect(HAIRCARE_PAGE_HTML).toContain('/sajtbyggare/haircare/images/')
    expect(HAIRCARE_PAGE_HTML).not.toMatch(/(?:src|url\()=?["']?images\//)
  })

  it('flattens dead in-template page links to in-page anchors (no .html page links)', () => {
    expect(HAIRCARE_PAGE_HTML).not.toContain('.html"')
  })

  it('keeps the vendor attribution (Colorlib CC BY 3.0 — kräver-kredit)', () => {
    expect(HAIRCARE_PAGE_HTML).toContain('colorlib.com')
    expect(HAIRCARE_PAGE_HTML).toContain('Template is licensed under CC BY 3.0')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('haircare booking variant', () => {
  it('mounts the booking module at the booking position (service+staff+time vertical)', () => {
    const marker = firstModuleMarker(HAIRCARE_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('booking')
  })
})

// ── 3. SECTION COVERAGE (structural, haircare-specific) ──────────────────────
describe('haircare section coverage', () => {
  const lc = HAIRCARE_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    'navbar-hero': lc.includes('ftco-navbar') && lc.includes('we are professional care for your hair'),
    intro: lc.includes('welcome to our salon') && lc.includes('for men') && lc.includes('for women'),
    services: lc.includes('services-section') && lc.includes('services menu') && lc.includes('haircut &amp; styling') && lc.includes('body treatment'),
    booking: /<corevo-module\b[^>]*type=["']booking["']/.test(HAIRCARE_PAGE_HTML) && lc.includes('id="booking"') && lc.includes('make an appointment') && lc.includes('call us: 012-3456-7890'),
    team: lc.includes('ftco-team') && lc.includes('makeup artist') && lc.includes('danica lewis'),
    gallery: lc.includes('our gallery') && lc.includes('/sajtbyggare/haircare/images/work-1.jpg') && lc.includes('class="project"'),
    pricing: lc.includes('ftco-pricing') && lc.includes('our prices') && lc.includes('$50.00') && lc.includes('pricing-entry'),
    testimony: lc.includes('testimony-section') && lc.includes('happy customer') && lc.includes('jeff nucci'),
    footer: lc.includes('ftco-footer') && lc.includes('have a questions?'),
  }
  it('reproduces every vendor content section (9/9)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('HAIRCARE_REGION_MANIFEST', () => {
  it('targets the haircare template', () => {
    expect(HAIRCARE_REGION_MANIFEST.templateKey).toBe('haircare')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'hero.title',
      'about.title', 'about.copy',
      'services.eyebrow', 'services.title',
      'booking.title',
      'team.eyebrow', 'team.title',
      'gallery.eyebrow', 'gallery.title',
      'pricing.eyebrow', 'pricing.title',
      'testimonial.eyebrow', 'testimonial.title',
      'hero.image', 'about.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
    expect(regions).toHaveLength(22)
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

  it('colour + font defaults are the EXACT vendor THEME token values; logo has none', () => {
    // The brand gold + theme body rule — NOT Bootstrap's :root defaults.
    expect(get('color.primary').default).toBe('#bf925b')
    expect(get('color.bg').default).toBe('#f5f2ea')
    expect(get('color.fg').default).toBe('gray')
    expect(get('color.accent').default).toBe('#bf925b')
    expect(get('font.body').default).toBe('"Poppins", Arial, sans-serif')
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings', () => {
    expect(get('hero.title').default).toBe('We are professional care for your hair')
    expect(get('about.title').default).toBe('Welcome to our Salon')
    expect(get('about.copy').default).toContain('A small river named Duden flows by their place')
    expect(get('services.eyebrow').default).toBe('Services')
    expect(get('services.title').default).toBe('Services Menu')
    expect(get('booking.title').default).toBe('Make an Appointment')
    expect(get('team.eyebrow').default).toBe('Artistic Director')
    expect(get('team.title').default).toBe('Makeup Artist')
    expect(get('gallery.title').default).toBe('Our gallery')
    expect(get('pricing.title').default).toBe('Our Prices')
    expect(get('testimonial.title').default).toBe('Happy Customer')
    expect(get('hero.image').default).toBe('/sajtbyggare/haircare/images/bg-2.jpg')
    expect(get('about.image').default).toBe('/sajtbyggare/haircare/images/formen.jpg')
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('haircare')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(HAIRCARE_PAGE_HTML, HAIRCARE_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(HAIRCARE_REGION_MANIFEST, {
  verticalDefaults: { 'services.eyebrow': '— Salong (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Vår salong: egen rubrik' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('haircare MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of HAIRCARE_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('hero.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="hero\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Vår salong: egen rubrik')
  })

  it('services.eyebrow → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="services\.eyebrow"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Salong (bransch-default)')
  })

  it('services.title → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="services\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})

// ── 6. RENDER-BRON round-trip: PAGE_HTML actually parses + the marker swaps ───
// Proves the verbatim vendor HTML parses through html-react-parser without
// throwing AND that the booking marker is REPLACED by a live module node (not
// degraded to an orphan <span data-corevo-module-missing>). The "render-bevisa" gate.
describe('haircare render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderTemplate(HAIRCARE_PAGE_HTML, {
        booking: createElement('div', { 'data-testid': 'booking-mounted' }),
      }),
    ),
  )

  it('parses the full vendor HTML through the render-bridge (body content renders)', () => {
    expect(out).toContain('Make an Appointment')
    expect(out).toContain('Colorlib') // footer credit near the end → whole doc parsed
  })

  it('swaps the booking marker for the live module (no orphaned/missing marker)', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
