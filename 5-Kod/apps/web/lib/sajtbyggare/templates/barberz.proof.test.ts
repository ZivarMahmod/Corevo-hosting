// barberz — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for barberz means THIS file is green. It asserts the look's
// UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 18 editable-region identities (key + type + binding),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the look mounts (type=booking, pos=booking):
//                  the folded contact/appointment form, replaced by the module.
//   3. canon     — the exact hex/font values LIFTED from the vendor CSS
//                  (#dc3545 / #fff / #364d59 / #6c757d / "DM Sans"); drift = FAIL,
//                  and no colour/font literal exists that the vendor CSS lacks.
//   4. coverage  — every vendor home section is structurally reproduced, and the
//                  folded booking band carries the verbatim vendor heading.
//
// Barberz (Colorlib, CC BY 3.0) is a barbershop look. Its home page has NO native
// appointment form (only a footer Newsletter), so the template's OWN contact form
// section (contact.html) is folded in as the booking band and its <form> replaced
// by the marker. Patterns reused from carserv.proof.test.ts via _optimize/proof-kit.

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { BARBERZ_PAGE_HTML } from './barberz'
import { BARBERZ_REGION_MANIFEST } from '../manifest/barberz'
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
const { regions } = BARBERZ_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(BARBERZ_REGION_MANIFEST, BARBERZ_PAGE_HTML)

const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('barberz template — render-proof invariants', () => {
  it('BARBERZ_PAGE_HTML is a non-empty string', () => {
    expect(typeof BARBERZ_PAGE_HTML).toBe('string')
    expect(BARBERZ_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(BARBERZ_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(BARBERZ_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(BARBERZ_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + chrome (static-first)', () => {
    expect(BARBERZ_PAGE_HTML).not.toContain('<script')
    expect(BARBERZ_PAGE_HTML).not.toContain('id="spinner"')
    expect(BARBERZ_PAGE_HTML).not.toContain('navbar-toggler')
    expect(BARBERZ_PAGE_HTML).not.toContain('data-spy')
    expect(BARBERZ_PAGE_HTML).not.toContain('data-toggle')
  })

  it('keeps the inert stellar-parallax background markup (renders statically, no JS)', () => {
    // data-stellar-background-ratio is NOT in the JS-only strip set — kept inert
    // (the hero cover + section-3 bands still show their background images).
    expect(BARBERZ_PAGE_HTML).toContain('data-stellar-background-ratio')
  })

  it('the contact/appointment form is REPLACED by the module + newsletter is static (NO form survives)', () => {
    // The folded contact form became the booking marker; the footer Newsletter is a
    // static <div> (no <form> tag). After the weave: zero forms, one booking marker.
    expect(BARBERZ_PAGE_HTML).not.toContain('<form')
    expect(BARBERZ_PAGE_HTML).not.toContain('Write your message.')
    expect(BARBERZ_PAGE_HTML).not.toContain('Send Message')
  })

  it('rewrites all image assets to the served public path (no bare vendor images/ refs)', () => {
    expect(BARBERZ_PAGE_HTML).toContain('/sajtbyggare/barberz/images/')
    expect(BARBERZ_PAGE_HTML).not.toMatch(/src=["']images\//)
    expect(BARBERZ_PAGE_HTML).not.toMatch(/url\((["']?)images\//)
  })

  it('keeps the Colorlib attribution (kräver-kredit, CC BY 3.0)', () => {
    expect(BARBERZ_PAGE_HTML).toContain('colorlib.com')
    expect(BARBERZ_PAGE_HTML).toContain('CC BY 3.0')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('barberz booking variant', () => {
  it('mounts the booking module at the booking position (service+staff+time vertical)', () => {
    const marker = firstModuleMarker(BARBERZ_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('booking')
  })
})

// ── 3. SECTION COVERAGE (structural, barberz-specific) ───────────────────────
describe('barberz section coverage', () => {
  const lc = BARBERZ_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    'navbar-hero': lc.includes('site-navbar') && lc.includes('more than just a haircut'),
    about: lc.includes('img-years') && lc.includes('welcome to barberz!'),
    'services-pricing': lc.includes('id="services"') && lc.includes('services &amp; pricing') && lc.includes("men's cut"),
    hairstyles: lc.includes('hair-style') && lc.includes('more hair styles') && lc.includes('beard shaving'),
    'more-services': lc.includes('service-1') && lc.includes('more services') && lc.includes('facial &amp; body care'),
    testimonial: lc.includes('testimonial-2') && lc.includes('our top client says') && lc.includes('mike fisher'),
    blog: lc.includes('id="blog"') && lc.includes('our blog') && lc.includes('post-entry-1'),
    cta: lc.includes('quality haircut') && lc.includes('contact us now'),
    booking:
      /<corevo-module\b[^>]*type=["']booking["']/.test(BARBERZ_PAGE_HTML) &&
      lc.includes('id="booking"') &&
      lc.includes('contact us or use this form to rent a car') &&
      lc.includes('contact info'),
    footer: lc.includes('site-footer') && lc.includes('made with'),
  }
  it('reproduces every vendor content section (10/10, incl. the folded booking band)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('BARBERZ_REGION_MANIFEST', () => {
  it('targets the barberz template', () => {
    expect(BARBERZ_REGION_MANIFEST.templateKey).toBe('barberz')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'hero.title',
      'about.title', 'about.copy',
      'services.title',
      'hairstyles.title',
      'moreservices.title',
      'testimonial.title',
      'blog.title',
      'cta.title',
      'booking.title',
      'hero.image', 'about.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
    expect(regions).toHaveLength(18)
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
    expect(get('color.primary').default).toBe('#dc3545')
    expect(get('color.bg').default).toBe('#fff')
    expect(get('color.fg').default).toBe('#364d59')
    expect(get('color.accent').default).toBe('#6c757d')
    expect(get('font.body').default).toBe(
      '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    )
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings', () => {
    expect(get('hero.title').default).toBe('More Than Just A Haircut')
    expect(get('about.title').default).toBe('Welcome To Barberz!')
    expect(get('about.copy').default).toBe(
      'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Iure nesciunt nemo vel earum maxime neque!',
    )
    expect(get('services.title').default).toBe('Services & Pricing')
    expect(get('booking.title').default).toBe('Contact Us Or Use This Form To Rent A Car')
    expect(get('hero.image').default).toBe('/sajtbyggare/barberz/images/hero_1.jpg')
    expect(get('about.image').default).toBe('/sajtbyggare/barberz/images/img_1.jpg')
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('barberz')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(BARBERZ_PAGE_HTML, BARBERZ_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(BARBERZ_REGION_MANIFEST, {
  verticalDefaults: { 'about.title': '— Frisör (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Vår frisörsalong: egen rubrik' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('barberz MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of BARBERZ_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('hero.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="hero\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Vår frisörsalong: egen rubrik')
  })

  it('about.title → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.title"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Frisör (bransch-default)')
  })

  it('services.title → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="services\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})

// ── 6. RENDER-BRON round-trip: PAGE_HTML actually parses + the marker swaps ───
describe('barberz render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderTemplate(BARBERZ_PAGE_HTML, {
        booking: createElement('div', { 'data-testid': 'booking-mounted' }),
      }),
    ),
  )

  it('parses the full vendor HTML through the render-bridge (body content renders)', () => {
    expect(out).toContain('More Than Just A Haircut')
    expect(out).toContain('Colorlib') // footer credit near the end → whole doc parsed
  })

  it('swaps the booking marker for the live module (no orphaned/missing marker)', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
