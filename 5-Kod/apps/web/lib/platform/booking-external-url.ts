export type BookingExternalCtaUrls = Record<string, string>
export const BOOKING_PROVIDERS = ['corevo', 'external'] as const
export type BookingProviderKind = (typeof BOOKING_PROVIDERS)[number]

export const normalizeBookingProvider = (value: unknown): BookingProviderKind =>
  value === 'external' ? 'external' : 'corevo'

export const BOOKING_EXTERNAL_CTA_FIELD_PREFIX = 'booking_external_cta_url:'
export const MAX_BOOKING_EXTERNAL_CTA_URLS = 64
const MAX_BOOKING_EXTERNAL_URL_LENGTH = 2048
const MAX_BOOKING_EXTERNAL_CTA_BYTES = 64 * 1024
const SERVICE_CTA_SLOT = /^service:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PAGE_CTA_SLOTS = new Set([
  'nav', 'hero', 'services-footer', 'results', 'studio', 'final', 'contact', 'mobile',
])

export const isBookingExternalCtaSlot = (value: string): boolean =>
  value.length <= 80 && (PAGE_CTA_SLOTS.has(value) || SERVICE_CTA_SLOT.test(value))

const serializedBytes = (value: BookingExternalCtaUrls): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength

/** Normalise an external booking destination stored in settings JSON. */
export function normalizeBookingExternalUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const candidate = value.trim()
  if (!candidate || candidate.length > MAX_BOOKING_EXTERNAL_URL_LENGTH || /[\u0000-\u001f\u007f]/.test(candidate)) return null
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
    return candidate
  } catch {
    return null
  }
}

export function normalizeBookingExternalCtaUrls(value: unknown): BookingExternalCtaUrls {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const urls: BookingExternalCtaUrls = {}
  for (const [slotId, rawUrl] of Object.entries(value)) {
    if (Object.keys(urls).length >= MAX_BOOKING_EXTERNAL_CTA_URLS) break
    const url = isBookingExternalCtaSlot(slotId) ? normalizeBookingExternalUrl(rawUrl) : null
    if (url) urls[slotId] = url
  }
  return serializedBytes(urls) <= MAX_BOOKING_EXTERNAL_CTA_BYTES ? urls : {}
}

/** Parse the bounded, code-owned CTA fields submitted by the booking editor. */
export function parseBookingExternalCtaUrls(formData: FormData): BookingExternalCtaUrls | null {
  const entries = [...formData.entries()].filter(([name]) => name.startsWith(BOOKING_EXTERNAL_CTA_FIELD_PREFIX))
  if (entries.length > MAX_BOOKING_EXTERNAL_CTA_URLS) return null

  const urls: BookingExternalCtaUrls = {}
  for (const [name, rawValue] of entries) {
    const slotId = name.slice(BOOKING_EXTERNAL_CTA_FIELD_PREFIX.length)
    if (!isBookingExternalCtaSlot(slotId) || typeof rawValue !== 'string') return null
    const candidate = rawValue.trim()
    if (!candidate) continue
    const url = normalizeBookingExternalUrl(candidate)
    if (!url) return null
    urls[slotId] = url
    if (serializedBytes(urls) > MAX_BOOKING_EXTERNAL_CTA_BYTES) return null
  }
  return urls
}

export function resolveBookingExternalUrl(
  fallbackUrl: string | null,
  ctaUrls: BookingExternalCtaUrls,
  slotId?: string,
): string | null {
  return slotId ? ctaUrls[slotId] ?? fallbackUrl : fallbackUrl
}
