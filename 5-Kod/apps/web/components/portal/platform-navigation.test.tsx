import { describe, expect, it } from 'vitest'
import { PLATFORM_ROUTE_PREFIXES } from '@/lib/auth/platform-routes'
import { NAV, isGroup } from './nav-items'
import {
  PLATFORM_AREAS,
  PLATFORM_SUBNAV,
  activePlatformArea,
  platformPathMatches,
} from './platform-navigation'

const isRegistered = (href: string) =>
  href === '/' ||
  PLATFORM_ROUTE_PREFIXES.some(
    (prefix) => href === prefix || href.startsWith(`${prefix}/`),
  )

describe('superadmin navigation contract', () => {
  it('maps nested production routes to the correct five-area IA', () => {
    expect(activePlatformArea('/').id).toBe('overview')
    expect(activePlatformArea('/platform').id).toBe('overview')
    expect(activePlatformArea('/salonger/ny').id).toBe('customers')
    expect(activePlatformArea('/salonger/tenant-id').id).toBe('customers')
    expect(activePlatformArea('/fakturering').id).toBe('finance')
    expect(activePlatformArea('/personal-plattform').id).toBe('insight')
    expect(activePlatformArea('/utskick').id).toBe('insight')
    expect(activePlatformArea('/drift-och-logg/events').id).toBe('insight')
    expect(activePlatformArea('/branscher/florist').id).toBe('platform')
    expect(activePlatformArea('/domaner').id).toBe('platform')
  })

  it('exposes Kommunikationscenter as Utskick inside Insyn', () => {
    expect(PLATFORM_SUBNAV.insight).toContainEqual({ href: '/utskick', label: 'Utskick' })
  })

  it('keeps every visible platform link inside the shared route registry', () => {
    const sidebarLinks = NAV.platform.items.flatMap((item) => (isGroup(item) ? [] : [item]))
    const topLinks = PLATFORM_AREAS.map(({ href }) => href)
    const subLinks = Object.values(PLATFORM_SUBNAV).flatMap((items) =>
      (items ?? []).map(({ href }) => href),
    )

    for (const href of [...sidebarLinks.map(({ href }) => href), ...topLinks, ...subLinks]) {
      expect(isRegistered(href), href).toBe(true)
    }
  })

  it('uses whole route segments, not ambiguous string prefixes', () => {
    expect(platformPathMatches('/personal-plattform', '/personal')).toBe(false)
    expect(platformPathMatches('/salonger/abc', '/salonger')).toBe(true)
  })
})
