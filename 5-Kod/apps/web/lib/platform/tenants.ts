import 'server-only'
import type { Tables } from '@corevo/db'
import type { TenantBranding } from '@corevo/ui'
import { platformCtx } from './guard'
import type { AuditRow } from './audit'
import { readBookingVariant, type BookingVariant } from './booking-variant'

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
}

export type TenantFilters = { q?: string; status?: string }

/** All tenants (cross-tenant), filtered by free-text slug/name + status. */
export async function listTenants(filters: TenantFilters = {}): Promise<TenantListItem[]> {
  const { supabase } = await platformCtx()
  let q = supabase
    .from('tenants')
    .select('id, slug, name, status, plan, created_at, tenant_settings(billing_model)')
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

  const { data } = await q
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
    }
  })
}

// ── Card-grid feed (image #3 / SuperSalons.jsx — the Salonger card view) ──────────
// Per-tenant stats + derived chips for the card grid. BATCHED: one bookings read +
// one staff read + one owner read for the WHOLE platform, then aggregated in JS
// (mirrors metrics.ts) — never an N×per-tenant query loop. Admin-scale volumes.

const VARIANT_LABEL: Record<'3' | '4', string> = { '3': 'Steg-för-steg', '4': 'Snabbboka' }

export type CustomizationLevel = 1 | 2 | 3

/**
 * Derive the salon's storefront customization tier (the "Nivå" chip) from REAL
 * signals — there is NO stored level column, so we never invent a number:
 *   • Nivå 3 = a scoped custom-CSS override string is present (premium, code-level —
 *     the same `customOverride.css` seam tenant-data.ts reads on the storefront).
 *   • Nivå 2 = a no-code template is in play (theme preset OR nav/hero layout variant
 *     OR an uploaded logo/font) — the salon went past raw colour tokens.
 *   • Nivå 1 = colour tokens only (or nothing) — the baseline no-code floor.
 * Mirrors the codebase's nivå-1/2/3 convention (globals.css / tenant-data.ts).
 */
export function deriveCustomizationLevel(
  rawSettings: Record<string, unknown> | null | undefined,
  branding: Record<string, unknown> | null | undefined,
): CustomizationLevel {
  const s = rawSettings ?? {}
  const b = branding ?? {}
  const override = s.custom_override as { css?: unknown } | undefined
  if (override && typeof override.css === 'string' && override.css.trim() !== '') return 3
  const layout = (s.layout ?? {}) as Record<string, unknown>
  const themeSet = typeof s.theme === 'string' && s.theme.trim() !== ''
  const layoutSet = Boolean(layout.nav_variant || layout.hero_variant)
  const noCodeRich = Boolean(b.logo_url || b.font_body)
  if (themeSet || layoutSet || noCodeRich) return 2
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
    .select('id, slug, name, status, plan, created_at, tenant_settings(billing_model, settings, branding)')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
  type Row = TenantRow & {
    tenant_settings:
      | { billing_model: string; settings: unknown; branding: unknown }
      | { billing_model: string; settings: unknown; branding: unknown }[]
      | null
  }
  const rows = (data ?? []) as Row[]

  // Batched aggregates: ONE read each for bookings / staff / owners across ALL
  // tenants, bucketed in JS by tenant_id (no per-tenant query fan-out).
  const [bookingsRes, staffRes, ownersRes] = await Promise.all([
    supabase.from('bookings').select('tenant_id, status, created_at'),
    supabase.from('staff').select('tenant_id').eq('active', true),
    supabase.from('users').select('email, tenant_id, roles!inner(name)').eq('roles.name', 'salon_admin'),
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
  for (const r of (ownersRes.data ?? []) as { tenant_id: string; email: string | null }[]) {
    if (r.email && !owner.has(r.tenant_id)) owner.set(r.tenant_id, r.email)
  }

  return rows.map((t) => {
    const ts = Array.isArray(t.tenant_settings) ? t.tenant_settings[0] : t.tenant_settings
    const rawSettings = (ts?.settings ?? {}) as Record<string, unknown>
    const branding = (ts?.branding ?? {}) as Record<string, unknown>
    const booking = (rawSettings.booking ?? {}) as Record<string, unknown>
    const variant: '3' | '4' = booking.variant === '4' ? '4' : '3'
    const themeRaw = typeof rawSettings.theme === 'string' && rawSettings.theme.trim() ? rawSettings.theme : null
    const primary = typeof branding.color_primary === 'string' ? branding.color_primary : null
    const stats = bk.get(t.id) ?? { total: 0, completed: 0, last: null }
    const displayStatus: TenantDisplayStatus =
      t.status === 'suspended' ? 'suspended' : stats.total === 0 ? 'onboarding' : 'active'
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      plan: t.plan,
      billingModel: ts?.billing_model ?? 'per_booking',
      createdAt: t.created_at,
      markColor: markColorFor(t.slug, primary),
      owner: owner.get(t.id) ?? null,
      themeLabel: themeRaw ? themeRaw.charAt(0).toUpperCase() + themeRaw.slice(1) : null,
      variantLabel: VARIANT_LABEL[variant],
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
  salonAdmin: { email: string | null; status: string } | null
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

  const [settingsRes, servicesRes, staffRes, hoursRes, bookingsRes, completedRes, adminRes] = await Promise.all([
    supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('active', true),
    supabase.from('staff').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('active', true),
    supabase.from('working_hours').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ACTIVE_BOOKING),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'completed'),
    // salon_admin = the level-6 role's user for this tenant.
    supabase
      .from('users')
      .select('email, status, roles!inner(name, tenant_id)')
      .eq('tenant_id', tenantId)
      .eq('roles.name', 'salon_admin')
      .limit(1)
      .maybeSingle(),
  ])

  const settings = settingsRes.data ?? null
  const branding = (settings?.branding ?? {}) as TenantBranding
  const adminRow = adminRes.data as { email: string | null; status: string } | null

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
    salonAdmin: adminRow ? { email: adminRow.email, status: adminRow.status } : null,
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
