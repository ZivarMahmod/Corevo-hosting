import { describe, expect, it } from 'vitest'
import type { LayoutModuleTeasers } from './types'
import { canonicalModuleHref, moduleNavigationLinks, moduleRouteReachable } from './module-navigation'

const NONE = {
  shopTeasers: [],
  bloggTeasers: [],
  bookingReachable: false,
  presentkortReachable: false,
  shopReachable: false,
  bloggReachable: false,
  offertReachable: false,
  lojalitetReachable: false,
  kurserReachable: false,
  galleriReachable: false,
} as LayoutModuleTeasers

describe('module navigation uses the same reachability as target routes', () => {
  it('does not emit module links when their state or required data is missing', () => {
    expect(moduleNavigationLinks(NONE)).toEqual([])
  })

  it('emits only canonical paths for reachable modules', () => {
    const links = moduleNavigationLinks({
      ...NONE,
      shopReachable: true,
      bloggReachable: true,
      offertReachable: true,
      presentkortReachable: true,
      lojalitetReachable: true,
      kurserReachable: true,
      galleriReachable: true,
    })
    expect(links.map((link) => link.href)).toEqual([
      '/shop',
      '/kurser',
      '/blogg',
      '/offert',
      '/presentkort',
      '/klubb',
      '/galleri',
    ])
    expect(links.some((link) => link.href === '/stamkund')).toBe(false)
  })

  it('gates configured primary CTAs with booking and module reachability', () => {
    expect(moduleRouteReachable('/boka', NONE, false)).toBe(false)
    expect(moduleRouteReachable('/boka', NONE, true)).toBe(true)
    expect(moduleRouteReachable('/shop/product-1', NONE, true)).toBe(false)
    expect(moduleRouteReachable('/shop/product-1', { ...NONE, shopReachable: true }, true)).toBe(true)
    expect(moduleRouteReachable('/kontakt', NONE, false)).toBe(true)
    expect(moduleRouteReachable('/admin', NONE, true)).toBe(false)
    expect(moduleRouteReachable('/admin/salonger', NONE, true)).toBe(false)
    expect(moduleRouteReachable('/okand', NONE, true)).toBe(false)
    expect(moduleRouteReachable('//evil.example', NONE, true)).toBe(false)
    expect(moduleRouteReachable('/presentkort/hemlig', { ...NONE, presentkortReachable: true }, true)).toBe(false)
    expect(moduleRouteReachable('/shop/product-1/extra', { ...NONE, shopReachable: true }, true)).toBe(false)
  })

  it('normalizes the removed loyalty alias to the canonical club route', () => {
    expect(canonicalModuleHref('/stamkund')).toBe('/klubb')
    expect(canonicalModuleHref('/stamkund?fran=hem')).toBe('/klubb?fran=hem')
    expect(canonicalModuleHref('/kontakt')).toBe('/kontakt')
  })
})
