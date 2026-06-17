// Draft ↔ URL-param (Sajtbyggare S2) — round-trip + robustness.

import { describe, expect, it } from 'vitest'
import { encodeDraft, decodeDraft, MAX_DRAFT_PARAM } from './draft-url'

describe('encodeDraft / decodeDraft round-trip', () => {
  it('round-trips a draft with text, urls, and special chars', () => {
    const d = { 'hero.title': 'Ny rubrik\nrad 2', 'color.primary': '#5E7361', 'hero.image': 'https://cdn/x.jpg?a=1&b=2' }
    expect(decodeDraft(encodeDraft(d))).toEqual(d)
  })
  it('empty draft round-trips to empty', () => {
    expect(decodeDraft(encodeDraft({}))).toEqual({})
  })
})

describe('decodeDraft — robust against garbage', () => {
  it('null/undefined/empty → {}', () => {
    expect(decodeDraft(null)).toEqual({})
    expect(decodeDraft(undefined)).toEqual({})
    expect(decodeDraft('')).toEqual({})
  })
  it('non-JSON → {}', () => {
    expect(decodeDraft('%%%not-json%%%')).toEqual({})
    expect(decodeDraft('{broken')).toEqual({})
  })
  it('JSON array / primitive → {}', () => {
    expect(decodeDraft(encodeURIComponent('[1,2,3]'))).toEqual({})
    expect(decodeDraft(encodeURIComponent('"str"'))).toEqual({})
    expect(decodeDraft(encodeURIComponent('42'))).toEqual({})
  })
  it('drops non-string values, keeps string entries', () => {
    const raw = encodeURIComponent(JSON.stringify({ a: 'keep', b: 42, c: null, d: { x: 1 }, e: ['y'] }))
    expect(decodeDraft(raw)).toEqual({ a: 'keep' })
  })
  it('oversized param → {} (falls back to saved values)', () => {
    const huge = 'x'.repeat(MAX_DRAFT_PARAM + 1)
    expect(decodeDraft(huge)).toEqual({})
  })
})
