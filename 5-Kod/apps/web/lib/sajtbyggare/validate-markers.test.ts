// goal-50 / de-risk R8 — validate_markers must catch a misspelled module type.
// A typo'd <corevo-module type="bookng"> degrades to a SILENT inert span at render
// time (the module vanishes, no proof notices). The validator is the author-time
// gate that turns that silent loss into a hard failure.

import { describe, expect, it } from 'vitest'
import { findUnknownMarkers, markerTypes, KNOWN_MODULE_TYPES } from './validate_markers.mjs'
import { KNOWN_MODULE_TYPES as PROOF_KNOWN } from './_optimize/proof-kit'

describe('validate_markers — author-time marker-type guard', () => {
  it('extracts every marker type in document order', () => {
    const html = '<corevo-module type="booking"></corevo-module><corevo-module type="shop"></corevo-module>'
    expect(markerTypes(html)).toEqual(['booking', 'shop'])
  })

  it('a known type is accepted (no unknown markers)', () => {
    expect(findUnknownMarkers('<corevo-module type="booking"></corevo-module>')).toEqual([])
  })

  it('a MISSPELLED type is caught (the silent-loss bug becomes a hard fail)', () => {
    expect(findUnknownMarkers('<corevo-module type="bookng"></corevo-module>')).toEqual(['bookng'])
  })

  it('the validator KNOWN set mirrors the render-bridge contract (no drift)', () => {
    expect([...KNOWN_MODULE_TYPES].sort()).toEqual([...PROOF_KNOWN].sort())
  })
})
