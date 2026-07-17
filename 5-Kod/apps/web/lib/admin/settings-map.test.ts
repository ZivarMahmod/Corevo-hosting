import { describe, expect, it } from 'vitest'
import { settingsCategories, SETTINGS_GROUPS } from './settings-map'

describe('settingsCategories v2', () => {
  const categories = settingsCategories()

  it('har paketets tolv kategorier i fem grupper', () => {
    expect(categories).toHaveLength(12)
    expect(SETTINGS_GROUPS).toEqual(['VERKSAMHET', 'BOKNING', 'PENGAR', 'KOMMUNIKATION', 'KONTO'])
    expect(new Set(categories.map((category) => category.id)).size).toBe(12)
  })

  it('pekar varje kategori på sin exakta ägande route', () => {
    expect(Object.fromEntries(categories.map((category) => [category.id, category.href]))).toEqual({
      tjanster: '/admin/tjanster',
      personal: '/admin/personal',
      scheman: '/admin/scheman',
      platser: '/admin/platser',
      bokningsregler: '/admin/installningar/bokning',
      bokningsflode: '/admin/sida?flik=bokning',
      betalning: '/admin/installningar/betalning',
      paminnelser: '/admin/installningar/foretag#paminnelser',
      integrationer: '/admin/sida?flik=kontakt',
      roller: '/admin/installningar?kategori=roller',
      konto: '/admin/installningar/konto',
      sekretess: '/admin/kunder',
    })
  })

  it('låter verticalens terminologi styra personal och tjänster', () => {
    const restaurant = settingsCategories({ staff_plural: 'Kockar', service_plural: 'Rätter' })
    expect(restaurant.find((category) => category.id === 'personal')?.label).toBe('Kockar')
    expect(restaurant.find((category) => category.id === 'tjanster')?.label).toBe('Rätter & priser')
  })

  it('indexerar designpaketets viktigaste synonymer', () => {
    const index = categories.map((category) => `${category.label} ${category.hint} ${category.keywords}`).join(' ').toLowerCase()
    for (const word of ['öppettider', 'semester', 'lösenord', 'behörighet', 'recension']) {
      expect(index).toContain(word)
    }
  })

  it('hårdkodar ingen bransch som plattformens standard', () => {
    const text = categories.map((category) => `${category.label} ${category.hint} ${category.keywords}`).join(' ').toLowerCase()
    for (const word of ['salong', 'frisör', 'barber', 'klippning']) expect(text).not.toContain(word)
  })
})
