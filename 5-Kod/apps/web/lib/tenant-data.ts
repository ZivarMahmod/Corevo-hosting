// Tenant DATA layer (G03) — DB-backed, cached resolution of a tenant + its
// theme settings + services, read via the anonymous public client.
//
// CRITICAL (ADR 01 §2 / migration 0004): the `anon` role has NO tenant_id claim,
// so RLS does NOT isolate one tenant from another. Every query here filters by
// the resolved tenant_id/slug in the app. RLS is only defense-in-depth.
import { headers } from 'next/headers'
import { unstable_cache } from 'next/cache'
import type { Tables } from '@corevo/db'
import type { TenantBranding } from '@corevo/ui'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { getTenantFromHost } from '@/lib/tenant'

export type Tenant = Tables<'tenants'>
export type Service = Tables<'services'>
type TenantSettingsRow = Tables<'tenant_settings'>

export type LayoutConfig = { nav_variant?: string; hero_variant?: string }
export type CustomOverride = { css?: string }

/** Storefront visual theme (two-CSS-worlds system). Drives [data-theme] on the
 *  storefront root, which selects the theme's color/font base tokens in
 *  @corevo/ui/tokens.css. injectTenantTokens() then layers any per-tenant override
 *  inline on top. Default = leander. */
export const STOREFRONT_THEMES = ['salvia', 'leander', 'zigge', 'linnea', 'edit'] as const
export type StorefrontTheme = (typeof STOREFRONT_THEMES)[number]
export const DEFAULT_STOREFRONT_THEME: StorefrontTheme = 'leander'

/** Validate a raw settings.theme value against the known set; fall back to the
 *  default for anything missing/unknown so a typo never yields an un-themed root. */
function parseTheme(raw: unknown): StorefrontTheme {
  return STOREFRONT_THEMES.includes(raw as StorefrontTheme)
    ? (raw as StorefrontTheme)
    : DEFAULT_STOREFRONT_THEME
}

/** Public contact details the salon saved in admin (settings jsonb `contact`).
 *  Each field is null until the owner fills it in — render-on-present only. */
export type TenantContact = { email: string | null; phone: string | null }

export type TenantSettings = {
  branding: TenantBranding
  layout: LayoutConfig
  /** Storefront theme preset (validated; default leander) → [data-theme] on root. */
  theme: StorefrontTheme
  /** goal-50: a render-bron LOOK key chosen in onboarding (e.g. 'demolook'). When set
   *  AND it resolves in the look-registry, the storefront renders that look's real HTML
   *  instead of the theme layout. Raw string here (registry-validated at the dispatch
   *  site, so tenant-data stays free of the heavy look HTML). null = use the theme. */
  look: string | null
  /** non-null only when an actual css override string is present (nivå 3). */
  customOverride: CustomOverride | null
  paymentMode: string
  /** G12: storefront exposes customer login/signup/konto only when the owner opts in. */
  customerAccountsEnabled: boolean
  /** Salon contact (admin SettingsForm → settings.contact). Null fields = unset. */
  contact: TenantContact
  /** EU cookie-consent banner on the storefront. Default ON (legal). */
  cookieBannerEnabled: boolean
}

/** One opening-hours row derived from real `working_hours`, weekday-ordered. */
export type OpeningHour = { day: string; time: string }

/** Real location + derived opening hours for the storefront contact area.
 *  address is null until the owner fills it in; hours is null when no
 *  working_hours exist yet (sections render an honest "Visas snart"). */
export type TenantLocation = {
  name: string | null
  address: string | null
  hours: OpeningHour[] | null
}

export type TenantBundle = {
  tenant: Tenant
  settings: TenantSettings
  /** Primary location + derived opening hours; null when the tenant has none. */
  location: TenantLocation | null
}

function parseSettings(row: TenantSettingsRow | null): TenantSettings {
  const rawBranding = (row?.branding ?? {}) as TenantBranding
  // Owner-uploaded storefront media (read-path only). Normalise the new keys to
  // safe defaults — empty array / null — so consumers can read them without
  // guarding; existing branding fields (colours/fonts/logo) pass through
  // untouched. Unknown/malformed jsonb safely collapses to the default.
  const branding: TenantBranding = {
    ...rawBranding,
    hero_images: Array.isArray(rawBranding.hero_images) ? rawBranding.hero_images : [],
    gallery_images: Array.isArray(rawBranding.gallery_images) ? rawBranding.gallery_images : [],
    about_image: typeof rawBranding.about_image === 'string' ? rawBranding.about_image : null,
    closing_image: typeof rawBranding.closing_image === 'string' ? rawBranding.closing_image : null,
    team: Array.isArray(rawBranding.team) ? rawBranding.team : [],
    stats: Array.isArray(rawBranding.stats) ? rawBranding.stats : [],
  }
  const raw = (row?.settings ?? {}) as Record<string, unknown>
  const layout = (raw.layout ?? {}) as LayoutConfig
  const override = (raw.custom_override ?? null) as CustomOverride | null
  const hasCss = !!override && typeof override.css === 'string' && override.css.trim().length > 0
  // Contact lives in the settings JSON (`contact: { email, phone }`, written by
  // the admin SettingsForm). Normalise blanks → null so the storefront can omit
  // the field gracefully instead of rendering an empty value.
  const contactRaw = (raw.contact ?? {}) as { email?: unknown; phone?: unknown }
  const cleanStr = (v: unknown): string | null => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s.length > 0 ? s : null
  }
  return {
    branding,
    layout,
    // Lives in the settings JSON (`theme: "leander"`); validated against the known
    // preset set so an unknown/typo value safely falls back to the default.
    theme: parseTheme(raw.theme),
    // goal-50: optional render-bron look key (settings.look). Passed through as a raw
    // string; the storefront validates it against the look-registry before dispatching.
    look: typeof raw.look === 'string' && raw.look.trim().length > 0 ? raw.look.trim() : null,
    customOverride: hasCss ? override : null,
    paymentMode: row?.payment_mode ?? 'on_site',
    // Lives in the settings JSON (no dedicated column — same seam as
    // cancellation_cutoff_hours). Default OFF: guest booking only.
    customerAccountsEnabled: raw.customer_accounts_enabled === true,
    contact: { email: cleanStr(contactRaw.email), phone: cleanStr(contactRaw.phone) },
    // EU cookie consent: default ON; owner can hide via settings.cookie_banner_enabled=false.
    cookieBannerEnabled: raw.cookie_banner_enabled !== false,
  }
}

/**
 * Per-tenant gate for the SITE EDITOR (sajtbyggaren) — the customer-facing edit
 * surface. Reads the raw tenant_settings.settings jsonb flag `sajtbyggare_enabled`,
 * DEFAULT OFF (absent / non-true / garbage → false). Mirrors the customer_accounts_enabled
 * seam above. The deploy-wide env flag (lib/sajtbyggare/flag.ts sajtbyggareEnabled) stays
 * a separate kill-switch; the editor is available to a tenant only when BOTH are on.
 * This gates the EDITOR only — never the public render of already-authored content.
 * Lives here (not in flag.ts) so the save-path test's `vi.mock('./flag')` can't blank it.
 */
export function tenantSiteEditorEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false
  return (settings as Record<string, unknown>).sajtbyggare_enabled === true
}

/** Swedish weekday labels indexed by working_hours.weekday (0 = Sunday … 6 = Saturday). */
const WEEKDAYS_SV = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'] as const

/** "09:00:00" → "09". Tolerates "HH:MM" and "HH:MM:SS"; trims a lone ":00" minute
 *  for a clean editorial look, keeps real minutes (e.g. "09:30"). */
function fmtTime(t: string): string {
  const [h = '', m = ''] = t.split(':')
  const hh = h.padStart(2, '0')
  return m === '00' || m === '' ? hh : `${hh}:${m}`
}

/**
 * Collapse real per-staff `working_hours` rows into salon-level opening hours.
 * For each weekday we take the OUTER ENVELOPE (earliest start → latest end across
 * all staff): the window during which the salon has at least one staff member
 * scheduled. This is an approximation, not a minute-by-minute guarantee (e.g.
 * staff working 09–12 and 15–18 render as "09–18" even if no one is in midday);
 * the task explicitly allows deriving hours "if reasonably feasible", and the
 * authoritative free/busy is always the live booking grid (the section says so).
 * Weekdays with no rows are "Stängt". Returns null when there are NO rows at all,
 * so the section shows an honest placeholder instead of inventing hours.
 */
function deriveOpeningHours(
  rows: { weekday: number; start_time: string; end_time: string }[],
): OpeningHour[] | null {
  if (rows.length === 0) return null
  const span = new Map<number, { start: string; end: string }>()
  for (const r of rows) {
    if (r.weekday < 0 || r.weekday > 6) continue
    const cur = span.get(r.weekday)
    if (!cur) {
      span.set(r.weekday, { start: r.start_time, end: r.end_time })
    } else {
      if (r.start_time < cur.start) cur.start = r.start_time
      if (r.end_time > cur.end) cur.end = r.end_time
    }
  }
  if (span.size === 0) return null
  // Render Mon→Sun (1..6 then 0) — the order Swedish opening-hours tables use.
  const order = [1, 2, 3, 4, 5, 6, 0]
  return order.map((wd) => {
    const s = span.get(wd)
    return {
      day: WEEKDAYS_SV[wd]!,
      time: s ? `${fmtTime(s.start)}–${fmtTime(s.end)}` : 'Stängt',
    }
  })
}

/**
 * Load the tenant's PRIMARY location (real address) + derive salon opening hours
 * from its real `working_hours`. Both tables are anon-readable for active tenants
 * (migration 0005) and we ALSO filter by tenant_id app-side (RLS does not isolate
 * anon). Returns null when the tenant has no location row at all.
 */
async function loadLocation(
  supabase: ReturnType<typeof createPublicClient>,
  tenantId: string,
): Promise<TenantLocation | null> {
  const { data: loc } = await supabase
    .from('locations')
    .select('name, address')
    .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!loc) return null

  // Scope by tenant_id ONLY (not location_id): multi-location is unused
  // future-proofing today, and some real rows carry a null location_id (seeded
  // rows depend on the 0005 backfill). Filtering by location_id could silently
  // drop real hours → a false "Visas snart". Tenant-only scoping can't hide data.
  const { data: wh } = await supabase
    .from('working_hours')
    .select('weekday, start_time, end_time')
    .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
    .order('weekday', { ascending: true })

  const cleanAddr = typeof loc.address === 'string' && loc.address.trim().length > 0
  return {
    name: typeof loc.name === 'string' && loc.name.trim().length > 0 ? loc.name.trim() : null,
    address: cleanAddr ? loc.address!.trim() : null,
    hours: deriveOpeningHours(wh ?? []),
  }
}

/**
 * Resolve an active tenant + its settings by slug. Cached per-slug
 * (slug is in keyParts → no cross-tenant cache bleed) and tagged for revalidation.
 */
export async function getTenantBySlug(slug: string): Promise<TenantBundle | null> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<TenantBundle | null> => {
      const supabase = createPublicClient()
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', norm)
        .eq('status', 'active')
        .maybeSingle()
      if (error || !tenant) return null
      const { data: settingsRow } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenant.id) // app-layer scope
        .maybeSingle()
      const location = await loadLocation(supabase, tenant.id)
      return { tenant, settings: parseSettings(settingsRow ?? null), location }
    },
    ['tenant-by-slug', norm],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}

/** Active services for a tenant, cheapest first. Always scoped by tenant_id. */
export async function getServices(tenantId: string, slug: string): Promise<Service[]> {
  const norm = slug.trim().toLowerCase()
  const load = unstable_cache(
    async (): Promise<Service[]> => {
      const supabase = createPublicClient()
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenantId) // app-layer tenant isolation (RLS does NOT do this for anon)
        .eq('active', true)
        .order('price_cents', { ascending: true })
      if (error || !data) return []
      return data
    },
    ['services-by-tenant', tenantId],
    { tags: [`tenant:${norm}`], revalidate: 300 },
  )
  return load()
}

/**
 * Resolve the current request's tenant from the Host header (dev: subdomain on
 * localhost, e.g. frisor1.localhost:3000). Returns null for root/platform/
 * reserved/unknown hosts. Reads headers() → never cached; delegates to the
 * cached getTenantBySlug for the data.
 */
export async function currentTenant(): Promise<TenantBundle | null> {
  const h = await headers()
  // Prefer the slug the middleware already resolved (covers subdomain, ?tenant=
  // and /t/<slug> uniformly — the latter two are the workers.dev preview path).
  const headerSlug = h.get('x-corevo-tenant-slug')
  if (headerSlug) return getTenantBySlug(headerSlug)
  // Fallback: direct host parse (e.g. if middleware did not run for this path).
  const res = getTenantFromHost(h.get('host'))
  if (res.kind !== 'tenant') return null
  return getTenantBySlug(res.slug)
}

/**
 * G12 back-office chrome: resolve a tenant bundle by id via the AUTHED client.
 * On the platform host (booking.corevo.se) there is no host tenant, so the portal
 * shell needs the logged-in staff/admin's OWN tenant (from their JWT). Uses the
 * authed server client so RLS lets them read their tenant even when suspended —
 * NOT the anon public client (which only sees active tenants).
 */
export async function getTenantById(id: string): Promise<TenantBundle | null> {
  const supabase = await createClient()
  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', id).maybeSingle()
  if (!tenant) return null
  const { data: settingsRow } = await supabase
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', id)
    .maybeSingle()
  // Back-office chrome only needs name/branding/settings — the storefront contact
  // area (location/hours) is not rendered here, so we skip the extra reads.
  return { tenant, settings: parseSettings(settingsRow ?? null), location: null }
}
