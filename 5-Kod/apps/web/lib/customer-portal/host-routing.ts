import type { TenantResolution } from '@/lib/tenant'

export const CUSTOMER_PORTAL_ROUTE_PATTERNS = [
  /^\/oppna\/[a-z0-9-]+$/,
  /^\/aterhamta\/[a-z0-9-]+$/,
  /^\/verifiera\/[a-z0-9-]+$/,
  /^\/hjalp$/,
  /^\/mina$/,
  /^\/mina\/historik$/,
  /^\/mina\/bokningar\/[a-zA-Z0-9_-]+$/,
  /^\/mina\/profil$/,
  /^\/mina\/sakerhet$/,
  /^\/mina\/installera$/,
  /^\/mina\/integritet$/,
] as const

const STATIC_PATHS = new Set([
  '/favicon.ico',
  '/icon.svg',
  '/pwa/customer-portal-icon-192.png',
  '/pwa/customer-portal-icon-512.png',
])

const normalize = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

export function isCustomerPortalPagePath(pathname: string): boolean {
  const path = normalize(pathname)
  return CUSTOMER_PORTAL_ROUTE_PATTERNS.some((pattern) => pattern.test(path))
}

export function isCustomerPortalApiPath(pathname: string): boolean {
  const path = normalize(pathname)
  return path === '/api/customer-portal' || path.startsWith('/api/customer-portal/')
}

export function isCustomerPortalStaticPath(pathname: string): boolean {
  const path = normalize(pathname)
  return path.startsWith('/_next/static/') || STATIC_PATHS.has(path)
}

export function isCustomerPortalRequestPath(pathname: string): boolean {
  return isCustomerPortalPagePath(pathname) || isCustomerPortalApiPath(pathname)
}

function isCustomerPortalNamespace(pathname: string): boolean {
  const path = normalize(pathname)
  return ['/oppna', '/aterhamta', '/verifiera', '/hjalp', '/mina', '/api/customer-portal'].some(
    (prefix) => path === prefix || path.startsWith(prefix + '/'),
  )
}

export function isStaticRequestPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname === '/favicon.ico' ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/i.test(pathname)
  )
}

export function decideCustomerPortalHostRoute(input: {
  hostKind: TenantResolution['kind']
  pathname: string
  preview: boolean
}): 'allow' | 'deny' {
  const allowed =
    isCustomerPortalRequestPath(input.pathname) || isCustomerPortalStaticPath(input.pathname)
  if (input.hostKind === 'customer_portal') return allowed ? 'allow' : 'deny'
  if (isCustomerPortalNamespace(input.pathname)) return input.preview && allowed ? 'allow' : 'deny'
  return 'allow'
}
