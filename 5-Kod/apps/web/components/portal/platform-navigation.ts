export type PlatformAreaId = 'overview' | 'customers' | 'finance' | 'insight' | 'platform'

export type PlatformNavItem = {
  href: string
  label: string
}

export type PlatformArea = PlatformNavItem & {
  id: PlatformAreaId
  prefixes: readonly string[]
}

/** The five destinations in the superadmin handoff, mapped to today's real URLs. */
export const PLATFORM_AREAS: readonly PlatformArea[] = [
  { id: 'overview', href: '/', label: 'Översikt', prefixes: ['/', '/platform'] },
  { id: 'customers', href: '/salonger', label: 'Kunder', prefixes: ['/salonger'] },
  { id: 'finance', href: '/fakturering', label: 'Ekonomi', prefixes: ['/fakturering'] },
  {
    id: 'insight',
    href: '/kunder',
    label: 'Insyn',
    prefixes: ['/kunder', '/personal-plattform', '/drift-och-logg'],
  },
  {
    id: 'platform',
    href: '/branscher',
    label: 'Plattform',
    prefixes: ['/branscher', '/integrationer', '/domaner', '/roller', '/installningar'],
  },
] as const

export const PLATFORM_SUBNAV: Partial<Record<PlatformAreaId, readonly PlatformNavItem[]>> = {
  insight: [
    { href: '/kunder', label: 'Slutkunder' },
    { href: '/personal-plattform', label: 'Personal' },
    { href: '/drift-och-logg', label: 'Loggar' },
  ],
  platform: [
    { href: '/branscher', label: 'Branscher' },
    { href: '/integrationer', label: 'Integrationer' },
    { href: '/domaner', label: 'Domäner' },
    { href: '/roller', label: 'Roller' },
    { href: '/installningar', label: 'Inställningar' },
  ],
}

export function platformPathMatches(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/'
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function activePlatformArea(pathname: string): PlatformArea {
  return (
    PLATFORM_AREAS.find((area) =>
      area.prefixes.some((prefix) => platformPathMatches(pathname, prefix)),
    ) ?? PLATFORM_AREAS[0]!
  )
}
