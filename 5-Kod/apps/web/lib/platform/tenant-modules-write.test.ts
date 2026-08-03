import { describe, it, expect, vi } from 'vitest'
import {
  parseModuleSelections,
  normalizeSelections,
  writeTenantVerticalAndModules,
  type ModuleSelection,
} from '@/lib/platform/tenant-modules-write'

// Multi-bransch spår 5 — the create-path module write. These pin the two pure
// transforms: parsing the wizard's JSON `modules` field and preserving exact choices.

describe('parseModuleSelections — wizard `modules` field → clean list', () => {
  it('parses a valid { module_key: state } map', () => {
    const out = parseModuleSelections(JSON.stringify({ booking: 'live', media_library: 'off' }))
    expect(out).toEqual<ModuleSelection[]>([
      { moduleKey: 'booking', state: 'live' },
      { moduleKey: 'media_library', state: 'off' },
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

describe('normalizeSelections — exact on/off choices', () => {
  it('does not add a missing booking choice', () => {
    const out = normalizeSelections([{ moduleKey: 'media_library', state: 'live' }])
    expect(out).toEqual([{ moduleKey: 'media_library', state: 'live' }])
  })

  it('preserves an explicitly off booking as the website-only state', () => {
    expect(normalizeSelections([{ moduleKey: 'booking', state: 'off' }])).toEqual([
      { moduleKey: 'booking', state: 'off' },
    ])
  })

  it('preserves off-state modules', () => {
    const out = normalizeSelections([
      { moduleKey: 'booking', state: 'live' },
      { moduleKey: 'media_library', state: 'off' },
      { moduleKey: 'lojalitet', state: 'live' },
    ])
    expect(out).toContainEqual({ moduleKey: 'media_library', state: 'off' })
    expect(out).toContainEqual({ moduleKey: 'lojalitet', state: 'live' })
    expect(out).toContainEqual({ moduleKey: 'booking', state: 'live' })
  })

  it('keeps an empty selection empty', () => {
    expect(normalizeSelections([])).toEqual([])
  })
})

describe('writeTenantVerticalAndModules — catalog fence', () => {
  it.each([
    { data: null, error: { message: 'catalog unavailable' } },
    { data: [], error: null },
  ])('fails closed when booking cannot be validated against the module catalog', async (catalog) => {
    const insert = vi.fn()
    const supabase = {
      from: vi.fn((table: string) => table === 'modules'
        ? { select: vi.fn().mockResolvedValue(catalog) }
        : { insert }),
    }

    await expect(writeTenantVerticalAndModules(
      supabase as never,
      'tenant-a',
      null,
      [{ moduleKey: 'booking', state: 'off' }],
    )).resolves.toEqual({ ok: false })
    expect(insert).not.toHaveBeenCalled()
  })

  it('provisions requested binary states directly without app-owned config', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const transitions: { state: string; keys: string[] }[] = []
    const update = vi.fn((value: { state: string }) => ({
      eq: vi.fn(() => ({
        in: vi.fn((_column: string, keys: string[]) => {
          transitions.push({ state: value.state, keys })
          return Promise.resolve({ error: null })
        }),
      })),
    }))
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'modules') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { key: 'booking' },
                { key: 'shop' },
                { key: 'lojalitet' },
              ],
              error: null,
            }),
          }
        }
        return { insert, update }
      }),
    }

    await expect(
      writeTenantVerticalAndModules(supabase as never, 'tenant-a', null, [
        { moduleKey: 'booking', state: 'live' },
        { moduleKey: 'shop', state: 'live' },
        { moduleKey: 'lojalitet', state: 'off' },
      ]),
    ).resolves.toEqual({ ok: true })

    expect(insert).toHaveBeenCalledWith([
      { tenant_id: 'tenant-a', module_key: 'booking', state: 'live' },
      { tenant_id: 'tenant-a', module_key: 'shop', state: 'live' },
      { tenant_id: 'tenant-a', module_key: 'lojalitet', state: 'off' },
    ])
    expect(transitions).toEqual([])
  })
})
