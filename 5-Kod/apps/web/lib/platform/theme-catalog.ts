import { FLORIST_THEMES } from '@/components/storefront/layouts/florist/registry'
import { SALONG_THEMES } from '@/components/storefront/layouts/salong/registry'
import type { FloristTheme } from '@/components/storefront/layouts/florist/types'

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
  definition: FloristTheme
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
  themes: readonly FloristTheme[],
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
  ...entries(FLORIST_THEMES, 'florist', [...SHARED_MODULES, 'kurser']),
  ...entries(SALONG_THEMES, 'frisör', SHARED_MODULES),
]

export const SELECTABLE_THEME_CATALOG = THEME_CATALOG.filter(
  (entry) => entry.status === 'active' && entry.selectable,
)

export const ONBOARDING_THEME_KEYS = SELECTABLE_THEME_CATALOG.map((entry) => entry.key)

export function validateThemeCatalog(entriesToValidate: readonly unknown[]): string[] {
  const errors: string[] = []
  const rows = entriesToValidate.filter(
    (entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object',
  )
  const byKey = new Map<string, Record<string, unknown>>()

  for (const row of rows) {
    const key = typeof row.key === 'string' && row.key ? row.key : '<invalid>'
    if (key === '<invalid>') errors.push(`${key}:key`)
    else if (byKey.has(key)) errors.push(`${key}:duplicate`)
    else byKey.set(key, row)

    if (row.schemaVersion !== THEME_CATALOG_SCHEMA_VERSION) {
      errors.push(`${key}:schemaVersion`)
    }
    if (row.owner !== THEME_CATALOG_OWNER) errors.push(`${key}:owner`)
    if (!(THEME_CATALOG_STATUSES as readonly unknown[]).includes(row.status)) {
      errors.push(`${key}:status`)
    }
    if (row.vertical !== 'florist' && row.vertical !== 'frisör') {
      errors.push(`${key}:vertical`)
    }

    const modules = row.requiredModules
    if (
      !Array.isArray(modules) ||
      new Set(modules).size !== modules.length ||
      modules.some(
        (moduleKey) =>
          typeof moduleKey !== 'string' ||
          !(THEME_CATALOG_MODULE_KEYS as readonly string[]).includes(moduleKey),
      )
    ) {
      errors.push(`${key}:requiredModules`)
    }

    if (typeof row.selectable !== 'boolean' || (row.selectable && row.status !== 'active')) {
      errors.push(`${key}:selectable`)
    }

    const definition = row.definition
    if (
      !definition ||
      typeof definition !== 'object' ||
      (definition as { key?: unknown }).key !== key ||
      !(definition as { palette?: unknown }).palette ||
      !(definition as { content?: unknown }).content ||
      !(definition as { caps?: unknown }).caps
    ) {
      errors.push(`${key}:definition`)
    }
  }

  if (rows.length !== entriesToValidate.length) errors.push('<invalid>:entry')

  for (const [key, row] of byKey) {
    if (row.status === 'deprecated') {
      const replacement =
        typeof row.replacementKey === 'string' && row.replacementKey !== key
          ? byKey.get(row.replacementKey)
          : undefined
      if (!replacement || replacement.status !== 'active') {
        errors.push(`${key}:replacementKey`)
      }
    } else if (row.replacementKey !== undefined) {
      errors.push(`${key}:replacementKey`)
    }
  }

  return [...new Set(errors)]
}

export function isSelectableCatalogTheme(key: string): boolean {
  return SELECTABLE_THEME_CATALOG.some((entry) => entry.key === key)
}
