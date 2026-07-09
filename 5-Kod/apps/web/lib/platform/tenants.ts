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
   *  Ordered oldest-first so the list is stable across revalidate (no reshuffle).
   *  Includes 0046 merch fields + per-service staff assignment (staffIds) and booking
   *  count (bookingCount → whether the row can be hard-deleted or only archived). */
  services: {
    id: string
    name: string
    price_cents: number
    duration_min: number
    active: boolean
    description: string | null
    category: string | null
    sale_price_cents: number | null
    badge: string | null
    image_url: string | null
    sort_order: number
    staffIds: string[]
    bookingCount: number
  }[]
  /** The tenant's staff rows (editable list for the super-admin Personal surface) —
   *  ALL staff (active + inactive), oldest-first for stable revalidate. Each carries
   *  its weekly working_hours so the Personal tab renders an editable schedule per
   *  medarbetare. weekday is DB semantics (0=Sunday..6=Saturday); times are "HH:MM". */
  staffList: {
    id: string
    title: string | null
    active: boolean
    /** Foto på publika sajten (staff.avatar_url, 0049) — null = standard-silhuett. */
    avatar_url: string | null
    /** Syns i publika team-sektionen (staff.show_on_site, 0049) — rör ej bokningsbarhet. */
    show_on_site: boolean
    hours: { weekday: number; start: string; end: string }[]
    /** Service ids this staff can perform (staff_services) — drives the booking's
     *  "Hos vem?" step + the per-staff tjänst-picker in the Personal tab. */
    serviceIds: string[]
  }[]
  salonAdmin: { email: string | null; fullName: string | null; status: string } | null
  onboarding: OnboardingStep[]
  /** Operativ data-kontroll (§2.1B): current values for the edit surface. */
  operative: { googleReviewUrl: string | null; bookingVariant: BookingVariant }
  /** Super-admin storefront-innehåll: the tenant's STORED copy override
   *  (settings.copy). Each field is the raw stored string or '' when unset — the UI
   *  prefills from THIS (never the resolved theme default), so a blank field keeps
   *  "faller tillbaka på temats standard". hero/gallery images live in `branding`. */
  copy: Record<
    | 'heroEyebrow' | 'heroTitle' | 'heroLede' | 'aboutCopy' | 'aboutCopyHome' | 'tagline' | 'italic'
    | 'aboutTitle' | 'homeSecondTitle' | 'whyTitle' | 'whySub' | 'whyBody'
    | 'servicesEyebrow' | 'servicesTitle' | 'servicesIntro'
    | 'teamEyebrow' | 'teamTitle' | 'teamLead'
    | 'closingEyebrow' | 'closingTitle' | 'closingLede'
    | 'contactEyebrow' | 'contactTitle',
    string
  >
  /** Sociala medier-länkar (settings.social) — '' när osatta (formulär-prefill). */
  social: { instagram: string; facebook: string; tiktok: string }
  /** Manuella öppettider (settings.opening_hours) — null = härleds ur scheman. */
  openingHours: { day: string; time: string }[] | null
  /** Primär location-adress (footern på storefronten) — super-admin kontakt-kort. */
  primaryAddress: string | null
}

const ACTIVE_BOOKING = ['pending', 'confirmed', 'completed']

function brandingIsSet(branding: TenantBranding): boolean {
  const b = branding as Record<string, unknown>
  return Boolean(b.logo_url || b.color_primary || b.color_bg || b.color_fg)
}

/** Loose shape of a services row incl. the 0046 merch columns (not yet in the generated
 *  Supabase types). Read-only cast target for getTenantDetail. */
type ServiceMerchRow = {
  id: string
  name: string
  price_cents: number
  duration_min: number
  active: boolean
  description: string | null
  category: string | null
  sale_price_cents: number | null
  badge: string | null
  image_url: string | null
  sort_order: number | null
}

export async function getTenantDetail(
  tenantId: string,
  // Kund-admin (/admin/sida) reuses this read with the salon admin's OWN cookie
  // client: RLS then fences every query to their tenant. No client → platform gate.
  client?: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
): Promise<TenantDetail | null> {
  const supabase = client ?? (await platformCtx()).supabase

  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .maybeSingle()
  // Skilj FEL från SAKNAS: ett transient nätverks/DB-fel ska ge error-boundaryn
  // ("Försök igen"), inte en falsk "Sidan kunde inte hittas"-404 (Zivar såg den
  // efter en spar mitt i en deploy).
  if (tenantErr) throw new Error(`getTenantDetail: ${tenantErr.message}`)
  if (!tenant) return null

  const [settingsRes, servicesRes, serviceRowsRes, staffRes, staffRowsRes, hoursRowsRes, hoursRes, bookingsRes, completedRes, adminRes, staffServicesRes, serviceBookingsRes, locationRes] = await Promise.all([
    supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('services').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('active', true),
    // Editable service rows for the super-admin services surface. All services (active
    // + inactive), oldest-first so the list stays stable across revalidate. select('*')
    // to pull the 0046 merch columns (sale_price_cents/badge/image_url/sort_order).
    supabase
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabase.from('staff').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('active', true),
    // Editable staff rows for the super-admin Personal surface. ALL staff (active +
    // inactive), oldest-first so soft-removed staff stay visible/reversible and the
    // list is stable across revalidate.
    supabase
      .from('staff')
      .select('id, title, active, avatar_url, show_on_site')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    // Every working_hours row for the tenant (one read, bucketed by staff_id in JS —
    // no per-staff fan-out). Feeds each staff's weekly schedule editor.
    supabase
      .from('working_hours')
      .select('staff_id, weekday, start_time, end_time')
      .eq('tenant_id', tenantId),
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
    // Which staff can perform which service (0001 join) — bucketed per service below.
    supabase.from('staff_services').select('service_id, staff_id').eq('tenant_id', tenantId),
    // Every booking's service_id → per-service booking count (decides delete vs archive).
    supabase.from('bookings').select('service_id').eq('tenant_id', tenantId),
    // Primary location address (footern på storefronten) — super-admin kontakt-kort.
    supabase
      .from('locations')
      .select('address')
      .eq('tenant_id', tenantId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])
  const locAddrRaw = (locationRes.data as { address?: unknown } | null)?.address
  const primaryAddress = typeof locAddrRaw === 'string' && locAddrRaw.trim() ? locAddrRaw.trim() : null

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

  // Stored storefront copy override (settings.copy). DEFENSIVE — raw jsonb: only a
  // string is surfaced, everything else → '' (unset). The UI prefills from THIS, so
  // a blank stays blank (= follow the theme), never the resolved default.
  const copyRaw = (rawSettings.copy ?? {}) as Record<string, unknown>
  const copyStr = (v: unknown): string => (typeof v === 'string' ? v : '')
  const copy = {
    heroEyebrow: copyStr(copyRaw.heroEyebrow),
    heroTitle: copyStr(copyRaw.heroTitle),
    heroLede: copyStr(copyRaw.heroLede),
    aboutCopy: copyStr(copyRaw.aboutCopy),
    aboutCopyHome: copyStr(copyRaw.aboutCopyHome),
    aboutTitle: copyStr(copyRaw.aboutTitle),
    homeSecondTitle: copyStr(copyRaw.homeSecondTitle),
    whyTitle: copyStr(copyRaw.whyTitle),
    whySub: copyStr(copyRaw.whySub),
    whyBody: copyStr(copyRaw.whyBody),
    tagline: copyStr(copyRaw.tagline),
    italic: copyStr(copyRaw.italic),
    servicesEyebrow: copyStr(copyRaw.servicesEyebrow),
    servicesTitle: copyStr(copyRaw.servicesTitle),
    servicesIntro: copyStr(copyRaw.servicesIntro),
    teamEyebrow: copyStr(copyRaw.teamEyebrow),
    teamTitle: copyStr(copyRaw.teamTitle),
    teamLead: copyStr(copyRaw.teamLead),
    closingEyebrow: copyStr(copyRaw.closingEyebrow),
    closingTitle: copyStr(copyRaw.closingTitle),
    closingLede: copyStr(copyRaw.closingLede),
    contactEyebrow: copyStr(copyRaw.contactEyebrow),
    contactTitle: copyStr(copyRaw.contactTitle),
  }
  const socialRaw = (rawSettings.social ?? {}) as Record<string, unknown>
  const socialStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const social = {
    instagram: socialStr(socialRaw.instagram),
    facebook: socialStr(socialRaw.facebook),
    tiktok: socialStr(socialRaw.tiktok),
  }
  const ohRaw = rawSettings.opening_hours
  const openingHours = Array.isArray(ohRaw)
    ? ohRaw.filter(
        (r): r is { day: string; time: string } =>
          !!r && typeof r === 'object' && typeof (r as Record<string, unknown>).day === 'string' && typeof (r as Record<string, unknown>).time === 'string',
      )
    : null

  const counts = {
    activeServices: servicesRes.count ?? 0,
    activeStaff: staffRes.count ?? 0,
    workingHours: hoursRes.count ?? 0,
    bookings: bookingsRes.count ?? 0,
    completed: completedRes.count ?? 0,
  }

  // Bucket working_hours by staff_id (one pass), slicing "HH:MM:SS" → "HH:MM" for the
  // <input type="time"> defaults. weekday stays DB semantics (0=Sunday..6=Saturday).
  const hoursByStaff = new Map<string, { weekday: number; start: string; end: string }[]>()
  for (const h of (hoursRowsRes.data ?? []) as {
    staff_id: string
    weekday: number
    start_time: string
    end_time: string
  }[]) {
    const list = hoursByStaff.get(h.staff_id) ?? []
    list.push({ weekday: h.weekday, start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5) })
    hoursByStaff.set(h.staff_id, list)
  }
  // staff_services buckets both ways: service→staff (Tjänster-fliken) and staff→service
  // (Personal-fliken, so each medarbetare's tjänst-koppling kan sättas där också — det
  // som gör dem valbara i bokningens "Hos vem?").
  const staffByService = new Map<string, string[]>()
  const servicesByStaff = new Map<string, string[]>()
  for (const r of (staffServicesRes.data ?? []) as { service_id: string; staff_id: string }[]) {
    const sList = staffByService.get(r.service_id) ?? []
    sList.push(r.staff_id)
    staffByService.set(r.service_id, sList)
    const vList = servicesByStaff.get(r.staff_id) ?? []
    vList.push(r.service_id)
    servicesByStaff.set(r.staff_id, vList)
  }
  const staffList = (
    (staffRowsRes.data ?? []) as {
      id: string
      title: string | null
      active: boolean
      avatar_url: string | null
      show_on_site: boolean
    }[]
  ).map((s) => ({
    id: s.id,
    title: s.title,
    active: s.active,
    avatar_url: s.avatar_url ?? null,
    // Defensiv default (pre-0049-rad skulle sakna kolumnen): true = dagens beteende.
    show_on_site: s.show_on_site !== false,
    hours: hoursByStaff.get(s.id) ?? [],
    serviceIds: servicesByStaff.get(s.id) ?? [],
  }))
  // Per-service booking count → the Services surface knows whether "Ta bort" is possible
  // (0 bookings) or must degrade to "stäng av" (FK RESTRICT protects booked services).
  const bookingsByService = new Map<string, number>()
  for (const r of (serviceBookingsRes.data ?? []) as { service_id: string | null }[]) {
    if (!r.service_id) continue
    bookingsByService.set(r.service_id, (bookingsByService.get(r.service_id) ?? 0) + 1)
  }
  // Merch columns (0046) aren't in the generated row type yet — read via a loose cast.
  const services = ((serviceRowsRes.data ?? []) as unknown as ServiceMerchRow[]).map((s) => ({
    id: s.id,
    name: s.name,
    price_cents: s.price_cents,
    duration_min: s.duration_min,
    active: s.active,
    description: s.description ?? null,
    category: s.category ?? null,
    sale_price_cents: s.sale_price_cents ?? null,
    badge: s.badge ?? null,
    image_url: s.image_url ?? null,
    sort_order: s.sort_order ?? 0,
    staffIds: staffByService.get(s.id) ?? [],
    bookingCount: bookingsByService.get(s.id) ?? 0,
  }))

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
    services,
    staffList,
    salonAdmin: adminRow
      ? { email: adminRow.email, fullName: adminRow.full_name, status: adminRow.status }
      : null,
    onboarding,
    operative: { googleReviewUrl, bookingVariant },
    copy,
    social,
    openingHours: openingHours && openingHours.length > 0 ? openingHours : null,
    primaryAddress,
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
