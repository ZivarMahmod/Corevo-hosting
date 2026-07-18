import type { TopnavArea, TopnavMobileNavigation } from './Topnav'

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
  { id: 'customers', href: '/kunder', label: 'Kunder', prefixes: ['/kunder'] },
  { id: 'finance', href: '/fakturering', label: 'Ekonomi', prefixes: ['/fakturering'] },
  {
    id: 'insight',
    href: '/slutkunder',
    label: 'Insyn',
    prefixes: ['/slutkunder', '/personal-plattform', '/utskick', '/drift-och-logg'],
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
    { href: '/slutkunder', label: 'Slutkunder' },
    { href: '/personal-plattform', label: 'Personal' },
    { href: '/utskick', label: 'Utskick' },
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

/** Mobilen omarrangerar samma servergodkända plattformsområden som desktop. Insyns
 * undersidor måste bli egna destinationer eftersom desktopens subnav döljs under
 * 768 px. Expansionen sker bara när det ägande toppområdet finns i `areas`, så den
 * här hjälpen kan inte återinföra en yta som en framtida partner-scope har filtrerat
 * bort på servern. */
export function platformMobileNavigation(
  areas: readonly TopnavArea[],
): TopnavMobileNavigation {
  const byId = new Map(areas.map((area) => [area.id, area]))
  const overview = byId.get('overview')
  const customers = byId.get('customers')
  const finance = byId.get('finance')
  const insight = byId.get('insight')
  const platform = byId.get('platform')

  const tabs: TopnavArea[] = [
    ...(overview ? [overview] : []),
    ...(customers ? [customers] : []),
    ...(insight
      ? [
          { ...insight, prefixes: ['/slutkunder'] },
          {
            id: 'drift',
            href: '/drift-och-logg',
            label: 'Drift',
            prefixes: ['/drift-och-logg'],
          },
        ]
      : []),
  ]

  const more: TopnavArea[] = [
    ...(finance ? [finance] : []),
    ...(insight
      ? [
          {
            id: 'staff-insight',
            href: '/personal-plattform',
            label: 'Personal',
            prefixes: ['/personal-plattform'],
          },
          {
            id: 'outbox',
            href: '/utskick',
            label: 'Utskick',
            prefixes: ['/utskick'],
          },
        ]
      : []),
    ...(platform
      ? [
          { id: 'verticals', href: '/branscher', label: 'Branscher', prefixes: ['/branscher'] },
          {
            id: 'integrations',
            href: '/integrationer',
            label: 'Integrationer',
            prefixes: ['/integrationer'],
          },
          { id: 'domains', href: '/domaner', label: 'Domäner', prefixes: ['/domaner'] },
          { id: 'roles', href: '/roller', label: 'Roller', prefixes: ['/roller'] },
          {
            id: 'platform-settings',
            href: '/installningar',
            label: 'Inställningar',
            prefixes: ['/installningar'],
          },
        ]
      : []),
  ]

  return {
    tabs,
    more,
    ...(customers ? { action: { href: '/kunder/ny', label: 'Ny kund' } } : {}),
  }
}
