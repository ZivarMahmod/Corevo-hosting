import type {
  SettingsNavigationCategory,
  SettingsNavigationSearchEntry,
} from '@/lib/settings-navigation'

export type PlatformSettingsCategoryId = 'sakerhet' | 'fakturering'
export type PlatformSettingsGroup = 'KONTO' | 'PENGAR'

export type PlatformSettingsCategory = SettingsNavigationCategory & {
  id: PlatformSettingsCategoryId
  group: PlatformSettingsGroup
}

export type PlatformSettingsSearchEntry = SettingsNavigationSearchEntry & {
  categoryId: PlatformSettingsCategoryId
  category: PlatformSettingsCategory
}

export const PLATFORM_SETTINGS_GROUPS: readonly PlatformSettingsGroup[] = ['KONTO', 'PENGAR']

/** Only categories backed by real platform behavior belong in this map. */
export function platformSettingsCategories(): PlatformSettingsCategory[] {
  return [
    {
      id: 'sakerhet',
      group: 'KONTO',
      href: '/installningar/sakerhet',
      label: 'Konto & säkerhet',
      hint: 'Lösenord, sessioner och plattformens audit-skydd',
      icon: 'shield',
      keywords: 'konto säkerhet lösenord session enhet audit skydd radering personal',
    },
    {
      id: 'fakturering',
      group: 'PENGAR',
      href: '/installningar/fakturering',
      label: 'Fakturering',
      hint: 'Manuellt underlag och plattformens prismodell',
      icon: 'dollar',
      keywords: 'fakturering underlag prismodell manuell flöde 2 avgift pengar',
    },
  ]
}

export function platformSettingsSearchEntries(
  categories: PlatformSettingsCategory[],
): PlatformSettingsSearchEntry[] {
  return categories.map((category) => ({
    id: `platform-${category.id}`,
    label: category.label,
    hint: category.hint,
    categoryId: category.id,
    href: category.href,
    keywords: `${category.label} ${category.hint} ${category.keywords}`,
    category,
  }))
}
