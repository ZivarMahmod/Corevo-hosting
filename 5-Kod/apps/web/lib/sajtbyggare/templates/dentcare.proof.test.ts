// dentcare — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for dentcare means THIS file is green. It asserts the
// template's UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 19 editable-region identities (key + type + layer),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the template mounts (type=booking,
//                  pos=appointment — the Make-Appointment mount). dentcare has TWO
//                  vendor <form>s; ONLY the appointment form becomes the module —
//                  the footer Newsletter <form> stays as inert static content.
//   3. canon     — the exact hex/font values LIFTED from the vendor CSS
//                  (#06A3DA / #fff / #6B6A75 / #F57E57 / "Open Sans"); drift = FAIL,
//                  and no colour/font literal exists that the vendor CSS lacks.
//   4. coverage  — every vendor content section is structurally reproduced
//                  (Topbar … Banner … Appointment … Pricing … Team … Newsletter …).
//
// Patterns reused: manifest/salvia.test.ts (conformance), marked-regions.dom.test.ts
// (render proof), _optimize/restoran-metrics.test.ts (structural metrics) via the
// shared _optimize/proof-kit.ts spine. Mirrors templates/carserv.proof.test.ts.

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { DENTCARE_PAGE_HTML } from './dentcare'
import { DENTCARE_REGION_MANIFEST } from '../manifest/dentcare'
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
const { regions } = DENTCARE_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(DENTCARE_REGION_MANIFEST, DENTCARE_PAGE_HTML)
const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('dentcare template — render-proof invariants', () => {
  it('DENTCARE_PAGE_HTML is a non-empty string', () => {
    expect(typeof DENTCARE_PAGE_HTML).toBe('string')
    expect(DENTCARE_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(DENTCARE_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(DENTCARE_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(DENTCARE_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + spinner + search-modal + animation chrome (static-first)', () => {
    expect(DENTCARE_PAGE_HTML).not.toContain('<script')
    expect(DENTCARE_PAGE_HTML).not.toContain('id="spinner"')
    expect(DENTCARE_PAGE_HTML).not.toContain('searchModal')
    expect(DENTCARE_PAGE_HTML).not.toContain('data-bs-toggle')
    expect(DENTCARE_PAGE_HTML).not.toContain('data-bs-target')
    expect(DENTCARE_PAGE_HTML).not.toContain('data-toggle=')
    expect(DENTCARE_PAGE_HTML).not.toContain('data-target-input')
    expect(DENTCARE_PAGE_HTML).not.toContain('data-wow-delay')
    expect(DENTCARE_PAGE_HTML).not.toContain('navbar-toggler')
    expect(DENTCARE_PAGE_HTML).not.toContain('back-to-top')
    // dentcare's animation classes (slideInDown/zoomIn/fadeInUp/slideInLeft/…):
    expect(DENTCARE_PAGE_HTML).not.toContain('wow')
    expect(DENTCARE_PAGE_HTML).not.toContain('fadeIn')
    expect(DENTCARE_PAGE_HTML).not.toContain('slideIn')
    expect(DENTCARE_PAGE_HTML).not.toContain('zoomIn')
    expect(DENTCARE_PAGE_HTML).not.toContain('animated')
  })

  it('keeps the inert Bootstrap hero-carousel markup verbatim (renders first slide statically)', () => {
    // data-bs-ride / data-bs-slide are NOT in the enumerated JS-only strip set —
    // kept inert (no JS loaded). Both slides + the prev/next controls survive; the
    // prev/next data-bs-target attrs ARE stripped (in the JS-only set).
    expect(DENTCARE_PAGE_HTML).toContain('id="header-carousel"')
    expect(DENTCARE_PAGE_HTML).toContain('data-bs-ride="carousel"')
    expect(DENTCARE_PAGE_HTML).toContain('carousel-control-prev')
    expect(DENTCARE_PAGE_HTML).toContain('carousel-control-next')
    expect(DENTCARE_PAGE_HTML).toContain('data-bs-slide="prev"')
  })

  it('replaces ONLY the Appointment form with the module; the Newsletter form stays inert', () => {
    // dentcare has TWO vendor forms. The Appointment form (its distinctive
    // "Select Doctor" select + submit button) is GONE — replaced by the module.
    expect(DENTCARE_PAGE_HTML).not.toContain('Select Doctor')
    expect(DENTCARE_PAGE_HTML).not.toContain('type="submit"')
    // The footer Newsletter <form> (email sign-up) survives as inert static content.
    expect(DENTCARE_PAGE_HTML).toContain('<form class="mx-auto"')
    expect(DENTCARE_PAGE_HTML).toContain('Sign Up')
    // The Banner "Search A Doctor" widget (NOT a <form>) is untouched by the weave.
    expect(DENTCARE_PAGE_HTML).toContain('Select A Service')
    // Exactly one <corevo-module>, woven at the appointment section.
    expect(DENTCARE_PAGE_HTML).toContain('<corevo-module type="booking" pos="appointment"></corevo-module>')
  })

  it('rewrites all image assets to the served public path (no bare vendor img/ refs)', () => {
    expect(DENTCARE_PAGE_HTML).toContain('/sajtbyggare/dentcare/img/')
    expect(DENTCARE_PAGE_HTML).not.toMatch(/src=["']img\//)
  })

  it('rewrites multi-page nav links to in-page anchors (no dead vendor .html links)', () => {
    expect(DENTCARE_PAGE_HTML).not.toMatch(/href=["'][a-z0-9-]+\.html["']/)
    expect(DENTCARE_PAGE_HTML).toContain('href="#appointment"')
    expect(DENTCARE_PAGE_HTML).toContain('href="#about"')
  })

  it('keeps the vendor attribution (kräver-kredit licence)', () => {
    expect(DENTCARE_PAGE_HTML).toContain('htmlcodex.com')
    expect(DENTCARE_PAGE_HTML).toContain('themewagon.com')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('dentcare booking variant', () => {
  it('mounts the booking module at the appointment position (service+doctor+time vertical)', () => {
    const marker = firstModuleMarker(DENTCARE_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('appointment')
  })
})

// ── 3. SECTION COVERAGE (structural, dentcare-specific) ──────────────────────
describe('dentcare section coverage', () => {
  const lc = DENTCARE_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    topbar: lc.includes('opening hours: mon - tues'),
    'navbar-hero': lc.includes('dentcare') && lc.includes('take the best quality dental treatment'),
    banner: lc.includes('search a doctor') && lc.includes('opening hours'),
    about: lc.includes("the world's best dental clinic that you can trust"),
    appointment: /<corevo-module\b[^>]*type=["']booking["']/.test(DENTCARE_PAGE_HTML) && lc.includes('id="appointment"') && lc.includes('make appointment'),
    service: lc.includes('we offer the best quality dental services') && lc.includes('cosmetic dentistry') && lc.includes('teeth whitening'),
    offer: lc.includes('save 30% on your first dental checkup'),
    pricing: lc.includes('we offer fair prices for dental treatment') && lc.includes('root canal'),
    testimonial: lc.includes('testimonial-item') && lc.includes('dolores sed duo clita justo'),
    team: lc.includes('our dentist') && lc.includes('meet our certified') && lc.includes('dr. john doe'),
    newsletter: lc.includes('sign up') && lc.includes('your email'),
    footer: lc.includes('quick links') && lc.includes('get in touch'),
  }
  it('reproduces every vendor content section (12/12)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('DENTCARE_REGION_MANIFEST', () => {
  it('targets the dentcare template', () => {
    expect(DENTCARE_REGION_MANIFEST.templateKey).toBe('dentcare')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'hero.title',
      'about.eyebrow', 'about.title', 'about.copy',
      'booking.title',
      'service.eyebrow', 'service.title',
      'pricing.eyebrow', 'pricing.title',
      'team.eyebrow', 'team.title',
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
    expect(get('color.primary').default).toBe('#06A3DA')
    expect(get('color.bg').default).toBe('#fff')
    expect(get('color.fg').default).toBe('#6B6A75')
    expect(get('color.accent').default).toBe('#F57E57')
    expect(get('font.body').default).toBe('"Open Sans",sans-serif')
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings', () => {
    expect(get('hero.title').default).toBe('Take The Best Quality Dental Treatment')
    expect(get('about.eyebrow').default).toBe('About Us')
    expect(get('about.title').default).toBe("The World's Best Dental Clinic That You Can Trust")
    expect(get('booking.title').default).toBe('Make Appointment')
    expect(get('service.eyebrow').default).toBe('Our Services')
    expect(get('service.title').default).toBe('We Offer The Best Quality Dental Services')
    expect(get('pricing.eyebrow').default).toBe('Pricing Plan')
    expect(get('pricing.title').default).toBe('We Offer Fair Prices for Dental Treatment')
    expect(get('team.eyebrow').default).toBe('Our Dentist')
    expect(get('team.title').default).toBe('Meet Our Certified & Experienced Dentist')
    expect(get('hero.image').default).toBe('/sajtbyggare/dentcare/img/carousel-1.jpg')
    expect(get('about.image').default).toBe('/sajtbyggare/dentcare/img/about.jpg')
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('dentcare')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(DENTCARE_PAGE_HTML, DENTCARE_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(DENTCARE_REGION_MANIFEST, {
  verticalDefaults: { 'about.eyebrow': '— Tandklinik (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Vår tandklinik: egen rubrik' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('dentcare MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of DENTCARE_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('hero.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="hero\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Vår tandklinik: egen rubrik')
  })

  it('about.eyebrow → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.eyebrow"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Tandklinik (bransch-default)')
  })

  it('about.title → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})

// ── 6. RENDER-BRON round-trip: PAGE_HTML actually parses + the marker swaps ───
// Proves the verbatim vendor HTML parses through html-react-parser without
// throwing AND that the booking marker is REPLACED by a live module node (not
// degraded to an orphan <span data-corevo-module-missing>). The "render-bevisa" gate.
describe('dentcare render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderTemplate(DENTCARE_PAGE_HTML, {
        booking: createElement('div', { 'data-testid': 'booking-mounted' }),
      }),
    ),
  )

  it('parses the full vendor HTML through the render-bridge (body content renders)', () => {
    expect(out).toContain('Make Appointment')
    expect(out).toContain('HTML Codex') // footer credit near the end → whole doc parsed
  })

  it('swaps the booking marker for the live module (no orphaned/missing marker)', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
