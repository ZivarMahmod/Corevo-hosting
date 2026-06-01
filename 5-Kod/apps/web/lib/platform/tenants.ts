import 'server-only'
import type { Tables } from '@corevo/db'
import type { TenantBranding } from '@corevo/ui'
import { platformCtx } from './guard'
import type { AuditRow } from './audit'

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
    const term = `%${filters.q.trim()}%`
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
  counts: { activeServices: number; activeStaff: number; workingHours: number; bookings: number }
  salonAdmin: { email: string | null; status: string } | null
  onboarding: OnboardingStep[]
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

  const [settingsRes, servicesRes, staffRes, hoursRes, bookingsRes, adminRes] = await Promise.all([
    supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('active', true),
    supabase.from('staff').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('active', true),
    supabase.from('working_hours').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ACTIVE_BOOKING),
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

  const counts = {
    activeServices: servicesRes.count ?? 0,
    activeStaff: staffRes.count ?? 0,
    workingHours: hoursRes.count ?? 0,
    bookings: bookingsRes.count ?? 0,
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
