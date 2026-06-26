// ce-optimize — restoran fidelity METRICS + render-proof (Sajtbyggare pilot).
//
// This is the STAGE-1 half of the measure-restoran harness: a pure, TS-aware
// vitest that (a) ASSERTS the always-true invariants of OUR restoran template
// (its pass/fail IS the render_proof signal the orchestrator gates on) and
// (b) writes EVERY computed metric to _optimize/.last-metrics.json for the node
// harness (measure-restoran.mjs) to merge with the Playwright deviations.
//
// Hard rules honoured here:
//  - templates/restoran.ts is READ-ONLY (imported as data, never mutated).
//  - manifest/restoran.ts must NOT exist at baseline; we dynamic-import it in a
//    try/catch so its ABSENCE is the correct baseline (editable_regions = 0),
//    never a test failure. If a restoran manifest ever lands, we conform-check
//    it against the RegionManifest contract (mirrors salvia.test.ts).
//  - We assert ONLY invariants. Gate thresholds (editable_regions >= 1, coverage
//    floors, …) are NOT asserted — those are GATES the orchestrator reads from
//    the JSON, not properties of the baseline.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RESTORAN_PAGE_HTML } from '../templates/restoran'
import type { Region, RegionManifest, RegionType } from '../manifest/types'

const HERE = dirname(fileURLToPath(import.meta.url))
const METRICS_PATH = join(HERE, '.last-metrics.json')

/** Module types the render-bridge knows how to weave. A `<corevo-module>` whose
 *  `type` is in this set is a RESOLVED weave target; anything else is an
 *  unresolved/orphaned marker. */
const KNOWN_MODULES = ['booking', 'shop', 'offert', 'lojalitet', 'presentkort', 'blogg'] as const
const KNOWN_SET = new Set<string>(KNOWN_MODULES)

const VALID_REGION_TYPES: RegionType[] = ['text', 'image', 'color', 'font', 'logo']

/** The 8 vendor content sections (index.html `<!-- X Start/End -->` blocks). */
const VENDOR_SECTIONS = [
  'navbar-hero',
  'service',
  'about',
  'menu',
  'reservation',
  'team',
  'testimonial',
  'footer',
] as const

// ── vendor CSS source-of-truth (read once) ──────────────────────────────────
// The token-mismatch metric measures hardcoded colour/font LITERALS in OUR
// template (and any manifest defaults) that the vendor stylesheet does NOT
// contain. At baseline OUR template carries no inline hex/font literals (it uses
// vendor CSS classes), so this must be 0.
const VENDOR_CSS = (() => {
  const base = join(HERE, '..', '..', '..', 'public', 'sajtbyggare', 'restoran', 'css')
  let css = ''
  for (const f of ['style.css', 'bootstrap.min.css']) {
    const p = join(base, f)
    if (existsSync(p)) css += '\n' + readFileSync(p, 'utf8')
  }
  return css
})()
const VENDOR_CSS_LC = VENDOR_CSS.toLowerCase()

/** All `<corevo-module ... type="X">` marker types, in document order. */
function moduleMarkerTypes(html: string): string[] {
  const out: string[] = []
  const re = /<corevo-module\b[^>]*\btype=["']([^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) out.push(m[1]!)
  return out
}

/** Hex colour + font-family literals hardcoded in a chunk of template/JSON text. */
function extractTokenLiterals(text: string): string[] {
  const literals: string[] = []
  // hex colours (#abc / #aabbcc / #aabbccdd)
  for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) literals.push(m[0])
  // explicit font-family declarations: font-family: <value> ;
  for (const m of text.matchAll(/font-family\s*:\s*([^;"'`}]+)/gi)) {
    for (const fam of (m[1] ?? '').split(',')) {
      const f = fam.trim().replace(/^["']|["']$/g, '')
      if (f) literals.push(f)
    }
  }
  return literals
}

/** Count colour/font literals NOT present in the vendor stylesheet. */
function countTokenMismatches(text: string): number {
  let n = 0
  for (const lit of extractTokenLiterals(text)) {
    if (!VENDOR_CSS_LC.includes(lit.toLowerCase())) n++
  }
  return n
}

/** Which of the 8 vendor sections does OUR html STRUCTURALLY reproduce?
 *
 *  Detection uses STRUCTURAL/CONTENT signals ONLY — the class/heading/component
 *  that actually renders a section's real content. It deliberately does NOT key
 *  off nav-link label text ('>Service</a>'), bare in-page anchors ('#about'), or
 *  decorative asset filenames ('about-1.jpg'): those are present in OUR template
 *  as navigation/decoration WITHOUT the corresponding section ever being built,
 *  so counting them lets an optimizer inflate coverage by editing link labels
 *  alone — zero real fidelity gain. Each predicate below must therefore fire ONLY
 *  when the section's content block is genuinely present.
 *
 *  OUR template reproduces exactly navbar-hero, reservation, footer → 3/8 = 0.375.
 */
function detectSections(html: string): Record<string, boolean> {
  const lc = html.toLowerCase()
  const hasBookingMarker = /<corevo-module\b[^>]*type=["']booking["']/.test(html)
  return {
    // navbar + a hero h1 (display-3 / hero-header heading) — structural
    'navbar-hero': lc.includes('navbar') && /class=["'][^"']*display-3/.test(lc),
    // service = the actual service-card component (vendor `.service-item`)
    service: lc.includes('service-item'),
    // about = a real "About Us" copy block (vendor's about section heading),
    // NOT the 'about-1' decorative filename or an '#about'/nav-link reference
    about: lc.includes('about us'),
    // menu = the food-menu component (vendor's "Food Menu" title / `.tab-class`)
    menu: lc.includes('food menu') || lc.includes('tab-class'),
    // reservation = the booking marker, or an id="reservation"
    reservation: hasBookingMarker || /id=["']reservation["']/.test(lc),
    // team = the team-card component (vendor `.team-item` / "Our Master Chefs")
    team: lc.includes('team-item') || lc.includes('master chefs'),
    // testimonial = the testimonial CAROUSEL/component, not the bare word
    testimonial: lc.includes('testimonial-carousel') || lc.includes('testimonial-item'),
    // footer = bottom dark/footer chrome block
    footer: lc.includes('class="container-fluid bg-dark') || lc.includes('footer'),
  }
}

// ── load any restoran manifest (ABSENT at baseline → null, which is correct) ──
let restoranManifest: RegionManifest | null = null
let manifestLoadError: string | null = null
try {
  const mod: unknown = await import('../manifest/restoran').catch(() => null)
  if (mod && typeof mod === 'object') {
    const candidate = Object.values(mod as Record<string, unknown>).find(
      (v): v is RegionManifest =>
        !!v && typeof v === 'object' && 'templateKey' in (v as object) && 'regions' in (v as object),
    )
    restoranManifest = candidate ?? null
  }
} catch (err) {
  manifestLoadError = err instanceof Error ? err.message : String(err)
}

// ── compute metrics ─────────────────────────────────────────────────────────
const markerTypes = moduleMarkerTypes(RESTORAN_PAGE_HTML)
const modulesWoven = markerTypes.filter((t) => KNOWN_SET.has(t)).length
const unresolvedModuleMarkers = markerTypes.filter((t) => !KNOWN_SET.has(t)).length
const editableRegions = restoranManifest?.regions.length ?? 0

const sectionFlags = detectSections(RESTORAN_PAGE_HTML)
const sectionsReproduced = VENDOR_SECTIONS.filter((s) => sectionFlags[s]).length
const sectionCoverage = sectionsReproduced / VENDOR_SECTIONS.length

// dom_node_count is a PURELY DESCRIPTIVE structural counter (opening tags). It is
// NOT a fidelity gate and MUST NOT be thresholded by any experiment: it is
// trivially inflatable by adding empty <div>s and conveys no fidelity meaning on
// its own. Emitted only so the JSON shape stays stable for downstream tooling.
const domNodeCount = (RESTORAN_PAGE_HTML.match(/<[a-zA-Z]/g) || []).length

// token mismatches: OUR template + (any) manifest COLOUR/FONT defaults vs vendor CSS.
// FIX (orchestrator, post-exp1): only `color` and `font` region defaults are TOKENS.
// `text` defaults are page copy and `image` defaults are asset paths — neither is a
// token and neither belongs in the CSS, so the prior "wrap every default in
// font-family:" scan produced false mismatches (e.g. a heading flagged as a font).
// Colour defaults are scanned as hex literals; font defaults as a font-family value.
// Baseline is unaffected (no manifest → this loop is skipped → still 0), so the
// metric stays comparable across the run while now measuring what its name claims.
let tokenScanText = RESTORAN_PAGE_HTML
if (restoranManifest) {
  for (const r of restoranManifest.regions) {
    if (!r.default) continue
    if (r.type === 'color') tokenScanText += '\n' + r.default
    else if (r.type === 'font') tokenScanText += '\nfont-family: ' + r.default + ';'
  }
}
const exactTokenMismatches = countTokenMismatches(tokenScanText)

const metrics = {
  modules_woven: modulesWoven,
  unresolved_module_markers: unresolvedModuleMarkers,
  editable_regions: editableRegions,
  section_coverage: sectionCoverage,
  section_coverage_detail: sectionFlags,
  sections_reproduced: sectionsReproduced,
  dom_node_count: domNodeCount,
  exact_token_mismatches: exactTokenMismatches,
  manifest_present: restoranManifest !== null,
  manifest_load_error: manifestLoadError,
  _generated_at: new Date().toISOString(),
}

// Persist for the node harness to merge. Native fs (subprocess writes do NOT
// persist) — this runs inside the test process, which is the intended writer.
writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2) + '\n', 'utf8')

// ── INVARIANTS (this block's pass/fail = render_proof) ───────────────────────
describe('restoran template — render-proof invariants', () => {
  it('RESTORAN_PAGE_HTML is a non-empty string', () => {
    expect(typeof RESTORAN_PAGE_HTML).toBe('string')
    expect(RESTORAN_PAGE_HTML.length).toBeGreaterThan(0)
  })

  it('weaves exactly one booking module marker', () => {
    const bookingMarkers = (RESTORAN_PAGE_HTML.match(/<corevo-module\b[^>]*\btype=["']booking["']/g) || []).length
    expect(bookingMarkers).toBe(1)
  })

  it('has no unresolved (unknown-type) module markers', () => {
    expect(unresolvedModuleMarkers).toBe(0)
  })

  it('reproduces the reservation section (where the booking module is woven)', () => {
    expect(sectionFlags.reservation).toBe(true)
  })

  // Conditional manifest conformance — at baseline NO restoran manifest exists,
  // so this block self-skips (editable_regions = 0 is CORRECT). If one ever
  // lands it MUST satisfy the RegionManifest contract.
  describe('restoran manifest (only if present)', () => {
    it('is absent at baseline OR conforms to the RegionManifest contract', () => {
      if (!restoranManifest) {
        // Baseline: absence is correct. Assert the derived metric reflects it.
        expect(editableRegions).toBe(0)
        return
      }
      const mf = restoranManifest
      expect(mf.templateKey).toBe('restoran')
      expect(Array.isArray(mf.regions)).toBe(true)

      const keys = mf.regions.map((r: Region) => r.key)
      expect(new Set(keys).size).toBe(keys.length) // no dup keys

      for (const r of mf.regions) {
        expect(typeof r.key).toBe('string')
        expect(r.key.length).toBeGreaterThan(0)
        expect(VALID_REGION_TYPES).toContain(r.type)
        // default is string | null
        expect(r.default === null || typeof r.default === 'string').toBe(true)
        // well-formed tenantBinding
        const b = r.tenantBinding
        expect(['copy', 'branding']).toContain(b.store)
        expect(typeof b.field).toBe('string')
        expect(b.field.length).toBeGreaterThan(0)
        if (b.store === 'branding' && b.index !== undefined) {
          expect(Number.isInteger(b.index)).toBe(true)
          expect(b.index).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  it('wrote .last-metrics.json with the full metric set', () => {
    expect(existsSync(METRICS_PATH)).toBe(true)
    const parsed = JSON.parse(readFileSync(METRICS_PATH, 'utf8'))
    for (const k of [
      'modules_woven',
      'unresolved_module_markers',
      'editable_regions',
      'section_coverage',
      'dom_node_count',
      'exact_token_mismatches',
    ]) {
      expect(parsed).toHaveProperty(k)
    }
  })
})
