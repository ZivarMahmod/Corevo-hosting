export type StorefrontExperience = 'freshcut-motiontest' | null

type StorefrontExperienceResolution = {
  experience: Exclude<StorefrontExperience, null>
  tenantSlug: 'freshcut'
}

const MOTIONTEST_HOSTS = new Set(['motiontest.corevo.se', 'motiontest.localhost'])

const hostnameFromHost = (host: string | null | undefined): string => {
  if (!host) return ''
  const portIndex = host.indexOf(':')
  return (portIndex === -1 ? host : host.slice(0, portIndex)).toLowerCase()
}

export function storefrontExperienceForHost(
  host: string | null | undefined,
): StorefrontExperienceResolution | null {
  if (!MOTIONTEST_HOSTS.has(hostnameFromHost(host))) return null
  return { experience: 'freshcut-motiontest', tenantSlug: 'freshcut' }
}

export function isMotiontestPublicPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/robots.txt' ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg' ||
    pathname.startsWith('/_next/static/') ||
    pathname === '/_next/image' ||
    pathname.startsWith('/_next/image?') ||
    pathname.startsWith('/images/freshcut/')
  )
}
