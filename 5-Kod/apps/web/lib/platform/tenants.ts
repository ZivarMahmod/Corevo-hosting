import 'server-only'
import type { Tables } from '@corevo/db'
import type { TenantBranding } from '@corevo/ui'
import { platformCtx } from './guard'
import type { AuditRow } from './audit'
import { readBookingVariant, BOOKING_VARIANT_LABELS, type BookingVariant } from './booking-variant'

// Cross-tenant reads for the platform control center. All reads go through the
// authed platform_admin cookie client (platformCtx), whose JWT carries the
// platform_admin claim → RLS returns rows for EVERY tenant (private.is_platform_admin()).
// A normal salon_admin calling these would only ever see its own tenant.

export type TenantRow = Tables<'tenants'>
export type TenantSettingsRow = Tables<'tenant_settings'>

export type TenantListItem = {
  id: string
  slug: string
  name: string
  status: string
  plan: string
  billingModel: string
  createdAt: string
  /** Salongens stad (#14) — real tenants.city; null = honest tom ("—"). */
  city: string | null
  /** Ägarens namn (#10) — users.full_name for the tenant's owner; null = honest tom. */
  ownerName: string | null
  /** Live booking count for this tenant (all statuses) — honest 0 where none. */
  bookingsCount: number
}

export type TenantFilters = { q?: string; status?: string }

/**
 * Bucket booking rows into a per-tenant count map (the #15 grouped-count core,
 * extracted pure so it's testable without a DB). One pass over the rows; a tenant
 * with no rows is simply absent → the caller reads an honest 0.
 */
export function countBookingsByTenant(
  rows: { tenant_id: string }[],
): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) m.set(r.tenant_id, (m.get(r.tenant_id) ?? 0) + 1)
  return m
}

/**
 * All tenants (cross-tenant), filtered by free-text slug/name + status. The
 * per-tenant bookingsCount is a SINGLE grouped count: one `bookings` read bucketed
 * in JS by tenant_id (the metrics.ts pattern), never an N+1 per-tenant fan-out.
 * platform_admin reads cross-tenant via the RLS bypass. Honest 0 where none.
 */
export async function listTenants(filters: TenantFilters = {}): Promise<TenantListItem[]> {
  const { supabase } = await platformCtx()
  let q = supabase
    .from('tenants')
    .select('id, slug, name, status, plan, city, created_at, tenant_settings(billing_model)')
    .order('created_at', { ascending: false })

  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status)
  if (filters.q && filters.q.trim()) {
    // PostgREST parses .or() as a comma-separated filter list, so strip the chars
    // that would break the parse (comma/parens/asterisk/quote/backslash) — else a
    // term like "Klipp, Färg" 400s the request and silently returns no tenants.
    const safe = filters.q.trim().replace(/[,()*"\\]/g, ' ')
    const term = `%${safe}%`
    q = q.or(`slug.ilike.${term},name.ilike.${term}`)
  }

  // Batched: one bookings read + one owner read across ALL tenants (mirrors
  // listTenantsWithStats' ownersRes), bucketed in JS — never an N+1 per-tenant fan-out.
  const [{ data }, bookingsRes, ownersRes] = await Promise.all([
    q,
    supabase.from('bookings').select('tenant_id'),
    // Owner = the salon_admin user; read full_name (#10). platform_admin reads users
    // cross-tenant via the RLS bypass (users_rls = is_platform_admin()).
    supabase.from('users').select('tenant_id, full_name, roles!inner(name)').eq('roles.name', 'salon_admin').order('created_at'),
  ])

  const bookingsByTenant = countBookingsByTenant(
    (bookingsRes.data ?? []) as { tenant_id: string }[],
  )

  // First salon_admin per tenant with a non-empty name wins (honest null otherwise).
  const ownerName = new Map<string, string>()
  for (const r of (ownersRes.data ?? []) as { tenant_id: string; full_name: string | null }[]) {
    if (r.full_name && !ownerName.has(r.tenant_id)) ownerName.set(r.tenant_id, r.full_name)
  }

  type Row = TenantRow & { tenant_settings: { billing_model: string } | { billing_model: string }[] | null }
  return ((data ?? []) as Row[]).map((t) => {
    const ts = Array.isArray(t.tenant_settings) ? t.tenant_settings[0] : t.tenant_settings
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      plan: t.plan,
      billingModel: ts?.billing_model ?? 'per_booking',
      createdAt: t.created_at,
      city: t.city ?? null,
      ownerName: ownerName.get(t.id) ?? null,
      bookingsCount: bookingsByTenant.get(t.id) ?? 0,
    }
  })
}

// ── Card-grid feed (image #3 / SuperSalons.jsx — the Salonger card view) ──────────
// Per-tenant stats + derived chips for the card grid. BATCHED: one bookings read +
// one staff read + one owner read for the WHOLE platform, then aggregated in JS
// (mirrors metrics.ts) — never an N×per-tenant query loop. Admin-scale volumes.

export type CustomizationLevel = 1 | 2 | 3

/**
 * Derive the salon's storefront customization tier (the "Nivå" chip) from REAL,
 * actually-set signals — there is NO stored level column, so we never invent a
 * number and never read dead keys (#18):
 *   • Nivå 2 = the salon went past the raw colour-token floor with no-code richness:
 *     a named theme preset is set (settings.theme) OR an uploaded logo/font
 *     (branding.logo_url / font_body).
 *   • Nivå 1 = colour tokens only (or nothing) — the baseline no-code floor.
 * The old phantom Nivå-3 `custom_override.css` branch + the dead
 * `settings.layout.nav_variant/hero_variant` reads are REMOVED — that nav/hero
 * A/B system is retired (components/brand/variants.ts) and the scoped-CSS Nivå-3
 * seam is never set via this surface, so reading them only faked a tier. The return
 * type keeps `3` for callers' exhaustiveness; this derivation simply never returns it.
 */
export function deriveCustomizationLevel(
  rawSettings: Record<string, unknown> | null | undefined,
  branding: Record<string, unknown> | null | undefined,
): CustomizationLevel {
  const s = rawSettings ?? {}
  const b = branding ?? {}
  const themeSet = typeof s.theme === 'string' && s.theme.trim() !== ''
  const noCodeRich = Boolean(b.logo_url || b.font_body)
  if (themeSet || noCodeRich) return 2
  return 1
}

/** Derived display status for the card pills (Aktiv/Pausad/Onboarding). The real DB
 *  status is only active/suspended/deleted; "onboarding" is the honest derived label
 *  for an active salon that has not taken a single booking yet (matches the mock:
 *  Salong Nord, 0 bokningar = Onboarding). */
export type TenantDisplayStatus = 'active' | 'suspended' | 'onboarding'

export type TenantCardItem = TenantListItem & {
  /** Brand mark colour: the salon's primary colour if set, else a deterministic
   *  palette pick by slug (mock cards have varied avatar colours). */
  markColor: string
  owner: string | null
  themeLabel: string | null
  variantLabel: string
  level: CustomizationLevel
  bookings: number
  completed: number
  staff: number
  lastActivityAt: string | null
  displayStatus: TenantDisplayStatus
}

const MARK_PALETTE = ['#1F4636', '#7E6E92', '#C8743C', '#B0693F', '#3A3733', '#5E7361']
function markColorFor(slug: string, primary: string | null): string {
  if (primary && /^#[0-9a-fA-F]{3,8}$/.test(primary)) return primary
  let h = 0
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0
  return MARK_PALETTE[h % MARK_PALETTE.length] ?? '#1F4636'
}

/** Card-grid feed: every non-deleted tenant + its batched stats + derived chips. */
export async function listTenantsWithStats(): Promise<TenantCardItem[]> {
  const { supabase } = await platformCtx()
  const { data } = await supabase
    .from('tenants')
    .select('id, slug, name, status, plan, city, created_at, tenant_settings(billing_model, settings, branding)')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
  type Row = TenantRow & {
    tenant_settings:
      | { billing_model: string; settings: unknown; branding: unknown }
      | { billing_model: string; settings: unknown; branding: unknown }[]
      | null
  }
  const rows = (data ?? []) as Row[]

  // Batched aggregates: ONE read each for bookings / staff / owners / services /
  // hours across ALL tenants, bucketed in JS by tenant_id (no per-tenant fan-out).
  const [bookingsRes, staffRes, ownersRes, servicesRes, hoursRes] = await Promise.all([
    supabase.from('bookings').select('tenant_id, status, created_at'),
    supabase.from('staff').select('tenant_id').eq('active', true),
    supabase.from('users').select('email, full_name, tenant_id, roles!inner(name)').eq('roles.name', 'salon_admin').order('created_at'),
    supabase.from('services').select('tenant_id').eq('active', true),
    supabase.from('working_hours').select('tenant_id'),
  ])

  const bk = new Map<string, { total: number; completed: number; last: string | null }>()
  for (const r of (bookingsRes.data ?? []) as { tenant_id: string; status: string; created_at: string }[]) {
    const e = bk.get(r.tenant_id) ?? { total: 0, completed: 0, last: null }
    e.total += 1
    if (r.status === 'completed') e.completed += 1
    if (!e.last || r.created_at > e.last) e.last = r.created_at
    bk.set(r.tenant_id, e)
  }
  const staffCount = new Map<string, number>()
  for (const r of (staffRes.data ?? []) as { tenant_id: string }[]) {
    staffCount.set(r.tenant_id, (staffCount.get(r.tenant_id) ?? 0) + 1)
  }
  const owner = new Map<string, string>()
  const ownerFullName = new Map<string, string>()
  for (const r of (ownersRes.data ?? []) as { tenant_id: string; email: string | null; full_name: string | null }[]) {
    if (r.email && !owner.has(r.tenant_id)) owner.set(r.tenant_id, r.email)
    if (r.full_name && !ownerFullName.has(r.tenant_id)) ownerFullName.set(r.tenant_id, r.full_name)
  }
  const hasServices = new Set<string>(
    ((servicesRes.data ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id),
  )
  const hasHours = new Set<string>(
    ((hoursRes.data ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id),
  )

  return rows.map((t) => {
    const ts = Array.isArray(t.tenant_settings) ? t.tenant_settings[0] : t.tenant_settings
    const rawSettings = (ts?.settings ?? {}) as Record<string, unknown>
    const branding = (ts?.branding ?? {}) as Record<string, unknown>
    // #17 — canonical 4-id variant resolver (maps legacy '3'/'4' forward), NOT the
    // old 2-value legacy parser. So 'wizard'/'compact'/'drawer'/'inline' each get the
    // right label instead of collapsing to "Steg-för-steg" / "Snabbboka".
    const variant = readBookingVariant(rawSettings)
    const themeRaw = typeof rawSettings.theme === 'string' && rawSettings.theme.trim() ? rawSettings.theme : null
    const primary = typeof branding.color_primary === 'string' ? branding.color_primary : null
    const stats = bk.get(t.id) ?? { total: 0, completed: 0, last: null }
    // "Onboarding" is derived from REAL setup-completeness (not booking count): a
    // launch-ready salon has staff + active services + working hours. A fully set-up
    // salon with zero traffic still reads "Aktiv" — matching the mock's onboardStep
    // semantics, not "no bookings yet = onboarding".
    const launchReady = (staffCount.get(t.id) ?? 0) > 0 && hasServices.has(t.id) && hasHours.has(t.id)
    const displayStatus: TenantDisplayStatus =
      t.status === 'suspended' ? 'suspended' : launchReady ? 'active' : 'onboarding'
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      plan: t.plan,
      billingModel: ts?.billing_model ?? 'per_booking',
      createdAt: t.created_at,
      city: t.city ?? null,
      ownerName: ownerFullName.get(t.id) ?? null,
      bookingsCount: stats.total,
      markColor: markColorFor(t.slug, primary),
      owner: owner.get(t.id) ?? null,
      themeLabel: themeRaw ? themeRaw.charAt(0).toUpperCase() + themeRaw.slice(1) : null,
      variantLabel: BOOKING_VARIANT_LABELS[variant],
      level: deriveCustomizationLevel(rawSettings, branding),
      bookings: stats.total,
      completed: stats.completed,
      staff: staffCount.get(t.id) ?? 0,
      lastActivityAt: stats.last,
      displayStatus,
    }
  })
}

// ── Onboarding ladder (steg 1–6) ───────────────────────────────────────────────
export type OnboardingStatus = 'done' | 'todo' | 'locked'
export type OnboardingStep = {
  key: string
  step: number
  label: string
  status: OnboardingStatus
  detail: string
}

export type OnboardingFacts = {
  hasSettings: boolean
  brandingSet: boolean
  activeServices: number
  activeStaff: number
  workingHours: number
  salonAdminInvited: boolean
  tenantStatus: string
  slug: string
}

/**
 * Derive the 6-step onboarding ladder from the tenant's current data. Pure so the
 * status mapping is deterministic + testable. Step 5 (egen domän) is permanently
 * `locked` — the custom-domain provisioning is SPÄRRAT (domän-spärr, G08).
 */
export function deriveOnboarding(f: OnboardingFacts): OnboardingStep[] {
  const done = (b: boolean): OnboardingStatus => (b ? 'done' : 'todo')
  return [
    {
      key: 'create',
      step: 1,
      label: 'Skapa salong',
      status: done(f.hasSettings),
      detail: f.salonAdminInvited
        ? `${f.slug}.corevo.se · salongsadmin inbjuden`
        : `${f.slug}.corevo.se · ingen salongsadmin ännu`,
    },
    {
      key: 'branding',
      step: 2,
      label: 'Varumärke',
      status: done(f.brandingSet),
      detail: f.brandingSet ? 'Logotyp/färger satta' : 'Logotyp + färger saknas',
    },
    {
      key: 'content',
      step: 3,
      label: 'Tjänster & personal',
      status: done(f.activeServices > 0 && f.activeStaff > 0),
      detail: `${f.activeServices} tjänst(er) · ${f.activeStaff} medarbetare`,
    },
    {
      key: 'hours',
      step: 4,
      label: 'Öppettider',
      status: done(f.workingHours > 0),
      detail: f.workingHours > 0 ? `${f.workingHours} arbetstidsrader` : 'Inga arbetstider',
    },
    {
      key: 'domain',
      step: 5,
      label: 'Egen domän',
      status: 'locked',
      detail: 'SPÄRRAD — kör på *.corevo.se. Custom domän kräver manuell drift.',
    },
    {
      key: 'launch',
      step: 6,
      label: 'Lansera',
      status: done(f.tenantStatus === 'active'),
      detail: f.tenantStatus === 'active' ? 'Aktiv & publik' : `Status: ${f.tenantStatus}`,
    },
  ]
}

// ── Tenant detail (read-only insyn + onboarding facts) ──────────────────────────
export type TenantDetail = {
  tenant: TenantRow
  settings: TenantSettingsRow | null
  branding: TenantBranding
  counts: { activeServices: number; activeStaff: number; workingHours: number; bookings: number; completed: number }
  /** The tenant's service rows (editable list for the super-admin services surface).
   *  Ordered oldest-first so the list is stable across revalidate (no reshuffle). */
  services: { id: string; name: string; price_cents: number; duration_min: number; active: boolean }[]
  salonAdmin: { email: string | null; fullName: string | null; status: string } | null
  onboarding: OnboardingStep[]
  /** Operativ data-kontroll (§2.1B): current values for the edit surface. */
  operative: { googleReviewUrl: string | null; bookingVariant: BookingVariant }
}

const ACTIVE_BOOKING = ['pending', 'confirmed', 'completed']

function brandingIsSet(branding: TenantBranding): boolean {
  const b = branding as Record<string, unknown>
  return Boolean(b.logo_url || b.color_primary || b.color_bg || b.color_fg)
}

export async function getTenantDetail(tenantId: string): Promise<TenantDetail | null> {
  const { supabase } = await platformCtx()

  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle()
  if (!tenant) return null

  const [settingsRes, servicesRes, serviceRowsRes, staffRes, hoursRes, bookingsRes, completedRes, adminRes] = await Promise.all([
    supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('active', true),
    // Editable service rows for the super-admin services surface. All services (active
    // + inactive), oldest-first so the list stays stable across revalidate.
    supabase
      .from('services')
      .select('id, name, price_cents, duration_min, active')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabase.from('staff').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('active', true),
    supabase.from('working_hours').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ACTIVE_BOOKING),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'completed'),
    // salon_admin = the level-6 role's user for this tenant. full_name (#10) feeds the
    // Ägare-card so the owner's real name shows, not just the email.
    supabase
      .from('users')
      .select('email, full_name, status, roles!inner(name, tenant_id)')
      .eq('tenant_id', tenantId)
      .eq('roles.name', 'salon_admin')
      // Deterministic owner when a tenant has >1 salon_admin: oldest first.
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  ])

  const settings = settingsRes.data ?? null
  const branding = (settings?.branding ?? {}) as TenantBranding
  const adminRow = adminRes.data as { email: string | null; full_name: string | null; status: string } | null

  // Operative values for the §2.1B edit surface, parsed from the raw settings jsonb
  // (the same raw-read seam M3 uses for booking.variant — NOT the frozen parseSettings).
  const rawSettings = (settings?.settings ?? {}) as Record<string, unknown>
  const reviewRaw = rawSettings.google_review_url
  const googleReviewUrl =
    typeof reviewRaw === 'string' && reviewRaw.trim().length > 0 ? reviewRaw.trim() : null
  const bookingVariant = readBookingVariant(rawSettings)

  const counts = {
    activeServices: servicesRes.count ?? 0,
    activeStaff: staffRes.count ?? 0,
    workingHours: hoursRes.count ?? 0,
    bookings: bookingsRes.count ?? 0,
    completed: completedRes.count ?? 0,
  }

  const onboarding = deriveOnboarding({
    hasSettings: !!settings,
    brandingSet: brandingIsSet(branding),
    activeServices: counts.activeServices,
    activeStaff: counts.activeStaff,
    workingHours: counts.workingHours,
    salonAdminInvited: !!adminRow,
    tenantStatus: tenant.status,
    slug: tenant.slug,
  })

  return {
    tenant,
    settings,
    branding,
    counts,
    services: serviceRowsRes.data ?? [],
    salonAdmin: adminRow
      ? { email: adminRow.email, fullName: adminRow.full_name, status: adminRow.status }
      : null,
    onboarding,
    operative: { googleReviewUrl, bookingVariant },
  }
}

/** Recent audit-log entries for a tenant (read-only insyn). */
export async function getTenantAudit(tenantId: string, limit = 20): Promise<AuditRow[]> {
  const { supabase } = await platformCtx()
  const { data } = await supabase
    .from('audit_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}
