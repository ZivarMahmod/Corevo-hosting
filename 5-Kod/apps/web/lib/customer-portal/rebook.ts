import { buildTenantBookingPath } from '@/lib/booking/preselection'
import { DEFAULT_RESERVED_SUBDOMAINS } from '@/lib/tenant'

const TENANT_SLUG_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DNS_LABEL_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/
const RESERVED_TENANT_SLUGS = new Set<string>(DEFAULT_RESERVED_SUBDOMAINS)
// These labels are unsafe anywhere in a verified external domain. Platform
// labels such as `boka` are only reserved as Corevo tenant slugs; a legitimate
// customer domain like boka.freshcut.se must remain usable.
const UNSAFE_CUSTOM_DOMAIN_LABELS = new Set(['admin', 'internal', 'localhost', 'portal', 'sms'])

type PortalOriginContext = {
  tenantSlug: string
  bookingOrigin: string
}

type PortalRebookContext = PortalOriginContext & {
  /** Omit for a general tenant booking target; null means the booking is not rebookable. */
  bookingUrl?: string | null
}

function rawHttpsAuthority(value: string): string | null {
  const match = /^https:\/\/([^/?#]+)(?:[/?#]|$)/.exec(value)
  return match?.[1] ?? null
}

function safeDnsHostname(hostname: string): boolean {
  if (
    hostname.length > 253 ||
    hostname.includes('..') ||
    hostname.includes(':') ||
    hostname.includes('[') ||
    hostname.includes(']') ||
    hostname.includes('corevo')
  ) return false

  const labels = hostname.split('.')
  if (labels.length < 2 || labels.some((label) => !DNS_LABEL_PATTERN.test(label))) return false
  if (!/^[a-z]{2,63}$/.test(labels.at(-1) ?? '')) return false
  if (labels.some((label) => label.startsWith('xn--') || UNSAFE_CUSTOM_DOMAIN_LABELS.has(label))) return false
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return false
  return true
}

export function validatePortalBookingOrigin({
  tenantSlug,
  bookingOrigin,
}: PortalOriginContext): string | null {
  if (
    !TENANT_SLUG_PATTERN.test(tenantSlug) ||
    tenantSlug.startsWith('xn--') ||
    RESERVED_TENANT_SLUGS.has(tenantSlug) ||
    typeof bookingOrigin !== 'string' ||
    bookingOrigin.trim() !== bookingOrigin ||
    bookingOrigin.length > 2048 ||
    /[\u0000-\u001f\u007f]/.test(bookingOrigin)
  ) return null

  const authority = rawHttpsAuthority(bookingOrigin)
  if (!authority || authority.includes('@') || authority.includes(':') || authority !== authority.toLowerCase()) {
    return null
  }

  try {
    const url = new URL(bookingOrigin)
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.port !== '' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== '' ||
      url.hostname !== authority ||
      url.origin !== bookingOrigin
    ) return null

    const canonicalHost = `${tenantSlug}.boka.corevo.se`
    if (url.hostname === canonicalHost) return bookingOrigin
    return safeDnsHostname(url.hostname) ? bookingOrigin : null
  } catch {
    return null
  }
}

export function buildPortalRebookUrl({
  tenantSlug,
  bookingOrigin,
  bookingUrl,
}: PortalRebookContext): string | null {
  const origin = validatePortalBookingOrigin({ tenantSlug, bookingOrigin })
  if (!origin) return null
  if (bookingUrl === undefined) return `${origin}/boka`
  if (bookingUrl === null || typeof bookingUrl !== 'string') return null
  if (
    bookingUrl.trim() !== bookingUrl ||
    bookingUrl.length > 2048 ||
    /[\u0000-\u001f\u007f]/.test(bookingUrl)
  ) return null

  const authority = rawHttpsAuthority(bookingUrl)
  if (!authority || authority.includes('@') || authority.includes(':') || authority !== authority.toLowerCase()) {
    return null
  }

  try {
    const url = new URL(bookingUrl)
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.port !== '' ||
      url.origin !== origin ||
      url.pathname !== '/boka' ||
      url.hash !== ''
    ) return null

    if (url.search === '') return `${origin}/boka`
    const keys = [...url.searchParams.keys()]
    const locations = url.searchParams.getAll('plats')
    const services = url.searchParams.getAll('tjanst')
    const canonicalKeys =
      (keys.length === 1 && (keys[0] === 'plats' || keys[0] === 'tjanst')) ||
      (keys.length === 2 && keys[0] === 'plats' && keys[1] === 'tjanst')
    if (
      !canonicalKeys ||
      locations.length > 1 ||
      services.length > 1 ||
      (locations.length === 1 && !UUID_PATTERN.test(locations[0] ?? '')) ||
      (services.length === 1 && !UUID_PATTERN.test(services[0] ?? ''))
    ) {
      return null
    }
    return `${origin}${buildTenantBookingPath({
      locationId: locations[0] ?? null,
      serviceId: services[0] ?? null,
    })}`
  } catch {
    return null
  }
}
