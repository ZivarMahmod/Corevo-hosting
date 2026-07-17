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

  it('visar personal de tre arbetsytorna öppna och resten LÅSTA (2026-07-18)', () => {
    const areas = adminAreas(['shop', 'blogg'], 3)
    const open = areas.filter((a) => !a.locked).map((a) => a.label)
    const locked = areas.filter((a) => a.locked).map((a) => a.label)
    expect(open).toEqual(['Översikt', 'Kalender', 'Kunder'])
    // Aktiverade moduler + ägarytor syns men är låsta — de försvinner inte längre.
    expect(locked).toEqual(['Webshop', 'Blogg', 'Redigera sidan', 'Inställningar'])
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
      '/admin/installningar/bokningsflode',
    ]) {
      expect(activeId(path)).toBe('installningar')
    }
  })

  it('låter Redigera sidan äga sin egen route även när bokningsflödet länkar dit', () => {
    expect(activeId('/admin/sida')).toBe('sida')
  })

  it('använder 04-paketets enda vertikala inställningsnav', () => {
    const settings = areas.find((a) => a.id === 'installningar')
    // Designpaket 04 har ett kategorinav inne i Inställningar. En andra horisontell
    // flikrad duplicerar samma routes och gör övergången till ägandeytorna oklar.
    expect(settings).toBeDefined()
    expect(settings?.subnav).toBeUndefined()
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
