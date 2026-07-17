// Plan 010 (goal-71-följd): personliga tillägg (tenant_member_permissions) ska ge
// en SYNLIG väg i nav/⌘K/topnav — samma memberGrantsArea-beslut som sidgrinden.
// Testar hela kedjan: perms → grantedAdminAreas → isNavItemVisible/adminAreas.
import { describe, expect, it } from 'vitest'
import { isNavItemVisible, paletteFromNav } from './nav-items'
import { adminAreas } from './admin-navigation'
import {
  DEFAULT_MEMBER_PERMISSIONS,
  grantedAdminAreas,
  memberGrantsArea,
} from '@/lib/admin/member-permissions'
import { ADMIN_AREA_MIN_LEVEL as A } from '@/lib/auth/admin-areas'

const STAFF = 3

describe('grantedAdminAreas', () => {
  it('default (inga tillägg) beviljar ingenting', () => {
    expect(grantedAdminAreas(DEFAULT_MEMBER_PERMISSIONS)).toEqual([])
  })

  it('can_view_daily_metrics beviljar statistik; can_edit_site beviljar sida', () => {
    expect(
      grantedAdminAreas({ ...DEFAULT_MEMBER_PERMISSIONS, canViewDailyMetrics: true }),
    ).toEqual(['statistik'])
    expect(grantedAdminAreas({ ...DEFAULT_MEMBER_PERMISSIONS, canEditSite: true })).toEqual([
      'sida',
    ])
  })

  it('manager (PLATSCHEF) beviljar kunder + tjanster + scheman', () => {
    const granted = grantedAdminAreas({ ...DEFAULT_MEMBER_PERMISSIONS, operationalRole: 'manager' })
    expect(granted).toEqual(expect.arrayContaining(['kunder', 'tjanster', 'scheman']))
    expect(granted).not.toContain('statistik')
  })

  it('håller i synk med memberGrantsArea (samma beslut som sidgrinden)', () => {
    const perms = { ...DEFAULT_MEMBER_PERMISSIONS, canViewDailyMetrics: true, canEditSite: true }
    for (const area of grantedAdminAreas(perms)) {
      expect(memberGrantsArea(area, perms)).toBe(true)
    }
  })
})

describe('isNavItemVisible + grantedAreas', () => {
  const statistikItem = { href: '/admin/statistik', label: 'Statistik', icon: 'trendUp', minLevel: A.statistik } as const

  it('nivå 3 utan tillägg ser INTE statistik', () => {
    expect(isNavItemVisible(statistikItem, { roleLevel: STAFF })).toBe(false)
  })

  it('nivå 3 MED beviljad statistik ser posten', () => {
    expect(isNavItemVisible(statistikItem, { roleLevel: STAFF, grantedAreas: ['statistik'] })).toBe(
      true,
    )
  })

  it('tillägget öppnar BARA sin yta — inte andra nivå-6-poster', () => {
    const installningarItem = { href: '/admin/installningar', label: 'Inställningar', icon: 'settings', minLevel: A.installningar } as const
    expect(
      isNavItemVisible(installningarItem, { roleLevel: STAFF, grantedAreas: ['statistik'] }),
    ).toBe(false)
  })

  it('⌘K-paletten följer samma beslut', () => {
    const withoutGrant = paletteFromNav('admin', undefined, STAFF)
    const withGrant = paletteFromNav('admin', undefined, STAFF, ['statistik'])
    expect(withoutGrant.some((i) => i.href === '/admin/statistik')).toBe(false)
    expect(withGrant.some((i) => i.href === '/admin/statistik')).toBe(true)
  })
})

describe('adminAreas (topnav) + grantedAreas', () => {
  it('nivå 3 utan tillägg får ingen Redigera sidan-flik; med can_edit_site får den', () => {
    expect(adminAreas([], STAFF).some((a) => a.id === 'sida')).toBe(false)
    expect(adminAreas([], STAFF, ['sida']).some((a) => a.id === 'sida')).toBe(true)
  })

  it('ägare (6) påverkas inte av grantedAreas-parametern', () => {
    const withoutParam = adminAreas([], 6).map((a) => a.id)
    const withParam = adminAreas([], 6, []).map((a) => a.id)
    expect(withParam).toEqual(withoutParam)
  })
})
