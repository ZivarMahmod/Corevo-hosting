// klinik — per-template render-proof SPEC (goal-36 M2).
//
// "VERIFIERAD 0FAIL" for klinik means THIS file is green. It asserts the
// template's UNIQUE shape, not a generic smoke test (the M2 false-green trap):
//   1. regions   — the exact 22 editable-region identities (key + type + layer),
//                  proven against a real DOM render with 3-layer provenance.
//   2. booking   — the booking variant the template mounts (type=booking,
//                  pos=appointment — the appointment/wizard mount, not a table).
//   3. canon     — the exact px/hex/font values LIFTED from the vendor CSS
//                  (#0463FA / #FFFFFF / #8D8E92 / "Open Sans"); drift = FAIL, and
//                  no colour/font literal exists that the vendor CSS lacks.
//   4. coverage  — every vendor content section is structurally reproduced.
//
// Patterns reused: manifest/salvia.test.ts (conformance), marked-regions.dom.test.ts
// (render proof), _optimize/restoran-metrics.test.ts (structural metrics) via the
// shared _optimize/proof-kit.ts spine.

import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { KLINIK_PAGE_HTML } from './klinik'
import { KLINIK_REGION_MANIFEST } from '../manifest/klinik'
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
const { regions } = KLINIK_REGION_MANIFEST
const get = (key: string): Region => {
  const r = regions.find((x) => x.key === key)
  if (!r) throw new Error(`region not declared: ${key}`)
  return r
}

// ── 1. TEMPLATE render-proof invariants ──────────────────────────────────────
describe('klinik template — render-proof invariants', () => {
  it('KLINIK_PAGE_HTML is a non-empty string', () => {
    expect(typeof KLINIK_PAGE_HTML).toBe('string')
    expect(KLINIK_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker, none unresolved', () => {
    expect(moduleMarkerTypes(KLINIK_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(KLINIK_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(KLINIK_PAGE_HTML)).toBe(0)
  })

  it('strips all vendor JS + spinner (static-first)', () => {
    expect(KLINIK_PAGE_HTML).not.toContain('<script')
    expect(KLINIK_PAGE_HTML).not.toContain('id="spinner"')
    expect(KLINIK_PAGE_HTML).not.toContain('data-bs-toggle')
    expect(KLINIK_PAGE_HTML).not.toContain('data-toggle=')
    expect(KLINIK_PAGE_HTML).not.toContain('data-wow-delay')
  })

  it('rewrites all image assets to the served public path (no bare vendor img/ refs)', () => {
    expect(KLINIK_PAGE_HTML).toContain('/sajtbyggare/klinik/img/')
    expect(KLINIK_PAGE_HTML).not.toMatch(/src=["']img\//)
  })

  it('keeps the vendor attribution (kräver-kredit licence)', () => {
    expect(KLINIK_PAGE_HTML).toContain('htmlcodex.com')
  })
})

// ── 2. BOOKING VARIANT (M2.2) ────────────────────────────────────────────────
describe('klinik booking variant', () => {
  it('mounts the booking module at the appointment position (service+staff+time vertical)', () => {
    const marker = firstModuleMarker(KLINIK_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
    expect(marker?.pos).toBe('appointment')
  })
})

// ── 3. SECTION COVERAGE (structural, klinik-specific) ────────────────────────
describe('klinik section coverage', () => {
  const lc = KLINIK_PAGE_HTML.toLowerCase()
  const sections: Record<string, boolean> = {
    topbar: lc.includes('mon - fri'),
    'navbar-hero': lc.includes('navbar') && lc.includes('good health is the root'),
    about: lc.includes('why you should trust us'),
    service: lc.includes('service-item') && lc.includes('health care solutions'),
    feature: lc.includes('feature-text') || lc.includes('why choose us'),
    team: lc.includes('team-item') && lc.includes('our experience doctors'),
    appointment: /<corevo-module\b[^>]*type=["']booking["']/.test(KLINIK_PAGE_HTML) && lc.includes('id="appointment"'),
    testimonial: lc.includes('testimonial-item') && lc.includes('what say our patients'),
    footer: lc.includes('bg-dark text-light footer'),
  }
  it('reproduces every vendor content section (9/9)', () => {
    for (const [name, present] of Object.entries(sections)) {
      expect(present, `section missing: ${name}`).toBe(true)
    }
  })
})

// ── 4. MANIFEST conformance + CANON tokens (M2.3) ────────────────────────────
describe('KLINIK_REGION_MANIFEST', () => {
  it('targets the klinik template', () => {
    expect(KLINIK_REGION_MANIFEST.templateKey).toBe('klinik')
  })

  it('declares exactly the expected region keys (identities, not just count)', () => {
    const expected = [
      'hero.title',
      'about.eyebrow', 'about.title', 'about.copy',
      'service.eyebrow', 'service.title',
      'feature.eyebrow', 'feature.title',
      'team.eyebrow', 'team.title',
      'appointment.eyebrow', 'appointment.title',
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

  it('colour + font defaults are the EXACT vendor token values; logo has none', () => {
    expect(get('color.primary').default).toBe('#0463FA')
    expect(get('color.bg').default).toBe('#FFFFFF')
    expect(get('color.fg').default).toBe('#8D8E92')
    expect(get('color.accent').default).toBe('#0463FA')
    expect(get('font.body').default).toBe('"Open Sans", sans-serif')
    expect(get('logo').default).toBeNull()
  })

  it('text/image defaults are the exact verbatim vendor strings (incl. the "Heppiness" typo)', () => {
    expect(get('hero.title').default).toBe('Good Health Is The Root Of All Heppiness')
    expect(get('about.title').default).toBe('Why You Should Trust Us? Get Know About Us!')
    expect(get('appointment.title').default).toBe('Make An Appointment To Visit Our Doctor')
    expect(get('hero.image').default).toBe('/sajtbyggare/klinik/img/carousel-1.jpg')
    expect(get('about.image').default).toBe('/sajtbyggare/klinik/img/about-1.jpg')
  })

  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('klinik')
    expect(vendorCssLc.length).toBeGreaterThan(0) // vendor CSS actually present
    expect(countTokenMismatches(tokenScanText(KLINIK_PAGE_HTML, KLINIK_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

// ── 5. DOM render-proof: data-editable markers + 3-layer provenance (M2.1) ────
const resolved = resolveSiteContent(KLINIK_REGION_MANIFEST, {
  verticalDefaults: { 'about.eyebrow': '— Vårdklinik (bransch-default)' }, // Bransch
  tenantCopy: { heroTitle: 'Vår klinik: egen rubrik' }, // Kund
  tenantBranding: null,
})
const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))

describe('klinik MarkedRegions DOM render-proof', () => {
  it('stamps a data-editable marker for EVERY region in the manifest', () => {
    for (const r of KLINIK_REGION_MANIFEST.regions) {
      expect(html, `missing marker: ${r.key}`).toContain(`data-editable="${r.key}"`)
    }
  })

  it('hero.title → Kund (tenant) layer, provenance modifierad, shows the override', () => {
    expect(html).toMatch(/data-editable="hero\.title"[^>]*data-provenance="modifierad"[^>]*data-source="tenant"/)
    expect(html).toContain('Vår klinik: egen rubrik')
  })

  it('about.eyebrow → Bransch (vertical) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.eyebrow"[^>]*data-provenance="standard"[^>]*data-source="vertical"/)
    expect(html).toContain('Vårdklinik (bransch-default)')
  })

  it('about.title → Universal (theme) layer, provenance standard', () => {
    expect(html).toMatch(/data-editable="about\.title"[^>]*data-provenance="standard"[^>]*data-source="universal"/)
  })
})
