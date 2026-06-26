// haircut — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for haircut means THIS file is green. It asserts the
// template's UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 23 editable-region identities (key + type + layer),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the template mounts (type=booking,
//                  pos=booking — the folded contact/appointment band, not a table).
//   3. canon     — the exact hex/font values LIFTED from the vendor CSS
//                  (#EB1616 / #000 / #6C7293 / #191C24 / "Roboto", a DARK theme);
//                  drift = FAIL, and no colour/font literal exists that the vendor
//                  CSS lacks.
//   4. coverage  — every vendor content section is structurally reproduced (Navbar/
//                  hero, About, Service, Price, Team, Working Hours, Testimonial,
//                  the folded Booking band, Footer).
//
// Patterns reused: carserv.proof.test.ts (the cross-family exemplar) via the shared
// _optimize/proof-kit.ts spine + the R4 proof-floor.

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { HAIRCUT_PAGE_HTML } from './haircut'
import { HAIRCUT_REGION_MANIFEST } from '../manifest/haircut'
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
const { regions } = HAIRCUT_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(HAIRCUT_REGION_MANIFEST, HAIRCUT_PAGE_HTML)

const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('haircut template — render-proof invariants', () => {
  it('HAIRCUT_PAGE_HTML is a non-empty string', () => {
    expect(typeof HAIRCUT_PAGE_HTML).toBe('string')
    expect(HAIRCUT_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(HAIRCUT_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(HAIRCUT_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(HAIRCUT_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + spinner + animation chrome (static-first)', () => {
    expect(HAIRCUT_PAGE_HTML).not.toContain('<script')
    expect(HAIRCUT_PAGE_HTML).not.toContain('id="spinner"')
    expect(HAIRCUT_PAGE_HTML).not.toContain('data-bs-toggle')
    expect(HAIRCUT_PAGE_HTML).not.toContain('data-bs-target')
    expect(HAIRCUT_PAGE_HTML).not.toContain('data-wow-delay')
    expect(HAIRCUT_PAGE_HTML).not.toContain('navbar-toggler')
    expect(HAIRCUT_PAGE_HTML).not.toContain('back-to-top')
    // owl-carousel JS-only thumbnail attribute dropped (its mangled-quote source bug):
    expect(HAIRCUT_PAGE_HTML).not.toContain('data-dot')
    // haircut's animation classes (never the first class, e.g. "... wow fadeIn"):
    expect(HAIRCUT_PAGE_HTML).not.toContain('wow')
    expect(HAIRCUT_PAGE_HTML).not.toContain('fadeIn')
    expect(HAIRCUT_PAGE_HTML).not.toContain('slideIn')
    expect(HAIRCUT_PAGE_HTML).not.toContain('animated')
  })

  it('keeps the inert Bootstrap hero-carousel markup verbatim (renders first slide statically)', () => {
    // data-bs-ride / data-bs-slide are NOT in the enumerated JS-only strip set —
    // kept inert (no JS loaded). Both slides + the prev/next controls survive;
    // the prev/next data-bs-target attrs ARE stripped (in the JS-only set).
    expect(HAIRCUT_PAGE_HTML).toContain('id="header-carousel"')
    expect(HAIRCUT_PAGE_HTML).toContain('data-bs-ride="carousel"')
    expect(HAIRCUT_PAGE_HTML).toContain('carousel-control-prev')
    expect(HAIRCUT_PAGE_HTML).toContain('carousel-control-next')
    expect(HAIRCUT_PAGE_HTML).toContain('data-bs-slide="prev"')
  })

  it('keeps the dark-theme salon content sections verbatim (price + working-hours sentinels)', () => {
    // Price section (6 service rows) + Working-Hours section (the dark-theme barbershop tables).
    expect(HAIRCUT_PAGE_HTML).toContain('Check Out Our Barber Services And Prices')
    expect(HAIRCUT_PAGE_HTML).toContain('$29.00')
    expect(HAIRCUT_PAGE_HTML).toContain('Professional Barbers Are Waiting For You')
    expect(HAIRCUT_PAGE_HTML).toContain('09 AM - 09 PM')
    // 6 service cards (one per <img …png>) survive in the Service grid.
    expect(HAIRCUT_PAGE_HTML).toContain('img/mans-shave.png')
    expect(HAIRCUT_PAGE_HTML).toContain('img/hair-dyeing.png')
  })

  it('folds the contact <form> into the booking band and REPLACES it (no form survives)', () => {
    // The vendor home page has no <form>; the appointment band is folded from
    // contact.html and its <form> is swapped for the module. The footer "Newsletter"
    // is an input+button <div> (no <form> tag). After the weave: zero forms.
    expect(HAIRCUT_PAGE_HTML).not.toContain('<form')
    // the folded section heading is kept verbatim
    expect(HAIRCUT_PAGE_HTML).toContain('Have Any Query? Please Contact Us!')
    // the developer-only "contact form is currently inactive" notice was dropped
    expect(HAIRCUT_PAGE_HTML).not.toContain('contact form is currently inactive')
  })

  it('rewrites all image assets to the served public path (no bare vendor img/ refs)', () => {
    expect(HAIRCUT_PAGE_HTML).toContain('/sajtbyggare/haircut/img/')
    expect(HAIRCUT_PAGE_HTML).not.toMatch(/src=["']img\//)
  })

  it('keeps the vendor attribution (kräver-kredit licence)', () => {
    expect(HAIRCUT_PAGE_HTML).toContain('htmlcodex.com')
    expect(HAIRCUT_PAGE_HTML).toContain('themewagon.com')
    expect(HAIRCUT_PAGE_HTML).toContain('HairCut by HTML Codex')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('haircut booking variant', () => {
  it('mounts the booking module at the booking position (service+staff+time vertical)', () => {
    const marker = firstModuleMarker(HAIRCUT_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('booking')
  })
})

// ── 3. SECTION COVERAGE (structural, haircut-specific) ───────────────────────
describe('haircut section coverage', () => {
  const lc = HAIRCUT_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    'navbar-hero': lc.includes('navbar') && lc.includes('we will keep you an awesome look'),
    about: lc.includes('id="about"') && lc.includes('more than just a haircut. learn more about us!'),
    service: lc.includes('id="service"') && lc.includes('what we provide') && lc.includes('service-item'),
    price: lc.includes('id="price"') && lc.includes('check out our barber services and prices'),
    team: lc.includes('id="team"') && lc.includes('team-item') && lc.includes('meet our barber'),
    hours: lc.includes('id="hours"') && lc.includes('professional barbers are waiting for you'),
    testimonial: lc.includes('id="testimonial"') && lc.includes('testimonial-item') && lc.includes('what our clients say'),
    booking: /<corevo-module\b[^>]*type=["']booking["']/.test(HAIRCUT_PAGE_HTML) && lc.includes('id="booking"') && lc.includes('have any query? please contact us!'),
    footer: lc.includes('bg-secondary text-light footer'),
  }
  it('reproduces every vendor content section (9/9, incl. the folded booking band)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('HAIRCUT_REGION_MANIFEST', () => {
  it('targets the haircut template', () => {
    expect(HAIRCUT_REGION_MANIFEST.templateKey).toBe('haircut')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'hero.title',
      'about.eyebrow', 'about.title', 'about.copy',
      'service.eyebrow', 'service.title',
      'price.eyebrow', 'price.title',
      'team.eyebrow', 'team.title',
      'hours.eyebrow', 'hours.title',
      'testimonial.eyebrow', 'testimonial.title',
      'booking.title',
      'hero.image', 'about.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
    expect(regions).toHaveLength(23)
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

  it('colour + font defaults are the EXACT vendor token values (dark theme); logo has none', () => {
    expect(get('color.primary').default).toBe('#EB1616')
    expect(get('color.bg').default).toBe('#000')
    expect(get('color.fg').default).toBe('#6C7293')
    expect(get('color.accent').default).toBe('#191C24')
    expect(get('font.body').default).toBe('"Roboto", sans-serif')
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings', () => {
    expect(get('hero.title').default).toBe('We Will Keep You An Awesome Look')
    expect(get('about.eyebrow').default).toBe('About Us')
    expect(get('about.title').default).toBe('More Than Just A Haircut. Learn More About Us!')
    expect(get('service.eyebrow').default).toBe('Services')
    expect(get('service.title').default).toBe('What We Provide')
    expect(get('price.eyebrow').default).toBe('Price & Plan')
    expect(get('price.title').default).toBe('Check Out Our Barber Services And Prices')
    expect(get('team.title').default).toBe('Meet Our Barber')
    expect(get('hours.title').default).toBe('Professional Barbers Are Waiting For You')
    expect(get('testimonial.title').default).toBe('What Our Clients Say!')
    expect(get('booking.title').default).toBe('Have Any Query? Please Contact Us!')
    expect(get('hero.image').default).toBe('/sajtbyggare/haircut/img/carousel-1.jpg')
    expect(get('about.image').default).toBe('/sajtbyggare/haircut/img/about.jpg')
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('haircut')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(HAIRCUT_PAGE_HTML, HAIRCUT_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(HAIRCUT_REGION_MANIFEST, {
  verticalDefaults: { 'about.eyebrow': '— Frisör (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Vår salong: egen rubrik' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('haircut MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of HAIRCUT_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('hero.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="hero\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Vår salong: egen rubrik')
  })

  it('about.eyebrow → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.eyebrow"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Frisör (bransch-default)')
  })

  it('about.title → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})

// ── 6. RENDER-BRON round-trip: PAGE_HTML actually parses + the marker swaps ───
// Proves the verbatim vendor HTML (incl. the folded contact band + its Google-map
// iframe) parses through html-react-parser without throwing AND that the booking
// marker is REPLACED by a live module node (not degraded to an orphan). The
// "render-bevisa" gate.
describe('haircut render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderTemplate(HAIRCUT_PAGE_HTML, {
        booking: createElement('div', { 'data-testid': 'booking-mounted' }),
      }),
    ),
  )

  it('parses the full vendor HTML through the render-bridge (body content renders)', () => {
    expect(out).toContain('We Will Keep You An Awesome Look')
    expect(out).toContain('HTML Codex') // footer credit near the end → whole doc parsed
    expect(out).not.toContain('data-corevo-render-error')
  })

  it('swaps the booking marker for the live module (no orphaned/missing marker)', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
