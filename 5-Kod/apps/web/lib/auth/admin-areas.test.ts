import { describe, it, expect } from 'vitest'
import {
  ADMIN_AREA_MIN_LEVEL,
  ADMIN_PORTAL_FLOOR,
  ROLE_LEVEL,
  adminAreaForPath,
  canAccessAdminArea,
  type AdminArea,
} from './admin-areas'

const staff = { roleLevel: ROLE_LEVEL.staff, platformAdmin: false }
const salonAdmin = { roleLevel: ROLE_LEVEL.salonAdmin, platformAdmin: false }
const kund = { roleLevel: ROLE_LEVEL.kund, platformAdmin: false }

const STAFF_ALLOWED: AdminArea[] = ['oversikt', 'bokningar', 'kunder']
const STAFF_DENIED: AdminArea[] = [
  'installningar',
  'personal',
  'scheman',
  'varumarke',
  'sida',
  'webshop',
  'blogg',
  'media',
  'lojalitet',
  'presentkort',
  'tjanster',
  'platser',
  'kurser',
  'offerter',
  'statistik',
]

describe('roll-separation — personal (staff, nivå 3)', () => {
  it.each(STAFF_ALLOWED)('släpps in på %s (arbetsdagen)', (area) => {
    expect(canAccessAdminArea(area, staff)).toBe(true)
  })

  it.each(STAFF_DENIED)('nekas på %s (systemadministration)', (area) => {
    expect(canAccessAdminArea(area, staff)).toBe(false)
  })

  it('täcker VARJE yta i tabellen (ingen yta glider igenom otestad)', () => {
    const keys = Object.keys(ADMIN_AREA_MIN_LEVEL).sort()
    expect([...STAFF_ALLOWED, ...STAFF_DENIED].sort()).toEqual(keys)
  })
})

describe('roll-separation — ägare/administratör (salon_admin, nivå 6)', () => {
  it.each(Object.keys(ADMIN_AREA_MIN_LEVEL) as AdminArea[])('släpps in på %s', (area) => {
    expect(canAccessAdminArea(area, salonAdmin)).toBe(true)
  })
})

describe('roll-separation — kund (nivå 2) och platform_admin', () => {
  it.each(Object.keys(ADMIN_AREA_MIN_LEVEL) as AdminArea[])('kund nekas på %s', (area) => {
    expect(canAccessAdminArea(area, kund)).toBe(false)
  })

  it('platform_admin passerar allt oavsett nivå', () => {
    for (const area of Object.keys(ADMIN_AREA_MIN_LEVEL) as AdminArea[]) {
      expect(canAccessAdminArea(area, { roleLevel: 0, platformAdmin: true })).toBe(true)
    }
  })
})

describe('portalens golv', () => {
  it('är staff-nivån — layouten släpper in personalen, sidan gatar ytan', () => {
    expect(ADMIN_PORTAL_FLOOR).toBe(ROLE_LEVEL.staff)
  })
})

describe('adminAreaForPath', () => {
  it('mappar rutt → yta (längsta prefixet vinner)', () => {
    expect(adminAreaForPath('/admin')).toBe('oversikt')
    expect(adminAreaForPath('/admin/bokningar')).toBe('bokningar')
    expect(adminAreaForPath('/admin/bokningar/vy')).toBe('bokningar')
    expect(adminAreaForPath('/admin/kunder/abc-123')).toBe('kunder')
    expect(adminAreaForPath('/admin/installningar')).toBe('installningar')
    expect(adminAreaForPath('/admin/statistik')).toBe('statistik')
  })

  it('är inte en adminrutt → null', () => {
    expect(adminAreaForPath('/personal')).toBeNull()
    expect(adminAreaForPath('/adminstuff')).toBeNull()
  })
})
