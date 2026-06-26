// goal-36 R4 — the proof FLOOR: the minimum every per-look render-proof must
// assert so a green "0 FAIL" can never be a copy-paste smoke stub (the M2/62%
// false-green trap). The codemod emits one `proofFloor(MANIFEST, PAGE_HTML)` line
// per look; this runs its own assertions, and proof-floor.test.ts enforces that
// EVERY templates/*.proof.test.ts calls it — so stubbing is mechanically impossible.
//
// SEPARATE from proof-kit.ts ON PURPOSE: proof-kit is imported by PRODUCTION code
// (look-registry.ts → storefront), so it must stay vitest-free. This file imports
// vitest and is therefore ONLY ever imported by *.test.ts files.

import { describe, it, expect } from 'vitest'
import type { RegionManifest } from '../manifest/types'
import {
  firstModuleMarker,
  readVendorCssLc,
  tokenScanText,
  countTokenMismatches,
} from './proof-kit'

export type ProofFloorOpts = { minRegions?: number }

/** Throws on any floor violation. Pure — used directly in unit tests. */
export function checkProofFloor(
  manifest: RegionManifest,
  pageHtml: string,
  minRegions = 8,
): void {
  const key = manifest.templateKey
  if (typeof pageHtml !== 'string' || pageHtml.length === 0)
    throw new Error(`proof-floor: ${key} PAGE_HTML is empty`)
  if (manifest.regions.length < minRegions)
    throw new Error(`proof-floor: ${key} has ${manifest.regions.length} regions, need >= ${minRegions}`)
  if (!firstModuleMarker(pageHtml))
    throw new Error(`proof-floor: ${key} weaves no <corevo-module> (booking marker missing)`)
  const hasColor = manifest.regions.some((r) => r.type === 'color' && r.default)
  const hasFont = manifest.regions.some((r) => r.type === 'font' && r.default)
  if (!hasColor) throw new Error(`proof-floor: ${key} has no canon color region with a default`)
  if (!hasFont) throw new Error(`proof-floor: ${key} has no canon font region with a default`)
  const vendorCssLc = readVendorCssLc(key)
  if (vendorCssLc.length === 0)
    throw new Error(`proof-floor: ${key} vendor CSS not found in public/sajtbyggare/${key}/css/`)
  const drift = countTokenMismatches(tokenScanText(pageHtml, manifest), vendorCssLc)
  if (drift !== 0)
    throw new Error(`proof-floor: ${key} has ${drift} color/font literal(s) not in vendor CSS (invented token / drift)`)
}

/** Registers the floor as a vitest describe. The line the codemod emits into each
 *  per-look proof: `proofFloor(KEY_REGION_MANIFEST, KEY_PAGE_HTML)`. */
export function proofFloor(
  manifest: RegionManifest,
  pageHtml: string,
  opts: ProofFloorOpts = {},
): void {
  describe(`proof-floor (R4): ${manifest.templateKey}`, () => {
    it('meets the floor: >= minRegions + booking marker + canon color/font + no token drift', () => {
      expect(() => checkProofFloor(manifest, pageHtml, opts.minRegions ?? 8)).not.toThrow()
    })
  })
}
