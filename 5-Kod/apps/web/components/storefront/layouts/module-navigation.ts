import type { LayoutModuleTeasers } from './types'

export type ModuleNavigationLink = { href: string; label: string }

export const MODULE_SURFACES = [
  { key: 'booking', href: '/boka', label: 'Boka', reachable: 'bookingReachable', navigation: false, fallback: 'booking' },
  { key: 'shop', href: '/shop', label: 'Butik', reachable: 'shopReachable', navigation: true, fallback: 'generic' },
  { key: 'kurser', href: '/kurser', label: 'Kurser', reachable: 'kurserReachable', navigation: true, fallback: 'generic' },
  { key: 'blogg', href: '/blogg', label: 'Blogg', reachable: 'bloggReachable', navigation: true, fallback: 'generic' },
  { key: 'offert', href: '/offert', label: 'Offert', reachable: 'offertReachable', navigation: true, fallback: 'generic' },
  { key: 'presentkort', href: '/presentkort', label: 'Presentkort', reachable: 'presentkortReachable', navigation: true, fallback: 'generic' },
  { key: 'klubb', href: '/klubb', label: 'Klubben', reachable: 'lojalitetReachable', navigation: true, fallback: 'generic' },
  { key: 'galleri', href: '/galleri', label: 'Galleri', reachable: 'galleriReachable', navigation: true, fallback: 'generic' },
] as const satisfies readonly {
  key: string
  href: `/${string}`
  label: string
  reachable: keyof LayoutModuleTeasers
  navigation: boolean
  fallback: 'booking' | 'generic'
}[]

export function canonicalModuleHref(href: string): string {
  return href.replace(/^\/stamkund(?=\/|[?#]|$)/, '/klubb')
}

export function moduleRouteReachable(
  href: string,
  modules: LayoutModuleTeasers,
  bookingReachable: boolean,
): boolean {
  const path = canonicalModuleHref(href).split(/[?#]/, 1)[0] ?? ''
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.includes('..')) {
    return false
  }
  if (path === '/boka' || path === '/boka/') return bookingReachable
  if (path === '/' || /^\/(?:tjanster|kontakt|om|team)\/?$/u.test(path)) return true

  const moduleMatch = path.match(/^\/(shop|blogg|offert|presentkort|klubb|kurser|galleri)(?:\/([^/]+))?\/?$/u)
  if (!moduleMatch) return false
  const [, segment, subpage] = moduleMatch
  if (subpage && segment !== 'shop' && segment !== 'blogg') return false
  if (subpage && !/^[\p{L}\p{N}_-]+$/u.test(subpage)) return false
  const surface = MODULE_SURFACES.find((entry) => entry.key === segment)
  return surface ? modules[surface.reachable] === true : false
}

export function moduleNavigationLinks(modules: LayoutModuleTeasers): ModuleNavigationLink[] {
  return MODULE_SURFACES
    .filter((surface) => surface.navigation && modules[surface.reachable] === true)
    .map(({ href, label }) => ({ href, label }))
}
