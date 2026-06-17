// Data-editable markers (Sajtbyggare S1, F3) — the pure marker contract.
//
// Maps a ResolvedRegion to the `data-*` attributes the storefront stamps on each
// editable region so S2's click-overlay can hook onto it later. PURE + framework-
// free (no React) → unit-testable and reusable by both the S1 marked render and
// the S2 editor. NO click handlers anywhere — S1 only MARKS; S2 wires interaction.

import type { ResolvedRegion } from './resolve'

/** The data-* attributes stamped on one editable region in the rendered DOM. */
export type RegionMarker = {
  /** Region key (e.g. 'hero.title') — the stable hook S2's overlay binds to. */
  'data-editable': string
  /** Region kind: 'text' | 'image' | 'color' | 'font' | 'logo'. */
  'data-editable-type': string
  /** Provenance badge: 'standard' (inherited) | 'modifierad' (tenant override). */
  'data-provenance': string
  /** Which cascade layer won: 'universal' | 'vertical' | 'tenant'. */
  'data-source': string
}

/** The data-* marker attributes for one resolved region (display-time contract). */
export function regionMarkerAttrs(region: ResolvedRegion): RegionMarker {
  return {
    'data-editable': region.key,
    'data-editable-type': region.type,
    'data-provenance': region.provenance,
    'data-source': region.source,
  }
}
