export const PLATFORM_LEGACY_CUSTOMERS_PREFIX = '/salonger'
export const PLATFORM_CUSTOMERS_PREFIX = '/kunder'

/** Maps only the retired whole-segment tenant route to the canonical customer
 * route. `/kunder` itself is deliberately never redirected: after goal-72 S6 it
 * owns the tenant master/detail surface, while final customers live at
 * `/slutkunder`. */
export function canonicalPlatformLegacyPath(pathname: string): string | null {
  if (pathname === PLATFORM_LEGACY_CUSTOMERS_PREFIX) return PLATFORM_CUSTOMERS_PREFIX
  if (!pathname.startsWith(`${PLATFORM_LEGACY_CUSTOMERS_PREFIX}/`)) return null
  return `${PLATFORM_CUSTOMERS_PREFIX}${pathname.slice(PLATFORM_LEGACY_CUSTOMERS_PREFIX.length)}`
}

/** Preview/dev uses a unified booking host and therefore cannot use the
 * production-only host rule in next.config. Return a query-preserving 308 target
 * only for that preview platform door; tenant and unknown hosts stay untouched. */
export function canonicalPreviewPlatformLegacyUrl(
  url: URL,
  host: { preview: boolean; platform: boolean },
): URL | null {
  if (!host.preview || !host.platform) return null
  const pathname = canonicalPlatformLegacyPath(url.pathname)
  if (!pathname) return null
  const destination = new URL(url)
  destination.pathname = pathname
  return destination
}
