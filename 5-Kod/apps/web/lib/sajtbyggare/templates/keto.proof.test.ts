// keto — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for keto means THIS file is green. It asserts the template's
// UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 17 editable-region identities (key + type + binding),
//                  proven against a real DOM render.
//   2. booking   — the booking variant the template mounts (type=booking,
//                  pos=booking — the "Book a Room Online" mount that REPLACED the
//                  vendor <form class="book_now">).
//   3. canon     — the exact hex/font values LIFTED from the vendor CSS
//                  (#fe0000 / #ffffff / #666666 / 'Poppins'); drift = FAIL, and no
//                  colour/font literal exists that the vendor CSS lacks.
//   4. coverage  — every vendor content section is structurally reproduced.
//
// keto specifics asserted here (what makes it NOT a copy of carserv):
//   - hero is IMAGE-ONLY (Bootstrap carousel, no caption text) → no hero.title.
//   - keto's home page has THREE <form>s; ONLY the booking form is replaced by the
//     module — the Contact (`main_form`) + Newsletter (`bottom_form`) forms are the
//     template's own content and are kept verbatim (so 2 <form> tags remain).
//   - the JS-driven full-screen preloader (.loader_bg) is stripped (static-first).
//   - attribution = html.design (Free Html Templates) + themewagon.com.
//
// Patterns reused: manifest/salvia.test.ts (conformance), marked-regions.dom.test.ts
// (render proof), _optimize/proof-kit.ts (shared structural spine), carserv.proof.test.ts.

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { KETO_PAGE_HTML } from './keto'
import { KETO_REGION_MANIFEST } from '../manifest/keto'
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
const { regions } = KETO_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(KETO_REGION_MANIFEST, KETO_PAGE_HTML)

const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('keto template — render-proof invariants', () => {
  it('KETO_PAGE_HTML is a non-empty string', () => {
    expect(typeof KETO_PAGE_HTML).toBe('string')
    expect(KETO_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(KETO_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(KETO_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(KETO_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + the preloader + the navbar-toggler (static-first)', () => {
    expect(KETO_PAGE_HTML).not.toContain('<script')
    expect(KETO_PAGE_HTML).not.toContain('loader_bg')
    expect(KETO_PAGE_HTML).not.toContain('class="loader"')
    expect(KETO_PAGE_HTML).not.toContain('navbar-toggler')
    expect(KETO_PAGE_HTML).not.toContain('data-toggle')
    expect(KETO_PAGE_HTML).not.toContain('data-target')
  })

  it('keeps the inert Bootstrap carousel markup verbatim (renders first slide statically)', () => {
    // data-ride / data-slide / data-slide-to are NOT in the enumerated JS-only strip
    // set — kept inert (no JS loaded). All 3 slides + indicators + prev/next survive.
    expect(KETO_PAGE_HTML).toContain('id="myCarousel"')
    expect(KETO_PAGE_HTML).toContain('data-ride="carousel"')
    expect(KETO_PAGE_HTML).toContain('carousel-indicators')
    expect(KETO_PAGE_HTML).toContain('data-slide="prev"')
    expect(KETO_PAGE_HTML).toContain('images/banner1.jpg')
    expect(KETO_PAGE_HTML).toContain('images/banner3.jpg')
  })

  it('REPLACES only the booking <form class="book_now"> with the module (heading kept)', () => {
    // The banner booking form is gone (its class/inputs/button removed)…
    expect(KETO_PAGE_HTML).not.toContain('book_now')
    expect(KETO_PAGE_HTML).not.toContain('book_btn')
    expect(KETO_PAGE_HTML).not.toContain('online_book')
    expect(KETO_PAGE_HTML).not.toContain('Book Now')
    // …but the surrounding column + heading are kept verbatim, with the module woven.
    expect(KETO_PAGE_HTML).toContain('book_room')
    expect(KETO_PAGE_HTML).toContain('Book a Room Online')
    expect(KETO_PAGE_HTML).toContain('id="booking"')
  })

  it('keeps the Contact + Newsletter forms (the look’s own content) — exactly 2 forms remain', () => {
    // keto has 3 native <form>s; only the booking one is replaced. The Contact
    // (main_form) + footer Newsletter (bottom_form) are vendor content, kept verbatim.
    expect(KETO_PAGE_HTML).toContain('class="main_form"')
    expect(KETO_PAGE_HTML).toContain('class="bottom_form"')
    expect((KETO_PAGE_HTML.match(/<form\b/g) ?? [])).toHaveLength(2)
  })

  it('rewrites all image assets to the served public path (no bare vendor images/ refs)', () => {
    expect(KETO_PAGE_HTML).toContain('/sajtbyggare/keto/images/')
    expect(KETO_PAGE_HTML).not.toMatch(/src=["']images\//)
  })

  it('keeps the vendor attribution (kräver-kredit licence)', () => {
    expect(KETO_PAGE_HTML).toContain('html.design')
    expect(KETO_PAGE_HTML).toContain('themewagon.com')
    expect(KETO_PAGE_HTML).toContain('Free Html Templates')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('keto booking variant', () => {
  it('mounts the booking module at the booking position', () => {
    const marker = firstModuleMarker(KETO_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('booking')
  })
})

// ── 3. SECTION COVERAGE (structural, keto-specific) ──────────────────────────
describe('keto section coverage', () => {
  const lc = KETO_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    'header-nav': lc.includes('navbar-nav') && lc.includes('logo_section') && lc.includes('our room'),
    'banner-booking':
      /<corevo-module\b[^>]*type=["']booking["']/.test(KETO_PAGE_HTML) &&
      lc.includes('id="booking"') &&
      lc.includes('book a room online'),
    about: lc.includes('class="about"') && lc.includes('about us') && lc.includes('the passage experienced a surge'),
    room: lc.includes('our_room') && lc.includes('our room') && lc.includes('bed room'),
    gallery: lc.includes('class="gallery"') && lc.includes('gallery_img'),
    blog: lc.includes('class="blog"') && lc.includes('blog_box') && lc.includes('the standard chunk'),
    contact: lc.includes('class="contact"') && lc.includes('contact us') && lc.includes('main_form'),
    footer: lc.includes('<footer>') && lc.includes('menu link') && lc.includes('news letter'),
  }
  it('reproduces every vendor content section (8/8)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('KETO_REGION_MANIFEST', () => {
  it('targets the keto template', () => {
    expect(KETO_REGION_MANIFEST.templateKey).toBe('keto')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'booking.title',
      'about.title', 'about.copy',
      'room.title', 'room.copy',
      'gallery.title',
      'blog.title', 'blog.copy',
      'contact.title',
      'hero.image', 'about.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
    expect(regions).toHaveLength(17)
  })

  it('has no hero.title (keto’s hero is an image-only carousel)', () => {
    expect(regions.find((r) => r.key === 'hero.title')).toBeUndefined()
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
    expect(get('color.primary').default).toBe('#fe0000')
    expect(get('color.bg').default).toBe('#ffffff')
    expect(get('color.fg').default).toBe('#666666')
    expect(get('color.accent').default).toBe('#fe0000')
    expect(get('font.body').default).toBe("'Poppins', sans-serif")
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings', () => {
    expect(get('booking.title').default).toBe('Book a Room Online')
    expect(get('about.title').default).toBe('About Us')
    expect(get('room.title').default).toBe('Our Room')
    expect(get('room.copy').default).toBe('Lorem Ipsum available, but the majority have suffered')
    expect(get('gallery.title').default).toBe('gallery')
    expect(get('blog.title').default).toBe('Blog')
    expect(get('contact.title').default).toBe('Contact Us')
    expect(get('hero.image').default).toBe('/sajtbyggare/keto/images/banner1.jpg')
    expect(get('about.image').default).toBe('/sajtbyggare/keto/images/about.png')
    // every text/image default appears verbatim in the page HTML.
    for (const r of regions) {
      if ((r.type === 'text' || r.type === 'image') && typeof r.default === 'string') {
        expect(KETO_PAGE_HTML, `default not in page: ${r.key}`).toContain(r.default)
      }
    }
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('keto')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(KETO_PAGE_HTML, KETO_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(KETO_REGION_MANIFEST, {
  verticalDefaults: { 'about.title': '— Hotell (bransch-default)' }, // Bransch
  tenantCopy: { bookingTitle: 'Boka ditt rum hos oss' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('keto MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of KETO_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('booking.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="booking\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Boka ditt rum hos oss')
  })

  it('about.title → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.title"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Hotell (bransch-default)')
  })

  it('about.copy → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.copy"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})

// ── 6. RENDER-BRON round-trip: PAGE_HTML actually parses + the marker swaps ───
describe('keto render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderTemplate(KETO_PAGE_HTML, {
        booking: createElement('div', { 'data-testid': 'booking-mounted' }),
      }),
    ),
  )

  it('parses the full vendor HTML through the render-bridge (body content renders)', () => {
    expect(out).toContain('Book a Room Online')
    expect(out).toContain('Free Html Templates') // footer credit near the end → whole doc parsed
  })

  it('swaps the booking marker for the live module (no orphaned/missing marker)', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
