// Reusable per-template render-proof helpers (goal-36 structural spine).
//
// Pure functions extracted from the render-bron pilot's metrics test so EVERY
// template's `<name>.proof.test.ts` shares ONE structural implementation instead
// of copy-pasting it (the M2 "copy-paste stub" trap). No vitest, no assertions
// here — the per-template proof imports these and writes its own template-SPECIFIC
// expects (unique region ids + canon tokens + booking variant).
//
// Carries forward the pilot's correctness fixes (see PILOT-UTFALL / experiment-log):
//  - token-mismatch scans ONLY color/font region defaults (text/image defaults are
//    copy/asset-paths, never tokens) — validated against a REAL manifest.
//  - module marker types are matched against the render-bridge's KNOWN set so an
//    unknown/typo'd marker is caught (unresolved_module_markers).

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { RegionManifest } from '../manifest/types'

const HERE = dirname(fileURLToPath(import.meta.url)) // …/lib/sajtbyggare/_optimize

/** Module types the render-bridge knows how to weave. A `<corevo-module>` whose
 *  `type` is in this set is a RESOLVED weave target; anything else is an
 *  unresolved/orphaned marker. Mirror of render-bridge's contract. */
export const KNOWN_MODULE_TYPES = ['booking', 'shop', 'offert', 'lojalitet', 'presentkort', 'blogg'] as const
const KNOWN_SET = new Set<string>(KNOWN_MODULE_TYPES)

/** All `<corevo-module ... type="X">` marker types, in document order. */
export function moduleMarkerTypes(html: string): string[] {
  const out: string[] = []
  const re = /<corevo-module\b[^>]*\btype=["']([^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) out.push(m[1]!)
  return out
}

/** Count of marker types that are NOT in the render-bridge's known set. */
export function unresolvedModuleMarkers(html: string): number {
  return moduleMarkerTypes(html).filter((t) => !KNOWN_SET.has(t)).length
}

/** Count of marker types that ARE a known/weavable module. */
export function modulesWoven(html: string): number {
  return moduleMarkerTypes(html).filter((t) => KNOWN_SET.has(t)).length
}

/** Parse a single `<corevo-module>` marker's attributes (type + pos). Returns
 *  null if no marker present. Used to assert the BOOKING VARIANT a template
 *  mounts (M2.2): which module type + at which position. */
export function firstModuleMarker(html: string): { type: string; pos: string | null } | null {
  const m = html.match(/<corevo-module\b([^>]*)>/)
  if (!m) return null
  const attrs = m[1] ?? ''
  const type = attrs.match(/\btype=["']([^"']+)["']/)?.[1] ?? ''
  const pos = attrs.match(/\bpos=["']([^"']+)["']/)?.[1] ?? null
  return { type, pos }
}

/** Hex colour + font-family literals hardcoded in a chunk of template/token text. */
export function extractTokenLiterals(text: string): string[] {
  const literals: string[] = []
  for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) literals.push(m[0])
  for (const m of text.matchAll(/font-family\s*:\s*([^;"'`}]+)/gi)) {
    for (const fam of (m[1] ?? '').split(',')) {
      const f = fam.trim().replace(/^["']|["']$/g, '')
      if (f) literals.push(f)
    }
  }
  return literals
}

/** Count colour/font literals NOT present in the (lower-cased) vendor stylesheet. */
export function countTokenMismatches(text: string, vendorCssLc: string): number {
  let n = 0
  for (const lit of extractTokenLiterals(text)) {
    if (!vendorCssLc.includes(lit.toLowerCase())) n++
  }
  return n
}

/** Read + lower-case a template's vendor CSS (the canonical token source) from
 *  public/sajtbyggare/<name>/css/. Returns '' if the dir is absent. */
export function readVendorCssLc(templateName: string): string {
  const base = join(HERE, '..', '..', '..', 'public', 'sajtbyggare', templateName, 'css')
  let css = ''
  for (const f of ['style.css', 'bootstrap.min.css']) {
    const p = join(base, f)
    if (existsSync(p)) css += '\n' + readFileSync(p, 'utf8')
  }
  return css.toLowerCase()
}

/** Build the token-scan text = template html + ONLY the manifest's color/font
 *  region defaults (the token-bearing types). text/image defaults are copy/asset
 *  paths and are deliberately excluded — the pilot's false-positive fix. */
export function tokenScanText(pageHtml: string, manifest: RegionManifest): string {
  let text = pageHtml
  for (const r of manifest.regions) {
    if (!r.default) continue
    if (r.type === 'color') text += '\n' + r.default
    else if (r.type === 'font') text += '\nfont-family: ' + r.default + ';'
  }
  return text
}
