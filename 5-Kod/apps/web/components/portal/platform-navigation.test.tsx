import { describe, expect, it } from 'vitest'
import { PLATFORM_ROUTE_PREFIXES } from '@/lib/auth/platform-routes'
import { NAV, isGroup, paletteFromNav } from './nav-items'
import {
  PLATFORM_AREAS,
  PLATFORM_SUBNAV,
  activePlatformArea,
  platformMobileNavigation,
  platformPathMatches,
} from './platform-navigation'
import { activeTopnavArea } from './Topnav'

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
    expect(NAV.platform.items).toContainEqual({ href: '/utskick', label: 'Utskick', icon: 'message' })
    expect(paletteFromNav('platform')).toContainEqual({
      href: '/utskick',
      label: 'Utskick',
      icon: 'message',
      kind: 'Gå till',
    })
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

  it('arrangerar exakt fyra driftflikar och Ny kund som mobil FAB', () => {
    const mobile = platformMobileNavigation(PLATFORM_AREAS)

    expect(mobile.tabs.map(({ id, href, label }) => ({ id, href, label }))).toEqual([
      { id: 'overview', href: '/', label: 'Översikt' },
      { id: 'customers', href: '/salonger', label: 'Kunder' },
      { id: 'insight', href: '/kunder', label: 'Insyn' },
      { id: 'drift', href: '/drift-och-logg', label: 'Drift' },
    ])
    expect(mobile.action).toEqual({ href: '/salonger/ny', label: 'Ny kund' })
  })

  it('gör varje registrerad plattformsdestination nåbar exakt en gång på mobil', () => {
    const mobile = platformMobileNavigation(PLATFORM_AREAS)
    const navHrefs = NAV.platform.items.flatMap((item) => (isGroup(item) ? [] : [item.href]))
    const mobileHrefs = [
      ...mobile.tabs.map(({ href }) => href),
      ...(mobile.action ? [mobile.action.href] : []),
      ...mobile.more.map(({ href }) => href),
    ]

    expect([...mobileHrefs].sort()).toEqual([...navHrefs].sort())
    expect(new Set(mobileHrefs).size).toBe(mobileHrefs.length)
    expect(mobile.more.map(({ href }) => href)).toEqual([
      '/fakturering',
      '/personal-plattform',
      '/utskick',
      '/branscher',
      '/integrationer',
      '/domaner',
      '/roller',
      '/installningar',
    ])
  })

  it('markerar mobilens egna flikar och Mer utan att ändra desktop-IA:n', () => {
    const mobile = platformMobileNavigation(PLATFORM_AREAS)
    const mobileAreas = [...mobile.tabs, ...mobile.more]
    const activeMobileId = (pathname: string) => activeTopnavArea(pathname, mobileAreas)?.id

    expect(activeMobileId('/salonger/ny')).toBe('customers')
    expect(activeMobileId('/drift-och-logg/events')).toBe('drift')
    expect(activeMobileId('/utskick')).toBe('outbox')
    expect(activeMobileId('/integrationer')).toBe('integrations')
    expect(activePlatformArea('/drift-och-logg/events').id).toBe('insight')
  })

  it('återinför varken kundflik eller FAB om serverlistan saknar kundområdet', () => {
    const scoped = platformMobileNavigation(
      PLATFORM_AREAS.filter((area) => area.id !== 'customers'),
    )

    expect(scoped.tabs.some((area) => area.id === 'customers')).toBe(false)
    expect(scoped.action).toBeUndefined()
  })
})
