import { COPY_OVERRIDE_KEYS } from '@/lib/storefront/theme-copy'
import {
  STOREFRONT_LAYOUTS,
  themeModuleViews,
  themePages,
} from '@/components/storefront/layouts/runtime'
import {
  THEME_CATALOG,
  THEME_CATALOG_MODULE_KEYS,
  THEME_CATALOG_SCHEMA_VERSION,
} from '@/lib/platform/theme-catalog'
import { STOREFRONT_THEMES } from '@/lib/tenant-data'
import { MODULE_STATES } from '@/lib/tenant-modules'

const catalog = THEME_CATALOG.map((entry) => {
  const definition = entry.definition
  const capabilityValues = Object.values(definition.caps)

  return {
    schemaVersion: entry.schemaVersion,
    key: entry.key,
    name: definition.name,
    owner: entry.owner,
    status: entry.status,
    replacementKey: entry.replacementKey ?? null,
    vertical: entry.vertical,
    requiredModules: [...entry.requiredModules],
    selectable: entry.selectable,
    palette: { ...definition.palette },
    fonts: { ...definition.fonts },
    radius: definition.radius,
    navHeight: definition.navHeight ?? null,
    caps: { ...definition.caps },
    hasLayout: Boolean(STOREFRONT_LAYOUTS[entry.key]),
    hasContent: Object.keys(definition.content).length > 0,
    hasCapabilities:
      capabilityValues.length === 4 &&
      capabilityValues.every((value) => typeof value === 'boolean'),
    editorFields: (definition.extraHome ?? []).map((field) => field.name),
    codePages: Object.keys(themePages(entry.key)),
    moduleViews: Object.keys(themeModuleViews(entry.key)),
  }
})

process.stdout.write(
  `GOAL93_RUNTIME_JSON=${JSON.stringify({
    schemaVersion: THEME_CATALOG_SCHEMA_VERSION,
    knownModules: [...THEME_CATALOG_MODULE_KEYS],
    renderableThemes: [...STOREFRONT_THEMES],
    moduleStates: [...MODULE_STATES],
    copyOverrideKeys: [...COPY_OVERRIDE_KEYS],
    catalog,
  })}\n`,
)
