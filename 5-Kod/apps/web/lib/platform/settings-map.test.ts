import { describe, expect, it } from 'vitest'
import {
  PLATFORM_SETTINGS_GROUPS,
  platformSettingsCategories,
  platformSettingsSearchEntries,
} from './settings-map'

describe('platform settings map', () => {
  it('exposes only categories backed by truthful platform content', () => {
    expect(PLATFORM_SETTINGS_GROUPS).toEqual(['KONTO', 'PENGAR'])
    expect(platformSettingsCategories()).toEqual([
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
    ])
  })

  it('indexes both real categories without inventing a branding setting', () => {
    const categories = platformSettingsCategories()
    const entries = platformSettingsSearchEntries(categories)

    expect(entries.map(({ categoryId, href }) => ({ categoryId, href }))).toEqual([
      { categoryId: 'sakerhet', href: '/installningar/sakerhet' },
      { categoryId: 'fakturering', href: '/installningar/fakturering' },
    ])
    expect(JSON.stringify({ categories, entries }).toLowerCase()).not.toContain('varumarke')
  })
})
