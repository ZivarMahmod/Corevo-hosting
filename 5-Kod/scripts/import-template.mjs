#!/usr/bin/env node
// goal-36 R1 — import-template codemod: vendor folder → sajtbyggare look scaffold.
//
// Does the MECHANICAL, deterministic, error-prone-by-hand 80% (de-risk R1):
//   - strip vendor <script> + JS-only attrs + animation classes + chrome
//   - rewrite asset paths img/css → /sajtbyggare/<key>/...
//   - copy img/ + css/ into apps/web/public/sajtbyggare/<key>/
//   - extract CSS hrefs + canon color/font tokens from the vendor CSS
//   - emit templates/<key>.ts (PAGE_HTML + CSS_HREFS), manifest/<key>.ts (region
//     manifest: real color/font/logo regions + detected text/image candidates),
//     and templates/<key>.proof.test.ts (imports proofFloor + auto-filled token
//     assertions). Leaves `// CODEMOD-TODO:` where a per-template AGENT must judge
//     (place the booking marker, finalise text/image regions to verbatim strings).
//
// Runs OFFLINE only (Node, never in the Worker). Idempotent (overwrites scaffolds).
// Usage (from repo root):
//   node 5-Kod/scripts/import-template.mjs --src "4-Dokument-Underlag/03-template-katalog/87 carserv-1.0.0/carserv-1.0.0" --key carserv2 --page index.html
//   add --dry to print a summary without writing files.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, statSync } from 'node:fs'
import { dirname, join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url)) // …/5-Kod/scripts
const REPO_ROOT = resolve(HERE, '..', '..') // repo root (…/firsör-sas)
const APP_WEB = join(REPO_ROOT, '5-Kod', 'apps', 'web')
const LIB = join(APP_WEB, 'lib', 'sajtbyggare')

// ── arg parsing ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { page: 'index.html', dry: false }
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (t === '--src') a.src = argv[++i]
    else if (t === '--key') a.key = argv[++i]
    else if (t === '--page') a.page = argv[++i]
    else if (t === '--dry') a.dry = true
  }
  if (!a.src || !a.key) {
    console.error('usage: import-template.mjs --src <vendorDir> --key <key> [--page index.html] [--dry]')
    process.exit(2)
  }
  return a
}

// ── MECHANICAL TRANSFORMS (pure, unit-tested) ────────────────────────────────

/** JS-only attributes the 4 hand-built looks strip (kept verbatim list).
 *  NB: data-bs-ride / data-bs-slide are NOT stripped (carserv keeps the carousel
 *  markup inert) — only the toggle/target/datepicker/wow hooks go. */
const JS_ONLY_ATTRS = [
  'data-bs-toggle', 'data-bs-target', 'data-bs-dismiss', 'data-bs-parent',
  'data-toggle', 'data-target', 'data-target-input', 'data-dismiss',
  'data-wow-delay', 'data-wow-duration', 'data-src',
]

/** Animation class tokens stripped from class="" (their CSS — animate.css — is not
 *  loaded). Token-level removal: keep the other classes, trim leftover spaces. */
const ANIM_CLASS_RE = /\b(wow|animated|fadeIn\w*|fadeInUp|fadeInDown|slideIn\w*|zoomIn\w*|bounceIn\w*)\b/g

export function stripChrome(html) {
  let s = html
  // 1. all <script>…</script> (incl. self-closing / src-only)
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<script\b[^>]*\/>/gi, '')
  // 2. noscript blocks (vendor fallbacks for blocked JS)
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
  // 3. spinner overlay (id="spinner" wrapper) — full element
  s = s.replace(/<div\b[^>]*\bid=["']spinner["'][\s\S]*?<\/div>\s*<\/div>/gi, '')
  s = s.replace(/<div\b[^>]*\bid=["']spinner["'][^>]*>[\s\S]*?<\/div>/gi, '')
  // 4. back-to-top anchor
  s = s.replace(/<a\b[^>]*\bback-to-top\b[\s\S]*?<\/a>/gi, '')
  // 5. navbar-toggler button (needs JS)
  s = s.replace(/<button\b[^>]*\bnavbar-toggler\b[\s\S]*?<\/button>/gi, '')
  // 6. JS-only attributes (anywhere)
  for (const attr of JS_ONLY_ATTRS) {
    s = s.replace(new RegExp(`\\s${attr}=["'][^"']*["']`, 'gi'), '')
    s = s.replace(new RegExp(`\\s${attr}(?=[\\s>])`, 'gi'), '')
  }
  // 7. animation classes inside class="" only (don't touch text)
  s = s.replace(/class=["']([^"']*)["']/gi, (_m, cls) => {
    const cleaned = cls.replace(ANIM_CLASS_RE, '').replace(/\s{2,}/g, ' ').trim()
    return `class="${cleaned}"`
  })
  return s
}

/** Pull the <body> inner HTML (PAGE_HTML is a body fragment, not a full doc). */
export function extractBody(html) {
  const m = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  return (m ? m[1] : html).trim()
}

/** Rewrite vendor-relative asset refs to the served public path. */
export function rewriteAssets(html, key) {
  let s = html
  const base = `/sajtbyggare/${key}/`
  // src/href/data-src to img/, lib/, css/, js/, fonts/ (relative, not http/# /)
  s = s.replace(/\b(src|href)=["'](?!https?:|\/\/|#|mailto:|tel:|data:|\/)([^"']+)["']/gi, (m, attr, path) => {
    if (/^(img|css|js|lib|fonts|scss|assets|images)\//i.test(path)) return `${attr}="${base}${path}"`
    return m
  })
  // url(...) in inline styles
  s = s.replace(/url\((["']?)(?!https?:|\/\/|data:|\/)(img|assets|images|fonts)\//gi, (_m, q, d) => `url(${q}${base}${d}/`)
  // dead links
  s = s.replace(/href=["']["']/gi, 'href="#"')
  return s
}

/** Collect <link rel=stylesheet> hrefs from <head>, rewritten, dropping animate.css. */
export function extractCssHrefs(html, key) {
  const hrefs = []
  const head = (html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]) ?? html
  const re = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi
  let m
  while ((m = re.exec(head)) !== null) {
    const href = m[0].match(/\bhref=["']([^"']+)["']/i)?.[1]
    if (!href) continue
    if (/animate\.css|animate\.min\.css/i.test(href)) continue // animation CSS not loaded
    if (/^https?:|^\/\//i.test(href)) { hrefs.push(href); continue } // CDN (e.g. bootstrap-icons, fonts)
    const rel = href.replace(/^\.?\//, '')
    hrefs.push(`/sajtbyggare/${key}/${rel}`)
  }
  return hrefs
}

/** Extract canon color/font tokens from concatenated vendor CSS. */
export function extractCanonTokens(cssText) {
  const css = cssText
  const lc = css.toLowerCase()
  const find = (re) => (css.match(re)?.[1] ?? '').trim()

  // --primary custom prop (htmlcodex/themewagon use :root{--primary:#xxx})
  let primary = find(/--primary\s*:\s*([#0-9a-fA-F]{4,9})/)
  if (!primary) primary = find(/\.btn-primary\s*\{[^}]*background(?:-color)?\s*:\s*([#0-9a-fA-F]{4,9})/i)
  if (!primary) primary = find(/\.text-primary\s*\{[^}]*color\s*:\s*([#0-9a-fA-F]{4,9})/i)

  let accent = find(/--secondary\s*:\s*([#0-9a-fA-F]{4,9})/) || find(/--accent\s*:\s*([#0-9a-fA-F]{4,9})/)
  if (!accent) accent = primary

  // body background + color + font-family (bootstrap body rule)
  const bodyBlock = (lc.match(/(?:^|[}\s])body\s*\{([^}]*)\}/)?.[1]) ?? ''
  const bodyOrig = (css.match(/(?:^|[}\s])body\s*\{([^}]*)\}/)?.[1]) ?? ''
  const bg = (bodyBlock.match(/background(?:-color)?\s*:\s*([#0-9a-f]{3,9})/)?.[1] ?? '#ffffff')
  const fg = (bodyBlock.match(/(?:^|;)\s*color\s*:\s*([#0-9a-f]{3,9})/)?.[1] ?? '#000000')
  let font = (bodyOrig.match(/font-family\s*:\s*([^;]+)/)?.[1] ?? '').trim()
  if (!font) {
    // sometimes set on a var or :root
    font = find(/font-family\s*:\s*([^;]+);/)
  }
  font = font.replace(/!important/gi, '').trim()

  return {
    colorPrimary: primary || '#000000',
    colorBg: bg,
    colorFg: fg,
    colorAccent: accent || primary || '#000000',
    fontBody: font || 'sans-serif',
  }
}

/** camelCase a dotted region key's tail for the copy binding (hero.title→heroTitle). */
function copyField(key) {
  return key.replace(/\.([a-z])/g, (_m, c) => c.toUpperCase()).replace(/\./g, '')
}

/** Heuristic editable-region detection. Color/font/logo are AUTHORITATIVE (from
 *  tokens). Text/image are CANDIDATES the agent refines to verbatim vendor strings. */
export function detectRegions(body, tokens, key) {
  const regions = []
  const text = (k, def) => regions.push({ key: k, type: 'text', default: def, binding: { store: 'copy', field: copyField(k) } })

  const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
  // slug a short eyebrow → a semantic label (// About Us // → about; Our Services → service)
  const STOP = new Set(['our', 'us', 'the', 'a', 'we', 'my', 'i'])
  const slug = (eyebrow) => {
    const words = plain(eyebrow).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w))
    let w = words[0] || 'section'
    if (w.endsWith('s') && w.length > 4) w = w.slice(0, -1) // services→service, technicians→technician
    return w
  }

  // hero.title = first <h1> text
  const heroTitle = plain(body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
  if (heroTitle) text('hero.title', heroTitle)

  // section eyebrow/title pairs: an <h5|h6> "eyebrow" (htmlcodex uses text-uppercase
  // with `// … //`; themewagon uses class=section-title) followed within ~400 chars by
  // the section heading <h1|h2|h3>. Skip the hero-carousel pair (its title == heroTitle).
  const eyeRe = /<(h5|h6)\b[^>]*>([\s\S]*?)<\/\1>/gi
  const seen = new Set()
  let em
  while ((em = eyeRe.exec(body)) !== null) {
    const eyebrow = plain(em[2])
    if (!eyebrow || eyebrow.length > 60) continue
    const isEyebrow = /\/\//.test(em[2]) || /text-uppercase|section-title/i.test(em[0])
    if (!isEyebrow) continue
    const after = body.slice(em.index + em[0].length, em.index + em[0].length + 400)
    const titleM = after.match(/<(h1|h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/i)
    const title = titleM ? plain(titleM[2]) : ''
    if (title && title === heroTitle) continue // carousel eyebrow → hero, already captured
    const label = slug(eyebrow)
    if (seen.has(label)) continue
    seen.add(label)
    text(`${label}.eyebrow`, eyebrow)
    if (title) text(`${label}.title`, title)
  }

  // images: first carousel/header bg + an about image
  const imgs = [...body.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((m) => m[1])
  const hero = imgs.find((s) => /carousel|hero|header|bg-1|banner/i.test(s)) || imgs[0]
  const about = imgs.find((s) => /about/i.test(s)) || imgs[1]
  if (hero) regions.push({ key: 'hero.image', type: 'image', default: hero, binding: { store: 'branding', field: 'hero_images', index: 0 } })
  if (about) regions.push({ key: 'about.image', type: 'image', default: about, binding: { store: 'branding', field: 'about_image' } })

  // color/font/logo — authoritative from tokens
  regions.push({ key: 'color.primary', type: 'color', default: tokens.colorPrimary, binding: { store: 'branding', field: 'color_primary' } })
  regions.push({ key: 'color.bg', type: 'color', default: tokens.colorBg, binding: { store: 'branding', field: 'color_bg' } })
  regions.push({ key: 'color.fg', type: 'color', default: tokens.colorFg, binding: { store: 'branding', field: 'color_fg' } })
  regions.push({ key: 'color.accent', type: 'color', default: tokens.colorAccent, binding: { store: 'branding', field: 'color_accent' } })
  regions.push({ key: 'font.body', type: 'font', default: tokens.fontBody, binding: { store: 'branding', field: 'font_body' } })
  regions.push({ key: 'logo', type: 'logo', default: null, binding: { store: 'branding', field: 'logo_url' } })
  return regions
}

// ── EMITTERS ─────────────────────────────────────────────────────────────────
const CONST = (key) => key.toUpperCase().replace(/[^A-Z0-9]/g, '_')

function regionLine(r) {
  const def = r.default === null ? 'null' : JSON.stringify(r.default)
  const b = r.binding
  const binding = b.store === 'copy'
    ? `{ store: 'copy', field: '${b.field}' }`
    : `{ store: 'branding', field: '${b.field}'${b.index !== undefined ? `, index: ${b.index}` : ''} }`
  return `    { key: '${r.key}', type: '${r.type}', default: ${def}, tenantBinding: ${binding} },`
}

function emitTemplate(key, pageHtml, cssHrefs) {
  const C = CONST(key)
  const hrefs = cssHrefs.map((h) => `  '${h}',`).join('\n')
  return `// '${key}' vendor template, imported AS DATA by the import-template codemod (goal-36).
//
// FAITHFUL copy of the vendor home page. Transforms applied at import time:
//   1. asset paths img/css/... → /sajtbyggare/${key}/... (served from public/)
//   2. vendor JS stripped (all <script>, JS-only attrs, animation classes, spinner,
//      back-to-top, navbar-toggler). Static-first.
//   3. CODEMOD-TODO: the native booking/appointment <form> must be REPLACED by
//      <corevo-module type="booking" pos="<section-id>"> (exactly one). Verify the
//      vendor attribution credit is kept (kräver-kredit licence).
//
// Author-controlled (we imported it) → trusted. TENANT edits are sanitised at SAVE.
export const ${C}_PAGE_HTML = \`
${pageHtml.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}
\`.trim()

export const ${C}_CSS_HREFS = [
${hrefs}
] as const
`
}

function emitManifest(key, regions) {
  const C = CONST(key)
  const lines = regions.map(regionLine).join('\n')
  return `// '${key}' editable-region manifest — imported by the import-template codemod (goal-36).
//
// color/font/logo defaults are LIFTED from the vendor CSS (public/sajtbyggare/${key}/css/);
// text/image defaults are mirrored verbatim from ${C}_PAGE_HTML.
// CODEMOD-TODO: an agent must verify each text/image default is the EXACT verbatim
// vendor string and drop/add regions so the proof asserts this look's UNIQUE shape.
import type { RegionManifest } from './types'

export const ${C}_REGION_MANIFEST: RegionManifest = {
  templateKey: '${key}',
  regions: [
${lines}
  ],
}
`
}

function emitProof(key, regions, tokens) {
  const C = CONST(key)
  const keysArr = regions.map((r) => `      '${r.key}',`).join('\n')
  return `// ${key} — per-template render-proof (goal-36 M2). Asserts this look's UNIQUE
// shape, not a smoke test. CODEMOD-SCAFFOLD: an agent finalises section coverage +
// verbatim text defaults + booking pos, then runs it to 0 FAIL.
import { describe, expect, it } from 'vitest'
import { createElement, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderTemplate } from '../render-bridge'
import { ${C}_PAGE_HTML } from './${key}'
import { ${C}_REGION_MANIFEST } from '../manifest/${key}'
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
const { regions } = ${C}_REGION_MANIFEST

// goal-36 R4: the anti-stub floor (>= 8 regions + booking marker + canon color/font + no drift).
proofFloor(${C}_REGION_MANIFEST, ${C}_PAGE_HTML)

describe('${key} template — render-proof invariants', () => {
  it('${C}_PAGE_HTML is a non-empty string', () => {
    expect(typeof ${C}_PAGE_HTML).toBe('string')
    expect(${C}_PAGE_HTML.length).toBeGreaterThan(0)
  })
  it('strips all vendor JS', () => {
    expect(${C}_PAGE_HTML).not.toContain('<script')
    expect(${C}_PAGE_HTML).not.toContain('id="spinner"')
  })
  it('rewrites image assets to the served public path', () => {
    expect(${C}_PAGE_HTML).toContain('/sajtbyggare/${key}/')
  })
  it('weaves exactly one booking module marker, none unresolved', () => {
    // CODEMOD-TODO: ensure the native form is replaced by <corevo-module type="booking">.
    expect(moduleMarkerTypes(${C}_PAGE_HTML).filter((t) => t === 'booking')).toHaveLength(1)
    expect(modulesWoven(${C}_PAGE_HTML)).toBe(1)
    expect(unresolvedModuleMarkers(${C}_PAGE_HTML)).toBe(0)
  })
})

describe('${key} booking variant', () => {
  it('mounts the booking module', () => {
    const marker = firstModuleMarker(${C}_PAGE_HTML)
    expect(marker).not.toBeNull()
    expect(marker?.type).toBe('booking')
  })
})

describe('${C}_REGION_MANIFEST', () => {
  it('targets the ${key} template', () => {
    expect(${C}_REGION_MANIFEST.templateKey).toBe('${key}')
  })
  it('declares the expected region keys (identities)', () => {
    const expected = [
${keysArr}
    ]
    expect([...regions.map((r) => r.key)].sort()).toEqual([...expected].sort())
  })
  it('no duplicate keys + valid types', () => {
    const keys = regions.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const r of regions) expect(VALID_TYPES).toContain(r.type)
  })
  it('colour + font defaults are the EXACT vendor tokens', () => {
    const get = (k: string): Region => regions.find((r) => r.key === k)!
    expect(get('color.primary').default).toBe(${JSON.stringify(tokens.colorPrimary)})
    expect(get('color.bg').default).toBe(${JSON.stringify(tokens.colorBg)})
    expect(get('color.fg').default).toBe(${JSON.stringify(tokens.colorFg)})
    expect(get('font.body').default).toBe(${JSON.stringify(tokens.fontBody)})
  })
  it('no colour/font literal drifts from the vendor CSS (token-mismatch == 0)', () => {
    const vendorCssLc = readVendorCssLc('${key}')
    expect(vendorCssLc.length).toBeGreaterThan(0)
    expect(countTokenMismatches(tokenScanText(${C}_PAGE_HTML, ${C}_REGION_MANIFEST), vendorCssLc)).toBe(0)
  })
})

describe('${key} MarkedRegions DOM render-proof', () => {
  const resolved = resolveSiteContent(${C}_REGION_MANIFEST, { verticalDefaults: {}, tenantCopy: {}, tenantBranding: null })
  const html = renderToStaticMarkup(createElement(MarkedRegions, { regions: resolved }))
  it('stamps a data-editable marker for EVERY region', () => {
    for (const r of ${C}_REGION_MANIFEST.regions) {
      expect(html, \`missing marker: \${r.key}\`).toContain(\`data-editable="\${r.key}"\`)
    }
  })
})

describe('${key} render-bron round-trip', () => {
  const out = renderToStaticMarkup(
    createElement(Fragment, null, renderTemplate(${C}_PAGE_HTML, {
      booking: createElement('div', { 'data-testid': 'booking-mounted' }),
    })),
  )
  it('swaps the booking marker for the live module', () => {
    expect(out).toContain('data-testid="booking-mounted"')
    expect(out).not.toContain('data-corevo-module-missing')
    expect(out).not.toContain('<corevo-module')
  })
})
`
}

// ── public asset copy ────────────────────────────────────────────────────────
function copyDir(src, dst) {
  if (!existsSync(src)) return 0
  mkdirSync(dst, { recursive: true })
  let n = 0
  for (const e of readdirSync(src)) {
    const s = join(src, e), d = join(dst, e)
    if (statSync(s).isDirectory()) n += copyDir(s, d)
    else { copyFileSync(s, d); n++ }
  }
  return n
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
function main() {
  const a = parseArgs(process.argv.slice(2))
  const srcDir = resolve(REPO_ROOT, a.src)
  const pagePath = join(srcDir, a.page)
  if (!existsSync(pagePath)) { console.error(`page not found: ${pagePath}`); process.exit(1) }

  const raw = readFileSync(pagePath, 'utf8')
  const cssHrefs = extractCssHrefs(raw, a.key)
  let body = extractBody(raw)
  body = stripChrome(body)
  body = rewriteAssets(body, a.key)

  // vendor CSS for token extraction
  const cssDir = join(srcDir, 'css')
  let cssText = ''
  for (const f of ['style.css', 'bootstrap.min.css', 'main.css', 'styles.css']) {
    const p = join(cssDir, f)
    if (existsSync(p)) cssText += '\n' + readFileSync(p, 'utf8')
  }
  const tokens = extractCanonTokens(cssText)
  const regions = detectRegions(body, tokens, a.key)

  const summary = {
    key: a.key, src: a.src, page: a.page,
    bodyBytes: body.length, cssHrefs, tokens,
    regionCount: regions.length,
    regionKeys: regions.map((r) => r.key),
    hasNativeForm: /<form\b/i.test(body),
    keepsAttribution: /htmlcodex|colorlib|themewagon|untree|bootstrapmade/i.test(body),
  }

  if (a.dry) { console.log(JSON.stringify(summary, null, 2)); return }

  // write scaffolds
  writeFileSync(join(LIB, 'templates', `${a.key}.ts`), emitTemplate(a.key, body, cssHrefs))
  writeFileSync(join(LIB, 'manifest', `${a.key}.ts`), emitManifest(a.key, regions))
  writeFileSync(join(LIB, 'templates', `${a.key}.proof.test.ts`), emitProof(a.key, regions, tokens))

  // copy public assets
  const pub = join(APP_WEB, 'public', 'sajtbyggare', a.key)
  const imgN = copyDir(join(srcDir, 'img'), join(pub, 'img'))
  const cssN = copyDir(join(srcDir, 'css'), join(pub, 'css'))
  copyDir(join(srcDir, 'lib'), join(pub, 'lib'))
  copyDir(join(srcDir, 'fonts'), join(pub, 'fonts'))

  console.log(JSON.stringify({ ...summary, imgCopied: imgN, cssCopied: cssN, wrote: [`templates/${a.key}.ts`, `manifest/${a.key}.ts`, `templates/${a.key}.proof.test.ts`] }, null, 2))
  if (!summary.hasNativeForm) console.error('\n⚠️  no <form> found in body — booking-fit may not hold; AGENT must verify before placing a marker.')
  console.error('\n→ NEXT (agent): place <corevo-module type="booking" pos="..."> on the native form, finalise text/image regions to verbatim vendor strings, then run the proof to 0 FAIL.')
}

// only run main when executed directly (not when imported by the unit test)
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
