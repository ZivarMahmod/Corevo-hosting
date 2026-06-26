// goal-50 / de-risk R8 — validate_markers
//
// A <corevo-module type="X"> whose type is NOT a known weavable module degrades to a
// SILENT inert <span data-corevo-module-missing> at render time — the module just
// vanishes and no render-proof notices. This is the author-time gate that turns that
// silent loss into a HARD failure: it greps every template source for marker types
// and fails on any unknown one.
//
// Dual-use: importable (pure findUnknownMarkers/markerTypes — used by the vitest guard)
// AND a standalone CLI (`node validate_markers.mjs`) that scans templates/*.ts on disk
// and exits non-zero on the first offender — runnable in CI without the TS build.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Mirror of the render-bridge weave contract (sanitize.ts KNOWN_MODULE_TYPES /
// proof-kit). The validate-markers.test.ts asserts this stays in sync (no drift).
export const KNOWN_MODULE_TYPES = ['booking', 'shop', 'offert', 'lojalitet', 'presentkort', 'blogg']
const KNOWN = new Set(KNOWN_MODULE_TYPES)

/** All <corevo-module ... type="X"> marker types in a chunk of text, document order. */
export function markerTypes(text) {
  const out = []
  const re = /<corevo-module\b[^>]*\btype=["']([^"']+)["']/g
  let m
  while ((m = re.exec(text)) !== null) out.push(m[1])
  return out
}

/** The marker types that are NOT a known weavable module (the offenders). */
export function findUnknownMarkers(text) {
  return markerTypes(text).filter((t) => !KNOWN.has(t))
}

// ── CLI: scan templates/*.ts on disk, report every unknown marker, exit 1 if any ──
function runCli() {
  const here = dirname(fileURLToPath(import.meta.url))
  const dir = join(here, 'templates')
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  let failed = 0
  for (const f of files) {
    const unknown = findUnknownMarkers(readFileSync(join(dir, f), 'utf8'))
    if (unknown.length) {
      failed += unknown.length
      console.error(`✗ ${f}: unknown module marker type(s): ${unknown.join(', ')}`)
    }
  }
  if (failed) {
    console.error(`\nvalidate_markers: ${failed} unknown marker(s). Known: ${KNOWN_MODULE_TYPES.join(', ')}`)
    process.exit(1)
  }
  console.log(`validate_markers: OK — ${files.length} template(s), all markers known.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli()
