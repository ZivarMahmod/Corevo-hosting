import { THEME_SUITES } from '@/lib/storefront/themes/registry'
import type { StorefrontThemeDefinition } from '@/lib/storefront/themes/types'
import type { StorefrontTheme } from '@/lib/tenant-data'

export const THEME_CATALOG_SCHEMA_VERSION = 1 as const
export const THEME_CATALOG_OWNER = 'corevo' as const
export const THEME_CATALOG_STATUSES = ['active', 'deprecated', 'archived'] as const
export const THEME_CATALOG_MODULE_KEYS = [
  'booking',
  'shop',
  'blogg',
  'galleri',
  'lojalitet',
  'offert',
  'presentkort',
  'kurser',
] as const

export type ThemeCatalogStatus = (typeof THEME_CATALOG_STATUSES)[number]
export type ThemeCatalogModuleKey = (typeof THEME_CATALOG_MODULE_KEYS)[number]
export type ThemeCatalogVertical = 'florist' | 'frisör'

export type ThemeCatalogEntry = {
  schemaVersion: typeof THEME_CATALOG_SCHEMA_VERSION
  key: string
  owner: typeof THEME_CATALOG_OWNER
  status: ThemeCatalogStatus
  replacementKey?: string
  vertical: ThemeCatalogVertical
  requiredModules: readonly ThemeCatalogModuleKey[]
  selectable: boolean
  definition: StorefrontThemeDefinition
}

const SHARED_MODULES = [
  'booking',
  'shop',
  'blogg',
  'galleri',
  'lojalitet',
  'offert',
  'presentkort',
] as const satisfies readonly ThemeCatalogModuleKey[]

function entries(
  themes: readonly StorefrontThemeDefinition[],
  vertical: ThemeCatalogVertical,
  requiredModules: readonly ThemeCatalogModuleKey[],
): ThemeCatalogEntry[] {
  return themes.map((definition) => ({
    schemaVersion: THEME_CATALOG_SCHEMA_VERSION,
    key: definition.key,
    owner: THEME_CATALOG_OWNER,
    status: 'active',
    vertical,
    requiredModules,
    selectable: true,
    definition,
  }))
}

export const THEME_CATALOG: readonly ThemeCatalogEntry[] = [
  ...entries(THEME_SUITES.florist, 'florist', [...SHARED_MODULES, 'kurser']),
  ...entries(THEME_SUITES.salong, 'frisör', SHARED_MODULES),
]

export const SELECTABLE_THEME_CATALOG = THEME_CATALOG.filter(
  (entry) => entry.status === 'active' && entry.selectable,
)

export function isSelectableCatalogTheme(key: string): key is StorefrontTheme {
  return SELECTABLE_THEME_CATALOG.some((entry) => entry.key === key)
}
