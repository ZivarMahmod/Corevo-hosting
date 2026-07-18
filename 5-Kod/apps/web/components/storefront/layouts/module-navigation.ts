import type { LayoutModuleTeasers } from './types'

export type ModuleNavigationLink = { href: string; label: string }

export function canonicalModuleHref(href: string): string {
  return href.replace(/^\/stamkund(?=\/|[?#]|$)/, '/klubb')
}

const MODULE_ROUTES = {
  shop: 'shopReachable',
  blogg: 'bloggReachable',
  offert: 'offertReachable',
  presentkort: 'presentkortReachable',
  klubb: 'lojalitetReachable',
  kurser: 'kurserReachable',
  galleri: 'galleriReachable',
} as const satisfies Record<string, keyof LayoutModuleTeasers>

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
  const flag = MODULE_ROUTES[segment as keyof typeof MODULE_ROUTES]
  return flag ? modules[flag] === true : false
}

export function moduleNavigationLinks(modules: LayoutModuleTeasers): ModuleNavigationLink[] {
  return [
    modules.shopReachable ? { href: '/shop', label: 'Butik' } : null,
    modules.kurserReachable ? { href: '/kurser', label: 'Kurser' } : null,
    modules.bloggReachable ? { href: '/blogg', label: 'Blogg' } : null,
    modules.offertReachable ? { href: '/offert', label: 'Offert' } : null,
    modules.presentkortReachable ? { href: '/presentkort', label: 'Presentkort' } : null,
    modules.lojalitetReachable ? { href: '/klubb', label: 'Klubben' } : null,
    modules.galleriReachable ? { href: '/galleri', label: 'Galleri' } : null,
  ].filter((link): link is ModuleNavigationLink => link !== null)
}
