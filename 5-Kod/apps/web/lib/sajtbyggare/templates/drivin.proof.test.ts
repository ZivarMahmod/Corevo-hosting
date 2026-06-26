// drivin — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for drivin means THIS file is green. It asserts the
// template's UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 21 editable-region identities (key + type + layer),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the template mounts (type=booking,
//                  pos=appointment — the appointment/wizard mount, not a table).
//   3. canon     — the exact px/hex/font values LIFTED from the vendor CSS
//                  (#F3BD00 / #fff / #757575 / "Work Sans"); drift = FAIL, and
//                  no colour/font literal exists that the vendor CSS lacks.
//   4. coverage  — every vendor content section is structurally reproduced.
//
// Patterns reused: manifest/salvia.test.ts (conformance), marked-regions.dom.test.ts
// (render proof), _optimize/restoran-metrics.test.ts (structural metrics) via the
// shared _optimize/proof-kit.ts spine.

import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { DRIVIN_PAGE_HTML } from './drivin'
import { DRIVIN_REGION_MANIFEST } from '../manifest/drivin'
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
const { regions } = DRIVIN_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(DRIVIN_REGION_MANIFEST, DRIVIN_PAGE_HTML)
const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('drivin template — render-proof invariants', () => {
  it('DRIVIN_PAGE_HTML is a non-empty string', () => {
    expect(typeof DRIVIN_PAGE_HTML).toBe('string')
    expect(DRIVIN_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(DRIVIN_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(DRIVIN_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(DRIVIN_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + spinner + animation chrome (static-first)', () => {
    expect(DRIVIN_PAGE_HTML).not.toContain('<script')
    expect(DRIVIN_PAGE_HTML).not.toContain('id="spinner"')
    expect(DRIVIN_PAGE_HTML).not.toContain('data-bs-toggle')
    expect(DRIVIN_PAGE_HTML).not.toContain('data-toggle=')
    expect(DRIVIN_PAGE_HTML).not.toContain('data-wow-delay')
    expect(DRIVIN_PAGE_HTML).not.toContain('navbar-toggler')
    expect(DRIVIN_PAGE_HTML).not.toContain('class="wow')
    expect(DRIVIN_PAGE_HTML).not.toContain('back-to-top')
  })

  it('keeps the inert Bootstrap hero-carousel markup verbatim (renders first slide statically)', () => {
    // data-bs-ride / data-bs-slide are NOT in the enumerated JS-only strip set —
    // kept inert (no JS loaded). Both slides + the prev/next controls survive.
    expect(DRIVIN_PAGE_HTML).toContain('id="header-carousel"')
    expect(DRIVIN_PAGE_HTML).toContain('data-bs-ride="carousel"')
    expect(DRIVIN_PAGE_HTML).toContain('carousel-control-prev')
    expect(DRIVIN_PAGE_HTML).toContain('carousel-control-next')
  })

  it('keeps the footer newsletter <form> as static markup (the non-booking form)', () => {
    expect(DRIVIN_PAGE_HTML).toContain('<form action="">')
  })

  it('rewrites all image assets to the served public path (no bare vendor img/ refs)', () => {
    expect(DRIVIN_PAGE_HTML).toContain('/sajtbyggare/drivin/img/')
    expect(DRIVIN_PAGE_HTML).not.toMatch(/src=["']img\//)
  })

  it('keeps the vendor attribution (kräver-kredit licence)', () => {
    expect(DRIVIN_PAGE_HTML).toContain('htmlcodex.com')
    expect(DRIVIN_PAGE_HTML).toContain('themewagon.com')
  })

  it('copies the vendor typos verbatim (never "corrected")', () => {
    expect(DRIVIN_PAGE_HTML).toContain('Tranding Courses')
    expect(DRIVIN_PAGE_HTML).toContain('Afordable Fee')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('drivin booking variant', () => {
  it('mounts the booking module at the appointment position (service+staff+time vertical)', () => {
    const marker = firstModuleMarker(DRIVIN_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('appointment')
  })
})

// ── 3. SECTION COVERAGE (structural, drivin-specific) ────────────────────────
describe('drivin section coverage', () => {
  const lc = DRIVIN_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    topbar: lc.includes('mon - fri'),
    'navbar-hero': lc.includes('navbar') && lc.includes('learn to drive with confidence'),
    facts: lc.includes('facts') && lc.includes('national instructor'),
    about: lc.includes('we help students to pass test'),
    courses: lc.includes('courses-item') && lc.includes('our courses upskill you'),
    appointment: /<corevo-module\b[^>]*type=["']booking["']/.test(DRIVIN_PAGE_HTML) && lc.includes('id="appointment"'),
    features: lc.includes('best driving training agency in your city'),
    team: lc.includes('team-item') && lc.includes('we have great experience of driving'),
    testimonial: lc.includes('testimonial-item') && lc.includes('what our clients say'),
    footer: lc.includes('bg-dark text-light footer'),
    copyright: lc.includes('copyright'),
  }
  it('reproduces every vendor content section (11/11)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('DRIVIN_REGION_MANIFEST', () => {
  it('targets the drivin template', () => {
    expect(DRIVIN_REGION_MANIFEST.templateKey).toBe('drivin')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'hero.title',
      'about.eyebrow', 'about.title', 'about.copy',
      'courses.eyebrow', 'courses.title',
      'feature.eyebrow', 'feature.title',
      'appointment.title',
      'team.eyebrow', 'team.title',
      'testimonial.eyebrow', 'testimonial.title',
      'hero.image', 'about.image',
      'color.primary', 'color.bg', 'color.fg', 'color.accent',
      'font.body',
      'logo',
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
    expect(regions).toHaveLength(21)
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
    expect(get('color.primary').default).toBe('#F3BD00')
    expect(get('color.bg').default).toBe('#fff')
    expect(get('color.fg').default).toBe('#757575')
    expect(get('color.accent').default).toBe('#F3BD00')
    expect(get('font.body').default).toBe('"Work Sans", sans-serif')
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings (incl. the typos)', () => {
    expect(get('hero.title').default).toBe('Learn To Drive With Confidence')
    expect(get('about.title').default).toBe('We Help Students To Pass Test & Get A License On The First Try')
    expect(get('courses.eyebrow').default).toBe('Tranding Courses')
    expect(get('appointment.title').default).toBe('Make Appointment')
    expect(get('hero.image').default).toBe('/sajtbyggare/drivin/img/carousel-1.jpg')
    expect(get('about.image').default).toBe('/sajtbyggare/drivin/img/about-1.jpg')
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('drivin')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(DRIVIN_PAGE_HTML, DRIVIN_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(DRIVIN_REGION_MANIFEST, {
  verticalDefaults: { 'about.eyebrow': '— Trafikskola (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Vår trafikskola: egen rubrik' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('drivin MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of DRIVIN_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('hero.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="hero\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Vår trafikskola: egen rubrik')
  })

  it('about.eyebrow → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.eyebrow"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Trafikskola (bransch-default)')
  })

  it('about.title → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})

// ── 6. RENDER-BRON round-trip: PAGE_HTML actually parses + the marker swaps ───
// Proves the verbatim vendor HTML parses through html-react-parser without
// throwing AND that the booking marker is REPLACED by a live module node (not
// degraded to an orphan <span data-corevo-module-missing>). The "render-bevisa" gate.
describe('drivin render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      renderTemplate(DRIVIN_PAGE_HTML, {
        booking: createElement('div', { 'data-testid': 'booking-mounted' }),
      }),
    ),
  )

  it('parses the full vendor HTML through the render-bridge (body content renders)', () => {
    expect(out).toContain('Learn To Drive With Confidence')
    expect(out).toContain('HTML Codex') // footer credit near the end → whole doc parsed
  })

  it('swaps the booking marker for the live module (no orphaned/missing marker)', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
