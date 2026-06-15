import { describe, it, expect } from 'vitest'
import {
  parseModuleSelections,
  normalizeSelections,
  type ModuleSelection,
} from '@/lib/platform/tenant-modules-write'

// Multi-bransch spår 5 — the create-path module write. These pin the two pure
// transforms: parsing the wizard's JSON `modules` field, and normalizing it so
// booking is always provisioned at least 'live' (FreshCut-parity) and 'off' rows
// are dropped (absence == off on the read side).

describe('parseModuleSelections — wizard `modules` field → clean list', () => {
  it('parses a valid { module_key: state } map', () => {
    const out = parseModuleSelections(JSON.stringify({ booking: 'live', media_library: 'draft' }))
    expect(out).toEqual<ModuleSelection[]>([
      { moduleKey: 'booking', state: 'live' },
      { moduleKey: 'media_library', state: 'draft' },
    ])
  })

  it('drops entries with an unknown state', () => {
    const out = parseModuleSelections(JSON.stringify({ booking: 'live', shop: 'banana' }))
    expect(out).toEqual([{ moduleKey: 'booking', state: 'live' }])
  })

  it('returns [] for empty / garbage / non-object input', () => {
    expect(parseModuleSelections('')).toEqual([])
    expect(parseModuleSelections(null)).toEqual([])
    expect(parseModuleSelections('not json')).toEqual([])
    expect(parseModuleSelections('[1,2,3]')).toEqual([])
    expect(parseModuleSelections('"str"')).toEqual([])
  })

  it('trims keys and de-dupes (first valid wins per key)', () => {
    const out = parseModuleSelections(JSON.stringify({ ' booking ': 'live' }))
    expect(out).toEqual([{ moduleKey: 'booking', state: 'live' }])
  })
})

describe('normalizeSelections — booking floor + drop off-rows', () => {
  it('floors a missing booking to live', () => {
    const out = normalizeSelections([{ moduleKey: 'media_library', state: 'live' }])
    expect(out).toContainEqual({ moduleKey: 'booking', state: 'live' })
    expect(out).toContainEqual({ moduleKey: 'media_library', state: 'live' })
  })

  it('raises a below-live booking up to live', () => {
    expect(normalizeSelections([{ moduleKey: 'booking', state: 'draft' }])).toEqual([
      { moduleKey: 'booking', state: 'live' },
    ])
    expect(normalizeSelections([{ moduleKey: 'booking', state: 'off' }])).toEqual([
      { moduleKey: 'booking', state: 'live' },
    ])
  })

  it('keeps an explicitly paused booking as paused (only floors below live)', () => {
    // NOTE: the wizard never offers booking below live, but if it did, paused is a
    // legitimate publish state above the off/draft floor and must survive.
    expect(normalizeSelections([{ moduleKey: 'booking', state: 'paused' }])).toEqual([
      { moduleKey: 'booking', state: 'paused' },
    ])
  })

  it('drops off-state modules (absence == off on read)', () => {
    const out = normalizeSelections([
      { moduleKey: 'booking', state: 'live' },
      { moduleKey: 'media_library', state: 'off' },
      { moduleKey: 'loyalty', state: 'draft' },
    ])
    expect(out.find((s) => s.moduleKey === 'media_library')).toBeUndefined()
    expect(out).toContainEqual({ moduleKey: 'loyalty', state: 'draft' })
    expect(out).toContainEqual({ moduleKey: 'booking', state: 'live' })
  })

  it('always includes booking even from an empty selection', () => {
    expect(normalizeSelections([])).toEqual([{ moduleKey: 'booking', state: 'live' }])
  })
})
