// Overlay-modell (Sajtbyggare S2) — region-bindning + draft-state, utan DOM.

import { describe, expect, it } from 'vitest'
import type { ResolvedRegion } from '../resolve'
import {
  regionRefFromAttrs,
  setDraftValue,
  clearDraftValue,
  blankDraftValue,
  draftToEdits,
  effectiveValue,
  isModified,
  hasUnsavedChanges,
  type Draft,
} from './overlay-model'

const resolved = (over: Partial<ResolvedRegion>): ResolvedRegion => ({
  key: 'hero.title',
  type: 'text',
  value: 'Sparat',
  source: 'universal',
  provenance: 'standard',
  ...over,
})

describe('regionRefFromAttrs — DOM marker → region', () => {
  it('reads key + type from data-editable markers', () => {
    expect(regionRefFromAttrs({ editable: 'hero.title', type: 'text' })).toEqual({ key: 'hero.title', type: 'text' })
    expect(regionRefFromAttrs({ editable: 'color.primary', type: 'color' })).toEqual({ key: 'color.primary', type: 'color' })
  })
  it('returns null for missing key, missing type, or unknown type', () => {
    expect(regionRefFromAttrs({ editable: '', type: 'text' })).toBeNull()
    expect(regionRefFromAttrs({ editable: 'hero.title', type: null })).toBeNull()
    expect(regionRefFromAttrs({ editable: 'hero.title', type: 'nope' })).toBeNull()
  })
})

describe('draft operations are immutable', () => {
  it('setDraftValue returns a new map, leaves the old one', () => {
    const a: Draft = {}
    const b = setDraftValue(a, 'hero.title', 'Ny')
    expect(b).toEqual({ 'hero.title': 'Ny' })
    expect(a).toEqual({})
  })
  it('clearDraftValue removes a key (revert to saved)', () => {
    const a: Draft = { 'hero.title': 'Ny', 'color.primary': '#000' }
    const b = clearDraftValue(a, 'hero.title')
    expect(b).toEqual({ 'color.primary': '#000' })
    expect(a['hero.title']).toBe('Ny') // original untouched
  })
  it('blankDraftValue stores empty (explicit clear-override → falls back)', () => {
    expect(blankDraftValue({}, 'hero.title')).toEqual({ 'hero.title': '' })
  })
})

describe('draftToEdits → save payload', () => {
  it('maps every drafted key to a {regionKey, value} edit', () => {
    const d: Draft = { 'hero.title': 'Ny', 'color.primary': '#000' }
    expect(draftToEdits(d)).toEqual([
      { regionKey: 'hero.title', value: 'Ny' },
      { regionKey: 'color.primary', value: '#000' },
    ])
  })
  it('empty draft → no edits', () => {
    expect(draftToEdits({})).toEqual([])
  })
})

describe('effectiveValue — what the preview renders', () => {
  it('draft override wins over resolved value', () => {
    expect(effectiveValue(resolved({ value: 'Sparat' }), { 'hero.title': 'Utkast' })).toBe('Utkast')
  })
  it('no draft → resolved value', () => {
    expect(effectiveValue(resolved({ value: 'Sparat' }), {})).toBe('Sparat')
  })
  it('drafted-to-empty → null (inherited default shows)', () => {
    expect(effectiveValue(resolved({ value: 'Sparat' }), { 'hero.title': '   ' })).toBeNull()
  })
})

describe('isModified — the editor badge', () => {
  it('drafted to a value → modified', () => {
    expect(isModified(resolved({ provenance: 'standard' }), { 'hero.title': 'Ny' })).toBe(true)
  })
  it('drafted to empty (cleared) → NOT modified (standard again)', () => {
    expect(isModified(resolved({ provenance: 'modifierad' }), { 'hero.title': '' })).toBe(false)
  })
  it('not drafted → mirrors saved provenance', () => {
    expect(isModified(resolved({ provenance: 'modifierad' }), {})).toBe(true)
    expect(isModified(resolved({ provenance: 'standard' }), {})).toBe(false)
  })
})

describe('hasUnsavedChanges', () => {
  it('true iff the draft has any keys', () => {
    expect(hasUnsavedChanges({})).toBe(false)
    expect(hasUnsavedChanges({ 'hero.title': 'x' })).toBe(true)
  })
})
