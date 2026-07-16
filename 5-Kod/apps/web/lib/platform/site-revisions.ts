import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, Tables } from '@corevo/db'
import type { TenantBranding } from '@corevo/ui'
import { COPY_OVERRIDE_KEYS } from '@/components/storefront/theme-content'
import type { TenantDetail } from './tenants'
import { normalizeContactEmail, normalizeSocialUrl } from './contact-validation'
import {
  isBookingVariant,
  PICKER_MODES,
  readBookingVariant,
  readPickerMode,
  readStaffAvatarMode,
  STAFF_AVATAR_MODES,
  type BookingVariant,
  type PickerMode,
  type StaffAvatarMode,
} from './booking-variant'

export type SiteSnapshot = {
  tenant: { name: string }
  settings: {
    copy: Record<string, string>
    theme: string
    contact: { email: string | null; phone: string | null }
    social: { instagram: string | null; facebook: string | null; tiktok: string | null }
    map: { lat: number; lon: number } | null
    opening_hours: { day: string; time: string }[] | null
    seo: { title: string | null; description: string | null }
    booking: {
      variant: BookingVariant
      pickerMode: PickerMode
      staffAvatars: StaffAvatarMode
    }
  }
  branding: Omit<TenantBranding, 'team'>
  location: { address: string | null }
}

export type SiteRevision = Omit<Tables<'site_revisions'>, 'snapshot'> & {
  snapshot: SiteSnapshot
}

export type SiteRevisionState = {
  draft: SiteRevision | null
  history: SiteRevision[]
}

const textLength = (value: string): number => Array.from(value).length

const cleanString = (value: unknown, max = Number.MAX_SAFE_INTEGER): string | null => {
  const text = typeof value === 'string' ? value.trim() : ''
  const length = textLength(text)
  return length > 0 && length <= max ? text : null
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

function cleanCopy(value: unknown): Record<string, string> {
  const raw = record(value)
  const copy: Record<string, string> = {}
  for (const key of COPY_OVERRIDE_KEYS) {
    const value = raw[key]
    if (typeof value === 'string') {
      const text = value.trim()
      if (textLength(text) > 0 && textLength(text) <= 4000) copy[key] = text
    }
  }
  return copy
}

function cleanHours(value: unknown): { day: string; time: string }[] | null {
  if (!Array.isArray(value)) return null
  const rows = value.slice(0, 31).flatMap((row) => {
    const value = record(row)
    const day = cleanString(value.day, 40)
    const time = cleanString(value.time, 80)
    return day && time ? [{ day, time }] : []
  })
  return rows.length > 0 ? rows : null
}

const SCHEDULE_DAYS = [
  [1, 'Måndag'], [2, 'Tisdag'], [3, 'Onsdag'], [4, 'Torsdag'],
  [5, 'Fredag'], [6, 'Lördag'], [0, 'Söndag'],
] as const

const displayTime = (value: string): string => {
  const normalized = value.slice(0, 5)
  return normalized.endsWith(':00') ? normalized.slice(0, 2) : normalized
}

/** Same real schedule envelope used by the storefront: earliest start to latest
 * end across staff for each weekday. It is display-only until the owner edits a
 * day, at which point the complete list becomes an explicit snapshot override. */
export function deriveSiteScheduleHours(detail: TenantDetail): { day: string; time: string }[] | null {
  const spans = new Map<number, { start: string; end: string }>()
  for (const staff of detail.staffList) {
    for (const row of staff.hours) {
      if (!Number.isInteger(row.weekday) || row.weekday < 0 || row.weekday > 6) continue
      const current = spans.get(row.weekday)
      if (!current) spans.set(row.weekday, { start: row.start, end: row.end })
      else {
        if (row.start < current.start) current.start = row.start
        if (row.end > current.end) current.end = row.end
      }
    }
  }
  if (!spans.size) return null
  return SCHEDULE_DAYS.map(([weekday, day]) => {
    const span = spans.get(weekday)
    return { day, time: span ? `${displayTime(span.start)}–${displayTime(span.end)}` : 'Stängt' }
  })
}

export function readSiteMap(value: unknown): { lat: number; lon: number } | null {
  const raw = record(value)
  const lat = typeof raw.lat === 'number' ? raw.lat : Number(raw.lat)
  const lon = typeof raw.lon === 'number' ? raw.lon : Number(raw.lon)
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
    ? { lat, lon }
    : null
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const SAFE_FONT = /^[A-Za-z0-9\s,'"()._-]+$/
const BRANDING_URL_MAX = 2048

const safeUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const url = value.trim()
  if (!url || textLength(url) > BRANDING_URL_MAX || !(url.startsWith('/') || /^https?:\/\//i.test(url))) {
    return undefined
  }
  return url
}

/** Persisted/client branding is untrusted. Strict mode rejects the complete
 * snapshot when one known key has the wrong shape; legacy build mode simply
 * omits an invalid old value so the editor can still open and repair it. */
function cleanBranding(input: unknown, strict: boolean): SiteSnapshot['branding'] | null {
  const raw = record(input)
  const output: SiteSnapshot['branding'] = {}

  const optional = <K extends keyof SiteSnapshot['branding']>(
    key: K,
    parse: (value: unknown) => SiteSnapshot['branding'][K] | undefined,
  ): boolean => {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) return true
    if (raw[key] === null) {
      output[key] = null as SiteSnapshot['branding'][K]
      return true
    }
    const parsed = parse(raw[key])
    if (parsed === undefined) return !strict
    output[key] = parsed
    return true
  }

  const color = (value: unknown) =>
    typeof value === 'string' && HEX_COLOR.test(value.trim()) ? value.trim() : undefined
  const font = (value: unknown) => {
    if (typeof value !== 'string') return undefined
    const text = value.trim()
    const length = textLength(text)
    return length > 0 && length <= 240 && SAFE_FONT.test(text) ? text : undefined
  }
  const imageList = (value: unknown) => {
    if (!Array.isArray(value) || value.length > 30) return undefined
    const urls = value.map(safeUrl)
    return urls.every((url): url is string => url !== undefined) ? urls : undefined
  }
  const stats = (value: unknown) => {
    if (!Array.isArray(value) || value.length > 12) return undefined
    const rows = value.map((item) => {
      if (!Array.isArray(item) || item.length !== 2) return undefined
      const [first, second] = item
      if (typeof first !== 'string' || typeof second !== 'string') return undefined
      const value = first.trim()
      const label = second.trim()
      return value && label && textLength(value) <= 120 && textLength(label) <= 120
        ? [value, label] as [string, string]
        : undefined
    })
    return rows.every((row): row is [string, string] => row !== undefined) ? rows : undefined
  }

  const valid =
    optional('color_primary', color) &&
    optional('color_bg', color) &&
    optional('color_fg', color) &&
    optional('color_accent', color) &&
    optional('font_body', font) &&
    optional('font_display', font) &&
    optional('logo_url', safeUrl) &&
    optional('hero_images', imageList) &&
    optional('gallery_images', imageList) &&
    optional('about_image', safeUrl) &&
    optional('closing_image', safeUrl) &&
    optional('stats', stats)

  return valid ? output : null
}

/** Build the complete editor-owned snapshot from today's tenant detail/raw JSON.
 * Explicit picks mirror migration 0080's publish whitelist, so operational data
 * such as services, staff and the legacy branding.team can never leak in. */
export function buildSiteSnapshot(detail: TenantDetail): SiteSnapshot {
  const raw = record(detail.settings?.settings)
  const contact = record(raw.contact)
  const social = record(raw.social)
  const seo = record(raw.seo)
  const email = normalizeContactEmail(contact.email)
  const instagram = normalizeSocialUrl(social.instagram)
  const facebook = normalizeSocialUrl(social.facebook)
  const tiktok = normalizeSocialUrl(social.tiktok)
  return {
    tenant: { name: cleanString(detail.tenant.name, 200) ?? '' },
    settings: {
      copy: cleanCopy(raw.copy),
      theme: cleanString(raw.theme, 64) ?? 'leander',
      contact: { email: email === undefined ? null : email, phone: cleanString(contact.phone, 320) },
      social: {
        instagram: instagram === undefined ? null : instagram,
        facebook: facebook === undefined ? null : facebook,
        tiktok: tiktok === undefined ? null : tiktok,
      },
      map: readSiteMap(raw.map),
      opening_hours: cleanHours(raw.opening_hours),
      seo: { title: cleanString(seo.title, 200), description: cleanString(seo.description, 500) },
      booking: {
        variant: readBookingVariant(raw),
        pickerMode: readPickerMode(raw),
        staffAvatars: readStaffAvatarMode(raw),
      },
    },
    branding: cleanBranding(detail.branding, false) ?? {},
    location: { address: cleanString(detail.primaryAddress, 500) },
  }
}

/** Runtime boundary for untrusted client JSON and persisted jsonb. Unknown keys
 * are discarded; malformed required sections/booking discriminants are rejected. */
export function sanitizeSiteSnapshot(input: unknown): SiteSnapshot | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const root = input as Record<string, unknown>
  const tenant = root.tenant && typeof root.tenant === 'object' && !Array.isArray(root.tenant)
    ? root.tenant as Record<string, unknown> : null
  const settings = root.settings && typeof root.settings === 'object' && !Array.isArray(root.settings)
    ? root.settings as Record<string, unknown> : null
  const branding = root.branding && typeof root.branding === 'object' && !Array.isArray(root.branding)
    ? root.branding as Record<string, unknown> : null
  const location = root.location && typeof root.location === 'object' && !Array.isArray(root.location)
    ? root.location as Record<string, unknown> : null
  if (!tenant || !settings || !branding || !location) return null

  const name = cleanString(tenant.name, 200)
  const theme = cleanString(settings.theme, 64)
  const booking = settings.booking && typeof settings.booking === 'object' && !Array.isArray(settings.booking)
    ? settings.booking as Record<string, unknown> : null
  if (!name || !theme || !booking) return null
  if (!isBookingVariant(booking.variant)) return null
  if (!PICKER_MODES.includes(booking.pickerMode as PickerMode)) return null
  if (!STAFF_AVATAR_MODES.includes(booking.staffAvatars as StaffAvatarMode)) return null
  const cleanSnapshotBranding = cleanBranding(branding, true)
  if (!cleanSnapshotBranding) return null

  const contact = record(settings.contact)
  const social = record(settings.social)
  const seo = record(settings.seo)
  const email = normalizeContactEmail(contact.email)
  const instagram = normalizeSocialUrl(social.instagram)
  const facebook = normalizeSocialUrl(social.facebook)
  const tiktok = normalizeSocialUrl(social.tiktok)
  if (email === undefined || instagram === undefined || facebook === undefined || tiktok === undefined) {
    return null
  }
  return {
    tenant: { name },
    settings: {
      copy: cleanCopy(settings.copy),
      theme,
      contact: { email, phone: cleanString(contact.phone, 320) },
      social: { instagram, facebook, tiktok },
      map: readSiteMap(settings.map),
      opening_hours: cleanHours(settings.opening_hours),
      seo: { title: cleanString(seo.title, 200), description: cleanString(seo.description, 500) },
      booking: {
        variant: booking.variant,
        pickerMode: booking.pickerMode as PickerMode,
        staffAvatars: booking.staffAvatars as StaffAvatarMode,
      },
    },
    branding: cleanSnapshotBranding,
    location: { address: cleanString(location.address, 500) },
  }
}

function asRevision(row: Tables<'site_revisions'>): SiteRevision {
  const snapshot = sanitizeSiteSnapshot(row.snapshot)
  if (!snapshot) throw new Error(`Invalid site revision snapshot: ${row.id}`)
  return { ...row, snapshot }
}

/** RLS-aware draft/history read. The caller supplies its authenticated cookie
 * client; no service role or cross-tenant client is created here. */
export async function loadSiteRevisionState(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  options: { historyLimit?: number } = {},
): Promise<SiteRevisionState> {
  const historyLimit = Math.max(1, Math.min(options.historyLimit ?? 10, 50))
  const [draftResult, historyResult] = await Promise.all([
    supabase
      .from('site_revisions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'draft')
      .maybeSingle(),
    supabase
      .from('site_revisions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(historyLimit),
  ])
  if (draftResult.error) throw new Error(`loadSiteRevisionState draft: ${draftResult.error.message}`)
  if (historyResult.error) throw new Error(`loadSiteRevisionState history: ${historyResult.error.message}`)
  return {
    draft: draftResult.data ? asRevision(draftResult.data) : null,
    history: (historyResult.data ?? []).flatMap((row) => {
      try {
        return [asRevision(row)]
      } catch {
        return []
      }
    }),
  }
}

export const siteSnapshotAsJson = (snapshot: SiteSnapshot): Json => snapshot as unknown as Json
