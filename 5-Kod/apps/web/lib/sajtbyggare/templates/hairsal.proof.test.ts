// hairsal — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for hairsal means THIS file is green. It asserts the
// template's UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 16 editable-region identities (key + type + layer),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the template mounts (type=booking,
//                  pos=booking — the folded "Book Now" mount). The booking <form>
//                  from booking.html is REPLACED by the module (no booking field
//                  survives); the footer newsletter <form> is the only form left.
//   3. canon     — the exact hex/font values LIFTED from the vendor CSS
//                  (#8bc34a / #fff / #4d4d4d / #6c757d / "Poppins"); drift = FAIL,
//                  and no colour/font literal exists that the vendor CSS lacks.
//   4. coverage  — every vendor content section is structurally reproduced
//                  (header/hero/welcome/services/testimonial/video-CTA/booking/footer)
//                  incl. the vendor typo "Stellla Martin".
//
// Patterns reused: carserv.proof.test.ts (the htmlcodex sibling) + the shared
// _optimize/proof-kit.ts spine; same as klinik/drivin/restoran.

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { HAIRSAL_PAGE_HTML } from './hairsal'
import { HAIRSAL_REGION_MANIFEST } from '../manifest/hairsal'
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
const { regions } = HAIRSAL_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(HAIRSAL_REGION_MANIFEST, HAIRSAL_PAGE_HTML)

const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('hairsal template — render-proof invariants', () => {
  it('HAIRSAL_PAGE_HTML is a non-empty string', () => {
    expect(typeof HAIRSAL_PAGE_HTML).toBe('string')
    expect(HAIRSAL_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(HAIRSAL_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(HAIRSAL_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(HAIRSAL_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS (static-first; incl. the footer email-decode + date scripts)', () => {
    expect(HAIRSAL_PAGE_HTML).not.toContain('<script')
    expect(HAIRSAL_PAGE_HTML).not.toContain('email-decode')
    expect(HAIRSAL_PAGE_HTML).not.toContain('js/main.js')
  })

  it('folds booking.html’s <form> into the page and REPLACES it with the module (no booking field survives)', () => {
    // The folded booking <form> body is gone — only the module + the kept heading remain.
    expect(HAIRSAL_PAGE_HTML).not.toContain('Service You Want')
    expect(HAIRSAL_PAGE_HTML).not.toContain('id="treatment"')
    expect(HAIRSAL_PAGE_HTML).not.toContain('Write your notes or questions here')
    expect(HAIRSAL_PAGE_HTML).toContain('<corevo-module type="booking" pos="booking">')
    expect(HAIRSAL_PAGE_HTML).toContain('id="booking"')
    // The booking section keeps its heading + the booking page’s contact column.
    expect(HAIRSAL_PAGE_HTML).toContain('Book Now')
    expect(HAIRSAL_PAGE_HTML).toContain('203 Fake St. Mountain View, San Francisco, California, USA')
    expect(HAIRSAL_PAGE_HTML).toContain('More Info')
  })

  it('keeps the footer newsletter <form> as the ONLY surviving form (vendor home markup, verbatim)', () => {
    expect(HAIRSAL_PAGE_HTML).toContain('Subscribe Newsletter')
    expect(HAIRSAL_PAGE_HTML).toContain('<form action="#" method="post">')
    // Exactly one <form> tag remains in the woven page (the newsletter).
    expect((HAIRSAL_PAGE_HTML.match(/<form\b/gi) ?? [])).toHaveLength(1)
  })

  it('rewrites all image assets to the served public path (no bare vendor images/ refs)', () => {
    expect(HAIRSAL_PAGE_HTML).toContain('/sajtbyggare/hairsal/images/')
    expect(HAIRSAL_PAGE_HTML).not.toMatch(/["'(]images\//)
  })

  it('keeps the vendor attribution (Colorlib backlink + CC BY 3.0 licence note)', () => {
    expect(HAIRSAL_PAGE_HTML).toContain('colorlib.com')
    expect(HAIRSAL_PAGE_HTML).toContain('CC BY 3.0')
  })

  it('copies the vendor typo verbatim (never "corrected")', () => {
    expect(HAIRSAL_PAGE_HTML).toContain('Stellla Martin') // triple-l, vendor typo
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('hairsal booking variant', () => {
  it('mounts the booking module at the folded booking position', () => {
    const marker = firstModuleMarker(HAIRSAL_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('booking')
  })
})

// ── 3. SECTION COVERAGE (structural, hairsal-specific; lowercase sentinels) ───
describe('hairsal section coverage', () => {
  const lc = HAIRSAL_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    'header-nav': lc.includes('site-navbar') && lc.includes('>hairsal<') && lc.includes('book online'),
    hero: lc.includes('home-slider') && lc.includes('welcome to hairsal') && lc.includes('hair salon expert') && lc.includes('beautiful hair, healthy you!'),
    welcome: lc.includes('opening hours') && lc.includes('incidunt architecto') && lc.includes('10:00 am'),
    services: lc.includes('featured services') && lc.includes('barber razor') && lc.includes('location pin') && lc.includes('barber shave'),
    testimonial: lc.includes('new hairstyle!') && lc.includes('stellla martin'),
    'video-cta': lc.includes('experience our outstanding services'),
    booking: /<corevo-module\b[^>]*type=["']booking["']/.test(HAIRSAL_PAGE_HTML) && lc.includes('id="booking"') && lc.includes('book now'),
    footer: lc.includes('site-footer') && lc.includes('about hairsal') && lc.includes('quick menu') && lc.includes('subscribe newsletter'),
  }
  it('reproduces every vendor content section (8/8, incl. the folded booking)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('HAIRSAL_REGION_MANIFEST', () => {
  it('targets the hairsal template', () => {
    expect(HAIRSAL_REGION_MANIFEST.templateKey).toBe('hairsal')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'hero.title',
      'welcome.title', 'welcome.copy',
      'services.title',
      'testimonial.title',
      'booking.title',
      'about.title', 'about.copy',
      'hero.image', 'about.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
    expect(regions).toHaveLength(16)
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
    expect(get('color.primary').default).toBe('#8bc34a')
    expect(get('color.bg').default).toBe('#fff')
    expect(get('color.fg').default).toBe('#4d4d4d')
    expect(get('color.accent').default).toBe('#6c757d')
    expect(get('font.body').default).toBe('"Poppins", sans-serif')
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings', () => {
    expect(get('hero.title').default).toBe('Hair Salon Expert')
    expect(get('welcome.title').default).toBe('Welcome to Hair Salon')
    expect(get('welcome.copy').default).toBe('Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt architecto ab hic rem placeat eius commodi eum eligendi recusandae sed qui cumque quibusdam.')
    expect(get('services.title').default).toBe('Featured Services')
    expect(get('testimonial.title').default).toBe('New hairstyle!')
    expect(get('booking.title').default).toBe('Book Now')
    expect(get('about.title').default).toBe('About Hairsal')
    expect(get('hero.image').default).toBe('/sajtbyggare/hairsal/images/hero_bg_1.jpg')
    expect(get('about.image').default).toBe('/sajtbyggare/hairsal/images/person_1.jpg')
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('hairsal')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(HAIRSAL_PAGE_HTML, HAIRSAL_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(HAIRSAL_REGION_MANIFEST, {
  verticalDefaults: { 'welcome.title': '— Frisör (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Vår frisörsalong: egen rubrik' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('hairsal MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of HAIRSAL_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('hero.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="hero\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Vår frisörsalong: egen rubrik')
  })

  it('welcome.title → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="welcome\.title"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Frisör (bransch-default)')
  })

  it('services.title → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="services\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})

// ── 6. RENDER-BRON round-trip: PAGE_HTML actually parses + the marker swaps ───
// Proves the verbatim vendor HTML parses through html-react-parser without
// throwing AND that the booking marker is REPLACED by a live module node (not
// degraded to an orphan <span data-corevo-module-missing>). The "render-bevisa" gate.
describe('hairsal render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderTemplate(HAIRSAL_PAGE_HTML, {
        booking: createElement('div', { 'data-testid': 'booking-mounted' }),
      }),
    ),
  )

  it('parses the full vendor HTML through the render-bridge (body content renders)', () => {
    expect(out).toContain('Book Now') // folded booking heading
    expect(out).toContain('Colorlib') // footer credit link text near the end → whole doc parsed
  })

  it('swaps the booking marker for the live module (no orphaned/missing marker)', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
