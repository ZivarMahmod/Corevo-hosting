import 'server-only'
import { platformCtx } from './guard'

// Roller & behörighet (RBAC matrix) + Integrationer (status dashboard).
//
// Both surfaces are CATALOG views: the role/permission matrix and the integration
// descriptions are platform CONFIGURATION, not rows in a table — there is no
// `roles_catalog` or `integrations` table, and inventing one would be faking a
// data source. So the shape/labels/descriptions/perms are static const (the
// authoritative least-privilege design), and we bind the ONE honest live signal
// each surface has:
//   • Roles    → real cross-tenant user count per role NAME (RLS bypass).
//   • Integrations → real connected-tenant count where a backing column exists
//                    (Stripe charges-enabled, Google-review link set, custom
//                    domain verified). Where no column backs the count we render
//                    an honest "—", never a fabricated "21 / 24".

// ── Roller & behörighet ─────────────────────────────────────────────────────────
// Perm / RoleTone / PERMISSION_AREAS live in catalog-shared (NO 'server-only') so the
// RolesMatrix client island can import the PERMISSION_AREAS value without dragging
// this server-only module into the client bundle. Imported for local use here +
// re-exported so every existing server-side importer of these from catalog is intact.
import type { Perm, RoleTone } from './catalog-shared'
export type { Perm, RoleTone } from './catalog-shared'
export { PERMISSION_AREAS } from './catalog-shared'

export type PlatformRole = {
  /** DB role name(s) this card aggregates its live user count from (null = no
   *  seeded DB role, e.g. Support/Ekonomi are org roles without a level). */
  dbRoleNames: string[] | null
  name: string
  who: string
  tone: RoleTone
  note: string
  /** Permission per area, aligned to PERMISSION_AREAS. */
  perms: Perm[]
}

/** Static least-privilege design (mock SU_ROLES). Order = matrix display order. */
const ROLE_CATALOG: PlatformRole[] = [
  {
    dbRoleNames: ['super_admin'],
    name: 'Super admin',
    who: 'Zivar',
    tone: 'gold',
    note: 'Plattformsägare — full kontroll, kringgår tenant-isolering.',
    perms: ['full', 'full', 'full', 'full', 'full', 'full', 'full'],
  },
  {
    dbRoleNames: ['salon_admin'],
    name: 'Salongsägare',
    who: 'Ägare',
    tone: 'success',
    note: 'Leksakslådan: full kontroll i egen tenant, ser aldrig andras.',
    perms: ['—', 'own', 'own', 'view', 'own', 'own', '—'],
  },
  {
    dbRoleNames: ['staff'],
    name: 'Frisör',
    who: 'Personal',
    tone: 'info',
    note: 'Egen dag + egna kunder. PII tidsbunden.',
    perms: ['—', 'view', 'own', '—', '—', '—', '—'],
  },
  {
    dbRoleNames: null,
    name: 'Support',
    who: 'Corevo-team',
    tone: 'neutral',
    note: 'Läsläge för felsökning. Kan trigga lösenordsreset.',
    perms: ['view', 'view', 'view', '—', '—', '—', 'view'],
  },
  {
    dbRoleNames: null,
    name: 'Ekonomi',
    who: 'Bokföring',
    tone: 'warning',
    note: 'Endast faktureringsunderlag.',
    perms: ['view', '—', '—', 'full', '—', '—', '—'],
  },
]

export type PlatformRoleWithUsers = PlatformRole & {
  /** Live cross-tenant user count, or null when no seeded DB role backs it. */
  users: number | null
}

/**
 * The role catalog with LIVE user counts per role name (RLS bypass — counts users
 * across every tenant). Support/Ekonomi have no seeded DB role → users:null so the
 * view shows an honest "—" rather than a fake count.
 */
export async function getPlatformRoles(): Promise<PlatformRoleWithUsers[]> {
  const { supabase } = await platformCtx()
  // One grouped read: users joined to their role name, cross-tenant.
  const { data } = await supabase.from('users').select('roles(name)')
  const counts = new Map<string, number>()
  for (const row of (data ?? []) as { roles: { name: string | null } | { name: string | null }[] | null }[]) {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles
    const name = role?.name
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return ROLE_CATALOG.map((r) => ({
    ...r,
    users: r.dbRoleNames ? r.dbRoleNames.reduce((sum, n) => sum + (counts.get(n) ?? 0), 0) : null,
  }))
}

// ── Integrationer ───────────────────────────────────────────────────────────────
/** How the connected-count is sourced — drives whether we show a live count + a
 *  derived status badge. null = no per-tenant backing column → no count, no badge. */
export type IntegrationCountSource = 'stripe' | 'review_link' | 'custom_domain' | null

export type Integration = {
  id: string
  name: string
  desc: string
  color: string
  letter: string
  flow: string
  countSource: IntegrationCountSource
}

// NO static `status` field here (#13): a hardcoded "Aktiv"/"Pilot" string is exactly
// the fake-live signal the ärlighetspass kills. The status badge is DERIVED at render
// from the real `connected` count (see IntegrationsGrid.statusBadge), and cards with
// no backing column get no badge at all.

/** Static integration catalog (mock SU_INTEGRATIONS) — descriptions are config. */
const INTEGRATION_CATALOG: Integration[] = [
  {
    id: 'stripe',
    name: 'Stripe Connect',
    desc: 'Betalning vid bokning + utbetalning per tenant.',
    color: '#635BFF',
    letter: 'S',
    flow: 'Flöde 1 (kund betalar salongen direkt)',
    countSource: 'stripe',
  },
  {
    id: 'google',
    name: 'Google-recensioner',
    desc: 'Recensionslänk per salong — visas i kundportal & bekräftelse.',
    color: '#EA4335',
    letter: 'G',
    flow: 'tenant_settings.review_link',
    countSource: 'review_link',
  },
  {
    id: 'sms',
    name: 'SMS (46elks)',
    desc: 'Bokningsbekräftelse + påminnelse 24 h innan.',
    color: '#1F4636',
    letter: 'S',
    flow: 'Kö via Worker · sann-kopplad toggle',
    countSource: null,
  },
  {
    id: 'mail',
    name: 'E-post (Resend)',
    desc: 'Bekräftelser, invites, lösenordsreset.',
    color: '#0A0A0A',
    letter: '@',
    flow: 'Transaktionell',
    countSource: null,
  },
  {
    id: 'domain',
    name: 'Cloudflare / Domän',
    desc: 'Subdomän salong.corevo.se. Egen domän = parkerat spår.',
    color: '#F38020',
    letter: 'C',
    flow: 'tenant_domains',
    countSource: 'custom_domain',
  },
  {
    id: 'pos',
    name: 'Corevo POS',
    desc: 'Kassakoppling på plats. Guardrail aktiv.',
    color: '#B5760A',
    letter: 'P',
    flow: 'POS-guardrail på corevo.se',
    countSource: null,
  },
]

export type IntegrationWithCount = Integration & {
  /** "{connected} / {total}" live, or null when no backing column exists. */
  connected: number | null
  total: number
}

/**
 * The integration catalog with LIVE connected-tenant counts where a backing column
 * exists (RLS bypass). SMS/E-post/POS have no per-tenant backing column → connected
 * is null and the view shows an honest "—" instead of a fabricated count.
 */
export async function getPlatformIntegrations(): Promise<IntegrationWithCount[]> {
  const { supabase } = await platformCtx()
  const [totalRes, stripeRes, domainRes, settingsRes] = await Promise.all([
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    // Stripe "connected" = a tenant whose Stripe account can take charges.
    supabase
      .from('tenants')
      .select('*', { count: 'exact', head: true })
      .eq('stripe_charges_enabled', true),
    // Custom domain "connected" = a verified tenant_domains row.
    supabase
      .from('tenant_domains')
      .select('tenant_id', { count: 'exact', head: true })
      .eq('verified', true),
    // Review-link "connected" = a tenant_settings row whose settings jsonb has a
    // non-empty google_review_url. No SQL jsonb filter for non-empty, so pull the
    // candidate rows (settings is small) and tally in JS.
    supabase.from('tenant_settings').select('settings'),
  ])

  const total = totalRes.count ?? 0
  const reviewConnected = ((settingsRes.data ?? []) as { settings: Record<string, unknown> | null }[]).filter(
    (s) => {
      const url = s.settings?.google_review_url
      return typeof url === 'string' && url.trim().length > 0
    },
  ).length

  const liveCount: Record<NonNullable<IntegrationCountSource>, number> = {
    stripe: stripeRes.count ?? 0,
    custom_domain: domainRes.count ?? 0,
    review_link: reviewConnected,
  }

  return INTEGRATION_CATALOG.map((it) => ({
    ...it,
    total,
    connected: it.countSource ? liveCount[it.countSource] : null,
  }))
}
