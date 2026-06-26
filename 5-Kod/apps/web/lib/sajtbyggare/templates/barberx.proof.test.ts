// barberx — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for barberx means THIS file is green. It asserts the
// template's UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 22 editable-region identities (key + type + layer),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the template mounts (type=booking,
//                  pos=contact — the folded contact band, not the newsletter input).
//   3. canon     — the exact hex/font values LIFTED from the vendor CSS
//                  (#D5B981 gold / #ffffff / #797979 / #1d2434 navy / 'Open Sans');
//                  drift = FAIL, and no colour/font literal exists that the vendor
//                  CSS (style.css) lacks.
//   4. coverage  — every vendor content section is structurally reproduced
//                  (Top Bar, Hero, About, Service, Pricing, Testimonial, Team,
//                  Contact/booking, Blog, Footer).
//
// Patterns reused: carserv.proof.test.ts (the htmlcodex sibling), salvia conformance,
// marked-regions DOM render, _optimize/proof-kit.ts structural spine + proofFloor (R4).

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { BARBERX_PAGE_HTML } from './barberx'
import { BARBERX_REGION_MANIFEST } from '../manifest/barberx'
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
const { regions } = BARBERX_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(BARBERX_REGION_MANIFEST, BARBERX_PAGE_HTML)
const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('barberx template — render-proof invariants', () => {
  it('BARBERX_PAGE_HTML is a non-empty string', () => {
    expect(typeof BARBERX_PAGE_HTML).toBe('string')
    expect(BARBERX_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(BARBERX_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(BARBERX_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(BARBERX_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + JS-only chrome (static-first)', () => {
    expect(BARBERX_PAGE_HTML).not.toContain('<script')
    expect(BARBERX_PAGE_HTML).not.toContain('data-toggle')
    expect(BARBERX_PAGE_HTML).not.toContain('data-target')
    expect(BARBERX_PAGE_HTML).not.toContain('data-dismiss')
    expect(BARBERX_PAGE_HTML).not.toContain('data-src')
    expect(BARBERX_PAGE_HTML).not.toContain('navbar-toggler')
    expect(BARBERX_PAGE_HTML).not.toContain('back-to-top')
  })

  it('removes the JS-driven Video Modal + its hero btn-play trigger', () => {
    expect(BARBERX_PAGE_HTML).not.toContain('id="videoModal"')
    expect(BARBERX_PAGE_HTML).not.toContain('btn-play')
    expect(BARBERX_PAGE_HTML).not.toContain('<iframe')
  })

  it('rewrites nav links to in-page anchors + flattens the JS Pages dropdown', () => {
    // vendor page links (about.html, service.html, …) become #anchors that resolve.
    expect(BARBERX_PAGE_HTML).not.toContain('about.html')
    expect(BARBERX_PAGE_HTML).not.toContain('service.html')
    expect(BARBERX_PAGE_HTML).not.toContain('contact.html')
    expect(BARBERX_PAGE_HTML).not.toContain('dropdown-toggle')
    expect(BARBERX_PAGE_HTML).not.toContain('single.html') // Single Page (no home section) dropped
    expect(BARBERX_PAGE_HTML).toContain('<a href="#blog" class="nav-item nav-link">Blog</a>')
    for (const id of ['#about', '#service', '#price', '#team', '#blog', '#contact']) {
      expect(BARBERX_PAGE_HTML, `nav anchor missing: ${id}`).toContain(`href="${id}"`)
    }
  })

  it('carries the matching section ids so the in-page anchors resolve', () => {
    for (const id of ['about', 'service', 'price', 'team', 'blog', 'contact']) {
      expect(BARBERX_PAGE_HTML, `section id missing: ${id}`).toContain(`id="${id}"`)
    }
  })

  it('the native contact <form> is REPLACED by the module (no form survives)', () => {
    // barberx has exactly one <form> (the contact form). The footer "Newsletter"
    // is an input+button <div class="form"> (no <form> tag). After the weave: zero forms.
    expect(BARBERX_PAGE_HTML).not.toContain('<form')
    expect(BARBERX_PAGE_HTML).not.toContain('id="contactForm"')
    // the newsletter input (NOT the weave target) is still present.
    expect(BARBERX_PAGE_HTML).toContain('Email goes here')
  })

  it('rewrites all image assets to the served public path (no bare vendor img/ refs)', () => {
    expect(BARBERX_PAGE_HTML).toContain('/sajtbyggare/barberx/img/')
    expect(BARBERX_PAGE_HTML).not.toMatch(/src=["']img\//)
  })

  it('keeps the vendor attribution (kräver-kredit / CC-BY licence)', () => {
    expect(BARBERX_PAGE_HTML).toContain('htmlcodex.com')
    expect(BARBERX_PAGE_HTML).toContain('Designed By')
    expect(BARBERX_PAGE_HTML).toContain('HTML Codex')
  })

  it('copies the vendor text verbatim (incl. the "FQAs" footer typo)', () => {
    expect(BARBERX_PAGE_HTML).toContain('FQAs')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('barberx booking variant', () => {
  it('mounts the booking module at the contact band (service+staff+time vertical)', () => {
    const marker = firstModuleMarker(BARBERX_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('contact')
  })
})

// ── 3. SECTION COVERAGE (structural, barberx-specific) ───────────────────────
describe('barberx section coverage', () => {
  const lc = BARBERX_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    topbar: lc.includes('top-bar') && lc.includes('call us for appointment'),
    'navbar-hero': lc.includes('navbar-brand') && lc.includes('html5 template for salon website'),
    about: lc.includes('id="about"') && lc.includes('25 years experience') && lc.includes('learn about us'),
    service: lc.includes('id="service"') && lc.includes('best salon and barber services for you') && lc.includes('hair cut'),
    price: lc.includes('id="price"') && lc.includes('we provide best price in the city') && lc.includes('wedding cut') && lc.includes('$20.99'),
    testimonial: lc.includes('testimonials-carousel') && lc.includes('testimonial-item'),
    team: lc.includes('id="team"') && lc.includes('meet our hair cut expert barber') && lc.includes('adam phillips'),
    booking: /<corevo-module\b[^>]*type=["']booking["']/.test(BARBERX_PAGE_HTML) && lc.includes('id="contact"') && lc.includes('if you have any query, please contact us'),
    blog: lc.includes('id="blog"') && lc.includes('learn more from latest barber blog') && lc.includes('blog-item'),
    footer: lc.includes('class="footer"') && lc.includes('salon address') && lc.includes('newsletter'),
  }
  it('reproduces every vendor content section (10/10)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('BARBERX_REGION_MANIFEST', () => {
  it('targets the barberx template', () => {
    expect(BARBERX_REGION_MANIFEST.templateKey).toBe('barberx')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'hero.title',
      'about.eyebrow', 'about.title', 'about.copy',
      'service.eyebrow', 'service.title',
      'price.eyebrow', 'price.title',
      'team.eyebrow', 'team.title',
      'booking.eyebrow', 'booking.title',
      'blog.eyebrow', 'blog.title',
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

  it('colour + font defaults are the EXACT vendor token values; logo has none', () => {
    expect(get('color.primary').default).toBe('#D5B981')
    expect(get('color.bg').default).toBe('#ffffff')
    expect(get('color.fg').default).toBe('#797979')
    expect(get('color.accent').default).toBe('#1d2434')
    expect(get('font.body').default).toBe("'Open Sans', sans-serif")
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings', () => {
    expect(get('hero.title').default).toBe('HTML5 Template for Salon Website')
    expect(get('about.eyebrow').default).toBe('Learn About Us')
    expect(get('about.title').default).toBe('25 Years Experience')
    expect(get('service.eyebrow').default).toBe('Our Salon Services')
    expect(get('service.title').default).toBe('Best Salon and Barber Services for You')
    expect(get('price.eyebrow').default).toBe('Our Best Pricing')
    expect(get('price.title').default).toBe('We Provide Best Price in the City')
    expect(get('team.eyebrow').default).toBe('Our Barber Team')
    expect(get('team.title').default).toBe('Meet Our Hair Cut Expert Barber')
    // booking band heading folded verbatim from contact.html (the same form's heading).
    expect(get('booking.eyebrow').default).toBe('Get In Touch')
    expect(get('booking.title').default).toBe('If You Have Any Query, Please Contact Us')
    expect(get('blog.eyebrow').default).toBe('Latest From Blog')
    expect(get('blog.title').default).toBe('Learn More from Latest Barber Blog')
    expect(get('hero.image').default).toBe('/sajtbyggare/barberx/img/hero.png')
    expect(get('about.image').default).toBe('/sajtbyggare/barberx/img/about.jpg')
  })

  it('every text/image default appears verbatim in the page HTML', () => {
    for (const r of regions) {
      if ((r.type === 'text' || r.type === 'image') && typeof r.default === 'string') {
        expect(BARBERX_PAGE_HTML, `default not in page: ${r.key}`).toContain(r.default)
      }
    }
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('barberx')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(BARBERX_PAGE_HTML, BARBERX_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(BARBERX_REGION_MANIFEST, {
  verticalDefaults: { 'about.eyebrow': '— Frisör (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Vår salong: egen rubrik' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('barberx MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of BARBERX_REGION_MANIFEST.regions) {
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

  it('about.title → Universal (look) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})

// ── 6. RENDER-BRON round-trip: PAGE_HTML actually parses + the marker swaps ───
// Proves the verbatim vendor HTML parses through html-react-parser without
// throwing AND that the booking marker is REPLACED by a live module node (not
// degraded to an orphan <span data-corevo-module-missing>). The "render-bevisa" gate.
describe('barberx render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderTemplate(BARBERX_PAGE_HTML, {
        booking: createElement('div', { 'data-testid': 'booking-mounted' }),
      }),
    ),
  )

  it('parses the full vendor HTML through the render-bridge (body content renders)', () => {
    expect(out).toContain('If You Have Any Query, Please Contact Us')
    expect(out).toContain('HTML Codex') // footer credit near the end → whole doc parsed
  })

  it('swaps the booking marker for the live module (no orphaned/missing marker)', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
