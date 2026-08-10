export type StorefrontExperience = 'freshcut-motiontest' | null

export function storefrontExperienceFromHeader(
  value: string | null | undefined,
): StorefrontExperience {
  return value === 'freshcut-motiontest' ? value : null
}

type StorefrontExperienceResolution = {
  experience: Exclude<StorefrontExperience, null>
  tenantSlug: 'freshcut'
}

const MOTIONTEST_HOSTS = new Set(['motiontest.corevo.se', 'motiontest.localhost'])
const MOTIONTEST_AUTHORITY = /^(motiontest\.corevo\.se|motiontest\.localhost)(?::(\d+))?$/i

const hostnameFromHost = (host: string | null | undefined): string | null => {
  const match = host ? MOTIONTEST_AUTHORITY.exec(host) : null
  if (!match) return null
  const hostname = match[1]
  if (!hostname) return null
  const port = match[2] ? Number(match[2]) : null
  if (port !== null && (port < 1 || port > 65535)) return null
  return hostname.toLowerCase()
}

export function storefrontExperienceForHost(
  host: string | null | undefined,
): StorefrontExperienceResolution | null {
  const hostname = hostnameFromHost(host)
  if (!hostname || !MOTIONTEST_HOSTS.has(hostname)) return null
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
