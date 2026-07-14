import { describe, it, expect } from 'vitest'
import { settingsCategories } from './settings-map'
import { ADMIN_AREA_MIN_LEVEL, adminAreaForPath, ROLE_LEVEL } from '@/lib/auth/admin-areas'

/** L3 C-01 — kartan får bara peka på ytor som FINNS, och ingen av dem får släppa in
 *  personal. Testet är vakten mot 404-platshållare och mot en rollglidning. */
describe('settingsCategories', () => {
  const cats = settingsCategories()

  it('är exakt nio kategorier', () => {
    expect(cats).toHaveLength(9)
  })

  it('varje href ligger under /admin och är unik', () => {
    const hrefs = cats.map((c) => c.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    for (const h of hrefs) expect(h.startsWith('/admin/')).toBe(true)
  })

  it('varje href hör till den yta kategorin deklarerar (admin-areas.ts)', () => {
    for (const c of cats) expect(adminAreaForPath(c.href)).toBe(c.area)
  })

  it('ingen kategori släpper in personal — allihop kräver salon_admin (6)', () => {
    for (const c of cats) {
      expect(ADMIN_AREA_MIN_LEVEL[c.area]).toBe(ROLE_LEVEL.salonAdmin)
    }
  })

  it('branschlagret styr etiketterna för personal/tjänst — aldrig hårdkodat', () => {
    const restaurang = settingsCategories({
      staff_plural: 'Kockar',
      service_plural: 'Rätter',
    })
    expect(restaurang.find((c) => c.id === 'personal')?.label).toBe('Kockar')
    expect(restaurang.find((c) => c.id === 'tjanster')?.label).toBe('Rätter')
  })

  it('utan bransch faller etiketterna tillbaka på de generella orden', () => {
    expect(cats.find((c) => c.id === 'personal')?.label).toBe('Personal')
    expect(cats.find((c) => c.id === 'tjanster')?.label).toBe('Tjänster')
  })

  it('inga bransch-ord i kategoritexterna', () => {
    const text = cats.map((c) => `${c.label} ${c.hint}`).join(' ').toLowerCase()
    for (const w of ['salong', 'frisör', 'klippning', 'stylist', 'barber']) {
      expect(text).not.toContain(w)
    }
  })
})
