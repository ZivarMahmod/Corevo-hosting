import { describe, expect, it } from 'vitest'
import { adminAreas, adminMobileNavigation } from './admin-navigation'
import { activeTopnavArea } from './Topnav'

/** goal-65: kund-adminens toppnav. Reglerna som testas är låsta beslut, inte smak:
 *  en verksamhet utan moduler ser exakt fem val (codex/00 §"Målets toppnavigation"),
 *  bara AKTIVERADE moduler får synas (nav-items.ts modulgating), och aktivmarkeringen
 *  måste skilja /admin från /admin/kunder. */

const label = (areas: ReturnType<typeof adminAreas>) => areas.map((a) => a.label)

describe('adminAreas', () => {
  it('visar exakt de fem huvudvalen för en verksamhet utan moduler', () => {
    expect(label(adminAreas([]))).toEqual([
      'Översikt',
      'Kalender',
      'Kunder',
      'Redigera sidan',
      'Inställningar',
    ])
  })

  it('lägger in aktiverade moduler som egna poster, före Redigera sidan', () => {
    expect(label(adminAreas(['shop', 'blogg']))).toEqual([
      'Översikt',
      'Kalender',
      'Kunder',
      'Webshop',
      'Blogg',
      'Redigera sidan',
      'Inställningar',
    ])
  })

  it('visar aldrig en modul som kunden inte aktiverat', () => {
    expect(label(adminAreas(['shop']))).not.toContain('Presentkort')
  })

  it('säger aldrig "Superadmin" eller läcker plattformsytor', () => {
    const hrefs = adminAreas(undefined).map((a) => a.href)
    expect(hrefs.every((href) => href.startsWith('/admin'))).toBe(true)
    expect(hrefs).not.toContain('/salonger')
  })
})

describe('aktivt område', () => {
  const areas = adminAreas([])
  const activeId = (pathname: string) => activeTopnavArea(pathname, areas)?.id

  it('markerar Översikt bara på /admin, inte på undersidorna', () => {
    expect(activeId('/admin')).toBe('oversikt')
    expect(activeId('/admin/kunder')).toBe('kunder')
    expect(activeId('/admin/bokningar')).toBe('kalender')
  })

  it('håller Inställningar aktiv på sina undersidor', () => {
    for (const path of [
      '/admin/installningar',
      '/admin/personal',
      '/admin/tjanster',
      '/admin/scheman',
      '/admin/platser',
    ]) {
      expect(activeId(path)).toBe('installningar')
    }
  })

  it('ger Inställningar en subnav och de andra områdena ingen', () => {
    const settings = areas.find((a) => a.id === 'installningar')
    // L3 C-01: subnaven = kartans nio kategorier minus "Din sida" (eget huvudval)
    // plus ingången "Alla inställningar" = 9 poster, härledda ur settings-map.ts.
    expect(settings?.subnav?.length).toBe(9)
    expect(settings?.subnav?.[0]?.href).toBe('/admin/installningar')
    expect(settings?.subnav?.some((i) => i.href === '/admin/sida')).toBe(false)
    expect(areas.find((a) => a.id === 'kalender')?.subnav).toBeUndefined()
  })
})

describe('mobil admin-navigation', () => {
  it('behåller driftvalen i bottennaven och flyttar resten till Mer', () => {
    const mobile = adminMobileNavigation(adminAreas(['shop', 'blogg']))

    expect(mobile.tabs.map((area) => area.id)).toEqual(['oversikt', 'kalender', 'kunder'])
    expect(mobile.more.map((area) => area.label)).toEqual([
      'Webshop',
      'Blogg',
      'Redigera sidan',
      'Inställningar',
    ])
    expect(mobile.action).toEqual({ href: '/admin/bokningar?ny', label: 'Ny bokning' })
  })

  it('tappar aldrig ett huvudval när aktiva moduler saknas', () => {
    const areas = adminAreas([])
    const mobile = adminMobileNavigation(areas)

    expect([...mobile.tabs, ...mobile.more]).toEqual(areas)
  })
})
