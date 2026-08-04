import { describe, expect, it } from 'vitest'
import { STOREFRONT_LAYOUTS } from './runtime'
import { STOREFRONT_THEMES } from '@/lib/tenant-data'
import { COREVO_12_THEME_KEYS, SELECTABLE_THEMES, THEME_PALETTES } from '@/lib/platform/theme-palettes'
import { SELECTABLE_THEME_CATALOG } from '@/lib/platform/theme-catalog'

const EXPECTED_KEYS = [
  'ateljevinter',
  'aurora',
  'blomstertorget',
  'calytrix',
  'eloria',
  'lunaria',
  'onyx',
  'sivsav',
  'solsalt',
  'kalla',
  'siluett',
  'snitt',
] as const

const LEGACY_RENDERABLE_KEYS = [
  'salvia',
  'leander',
  'zigge',
  'linnea',
  'edit',
  'flora',
  'freshcut',
  'zentum',
] as const

const KNOWN_MODULE_KEYS = [
  'booking',
  'shop',
  'blogg',
  'galleri',
  'lojalitet',
  'offert',
  'presentkort',
  'kurser',
] as const

describe('Goal 93 theme catalog contract', () => {
  it('exposes exactly the 12 unique selectable Corevo themes', () => {
    const keys = SELECTABLE_THEME_CATALOG.map((entry) => entry.key)
    expect(keys).toEqual(EXPECTED_KEYS)
    expect(new Set(keys).size).toBe(12)
  })

  it('contains nine florist and three salong runtime definitions with only known modules', () => {
    const catalog = SELECTABLE_THEME_CATALOG

    expect(catalog.filter((entry) => entry.vertical === 'florist')).toHaveLength(9)
    expect(catalog.filter((entry) => entry.vertical === 'frisör')).toHaveLength(3)
    for (const entry of catalog) {
      expect(entry.requiredModules.every((key) => KNOWN_MODULE_KEYS.includes(key))).toBe(true)
    }
  })

  it('resolves every catalog key to layout, palette, content and capabilities', () => {
    const catalog = SELECTABLE_THEME_CATALOG
    const palettes = new Map(THEME_PALETTES.map((palette) => [palette.key, palette]))

    for (const entry of catalog) {
      expect(STOREFRONT_LAYOUTS[entry.key]).toBeTypeOf('function')
      expect(palettes.get(entry.key)).toBeDefined()
      expect(entry.definition.content).toBeDefined()
      expect(entry.definition.caps).toBeDefined()
    }
  })

  it('keeps catalog and palettes on the same selectable set', () => {
    const catalogKeys = SELECTABLE_THEME_CATALOG.map((entry) => entry.key)

    expect([...COREVO_12_THEME_KEYS]).toEqual(catalogKeys)
    expect(SELECTABLE_THEMES.map((theme) => theme.key)).toEqual(catalogKeys)
  }, 15_000)

  it('keeps every legacy theme renderable but not selectable', () => {
    const selectable = new Set(COREVO_12_THEME_KEYS)

    for (const key of LEGACY_RENDERABLE_KEYS) {
      expect(STOREFRONT_THEMES).toContain(key)
      expect(selectable.has(key)).toBe(false)
    }
  })
})
