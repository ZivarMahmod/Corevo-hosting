import { describe, expect, it } from 'vitest'
import { regionMarkerAttrs } from './marker'
import type { ResolvedRegion } from './resolve'

describe('regionMarkerAttrs', () => {
  it('maps a tenant-modified region to its data-* markers', () => {
    const region: ResolvedRegion = {
      key: 'hero.title',
      type: 'text',
      value: 'Min rubrik',
      source: 'tenant',
      provenance: 'modifierad',
    }
    expect(regionMarkerAttrs(region)).toEqual({
      'data-editable': 'hero.title',
      'data-editable-type': 'text',
      'data-provenance': 'modifierad',
      'data-source': 'tenant',
    })
  })

  it('reflects an inherited (standard) Universal default', () => {
    const region: ResolvedRegion = {
      key: 'color.primary',
      type: 'color',
      value: '#5E7361',
      source: 'universal',
      provenance: 'standard',
    }
    const m = regionMarkerAttrs(region)
    expect(m['data-editable']).toBe('color.primary')
    expect(m['data-editable-type']).toBe('color')
    expect(m['data-provenance']).toBe('standard')
    expect(m['data-source']).toBe('universal')
  })

  it('reflects the Bransch (vertical) layer — sourced but still standard', () => {
    const region: ResolvedRegion = {
      key: 'hero.eyebrow',
      type: 'text',
      value: '— Barbershop',
      source: 'vertical',
      provenance: 'standard',
    }
    const m = regionMarkerAttrs(region)
    expect(m['data-source']).toBe('vertical')
    expect(m['data-provenance']).toBe('standard')
  })
})
