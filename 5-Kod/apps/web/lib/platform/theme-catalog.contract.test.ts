import { describe, expect, it } from 'vitest'
import { FLORIST_LAYOUTS } from '@/components/storefront/layouts/florist/layouts'
import { SALONG_LAYOUTS } from '@/components/storefront/layouts/salong/layouts'
import { STOREFRONT_THEMES } from '@/lib/tenant-data'
import { COREVO_12_THEME_KEYS, SELECTABLE_THEMES, THEME_PALETTES } from './theme-palettes'

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

async function loadCatalog() {
  const modulePath = './theme-catalog'
  try {
    return await import(/* @vite-ignore */ modulePath)
  } catch {
    return null
  }
}

describe('Goal 93 theme catalog contract', () => {
  it('exposes exactly the 12 unique selectable Corevo themes', async () => {
    const catalogModule = await loadCatalog()

    expect(catalogModule).not.toBeNull()
    const keys = catalogModule?.SELECTABLE_THEME_CATALOG.map((entry) => entry.key) ?? []
    expect(keys).toEqual(EXPECTED_KEYS)
    expect(new Set(keys).size).toBe(12)
  })

  it('contains nine florist and three salong runtime definitions with only known modules', async () => {
    const catalogModule = await loadCatalog()
    const catalog = catalogModule?.SELECTABLE_THEME_CATALOG ?? []

    expect(catalog.filter((entry) => entry.vertical === 'florist')).toHaveLength(9)
    expect(catalog.filter((entry) => entry.vertical === 'frisör')).toHaveLength(3)
    for (const entry of catalog) {
      expect(entry.requiredModules.every((key) => KNOWN_MODULE_KEYS.includes(key))).toBe(true)
    }
  })

  it('resolves every catalog key to layout, palette, content and capabilities', async () => {
    const catalogModule = await loadCatalog()
    const catalog = catalogModule?.SELECTABLE_THEME_CATALOG ?? []
    const palettes = new Map(THEME_PALETTES.map((palette) => [palette.key, palette]))

    for (const entry of catalog) {
      const layouts = entry.vertical === 'florist' ? FLORIST_LAYOUTS : SALONG_LAYOUTS
      expect(layouts[entry.key]).toBeTypeOf('function')
      expect(palettes.get(entry.key)).toBeDefined()
      expect(entry.definition.content).toBeDefined()
      expect(entry.definition.caps).toBeDefined()
    }
  })

  it('keeps catalog, palettes and onboarding on the same selectable set', async () => {
    const catalogModule = await loadCatalog()
    const formModule = await import('@/components/platform/CreateTenantForm')
    const catalogKeys = catalogModule?.SELECTABLE_THEME_CATALOG.map((entry) => entry.key) ?? []

    expect([...COREVO_12_THEME_KEYS]).toEqual(catalogKeys)
    expect(SELECTABLE_THEMES.map((theme) => theme.key)).toEqual(catalogKeys)
    expect([...formModule.CREATE_TENANT_THEME_KEYS]).toEqual(catalogKeys)
  }, 15_000)

  it('keeps every legacy theme renderable but not selectable', () => {
    const selectable = new Set(COREVO_12_THEME_KEYS)

    for (const key of LEGACY_RENDERABLE_KEYS) {
      expect(STOREFRONT_THEMES).toContain(key)
      expect(selectable.has(key)).toBe(false)
    }
  })

  it('rejects unknown status, version and module references fail-closed', async () => {
    const catalogModule = await loadCatalog()
    const catalog = catalogModule?.SELECTABLE_THEME_CATALOG ?? []
    const first = catalog[0]

    expect(first).toBeDefined()
    expect(catalogModule?.validateThemeCatalog(catalog)).toEqual([])
    expect(catalogModule?.validateThemeCatalog([{ ...first, status: 'future' }])).toContain(
      'ateljevinter:status',
    )
    expect(catalogModule?.validateThemeCatalog([{ ...first, schemaVersion: 2 }])).toContain(
      'ateljevinter:schemaVersion',
    )
    expect(
      catalogModule?.validateThemeCatalog([{ ...first, requiredModules: ['unknown'] }]),
    ).toContain('ateljevinter:requiredModules')
  })

  it('requires deprecated themes to be unselectable with an active replacement', async () => {
    const catalogModule = await loadCatalog()
    const catalog = catalogModule?.SELECTABLE_THEME_CATALOG ?? []
    const [first, second] = catalog

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(
      catalogModule?.validateThemeCatalog([
        { ...first, status: 'deprecated', selectable: false },
        second,
      ]),
    ).toContain('ateljevinter:replacementKey')
    expect(
      catalogModule?.validateThemeCatalog([
        {
          ...first,
          status: 'deprecated',
          selectable: false,
          replacementKey: second?.key,
        },
        { ...second, status: 'archived', selectable: false },
      ]),
    ).toContain('ateljevinter:replacementKey')
    expect(
      catalogModule?.validateThemeCatalog([
        {
          ...first,
          status: 'deprecated',
          selectable: true,
          replacementKey: second?.key,
        },
        second,
      ]),
    ).toContain('ateljevinter:selectable')
  })
})
