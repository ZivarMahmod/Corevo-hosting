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

const decodeImageSource = (source: string): string | null => {
  let decoded = source
  for (let i = 0; i < 4 && decoded.includes('%'); i++) {
    try {
      decoded = decodeURIComponent(decoded)
    } catch {
      return null
    }
  }
  return decoded.includes('%') ? null : decoded
}

const isMotiontestFreshCutImageSource = (source: string | null): boolean => {
  if (!source) return false
  const decoded = decodeImageSource(source)
  if (!decoded?.startsWith('/images/freshcut/') || decoded.includes('\\')) return false
  return decoded.split('/').every((segment) => segment !== '.' && segment !== '..')
}

export function isMotiontestPublicPath(
  pathname: string,
  search: URLSearchParams | null | undefined = null,
): boolean {
  return (
    pathname === '/' ||
    pathname === '/robots.txt' ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg' ||
    pathname.startsWith('/_next/static/') ||
    (pathname === '/_next/image' && isMotiontestFreshCutImageSource(search?.get('url') ?? null)) ||
    pathname.startsWith('/images/freshcut/')
  )
}
