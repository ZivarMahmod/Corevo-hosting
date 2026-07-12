import 'server-only'
import { platformCtx } from './guard'

// Cross-tenant people reads for the platform control center (M7 §2.1B / §2.4 —
// "Supabase-kraft med mitt UI"). Each query OMITS the .eq('tenant_id', …) filter:
// the authed platform_admin JWT carries the platform_admin claim, so RLS
// (private.is_platform_admin()) returns rows for EVERY tenant. A normal
// salon_admin running the identical query only ever sees its own tenant — the
// filter is RLS, not a WHERE clause, so this can never leak across tenants.
//
// HONEST BINDING (do not chase the mock's demo rows):
//  • Kunder bind the `customers` table — the real customer entity. It maps
//    cleanly (name/email/phone/visits/status/last_seen). Salon OWNERS live in
//    `users`, NOT `customers`, so an "Ägare" only appears here if they also
//    booked as a customer. That's correct, not a gap — we never union `users`
//    in to fabricate the mock's owner rows.
//  • Personal bind `staff` joined to `users` (for the login email) — name comes
//    from staff.title, role from the joined role, invited from staff.created_at.
//  • Visits = count of that customer's bookings via bookings.customer_id (the FK
//    bookings_customer_id_fkey — the live link from a booking to a customer row).

// ── Kunder (cross-tenant kundsök) ───────────────────────────────────────────────
export type CustomerRole = 'Kund' | 'Gäst'
export type CustomerListItem = {
  id: string
  name: string
  email: string | null
  phone: string | null
  tenant: string // salon NAME (mock column "Salong")
  slug: string
  role: CustomerRole
  auth: string // "Lösenord" | "Gäst-nyckel"
  visits: number
  status: string // "Aktiv" | "Skyddat namn" | "Anonymiserad"
  lastLogin: string | null // ISO — the view formats it ("8 maj 2026")
}

export type CustomerFilters = { q?: string; tenant?: string }

/** Honest display name: name_hidden → "Skyddat namn", else full/display name. */
export function customerDisplayName(c: {
  full_name: string | null
  display_name: string | null
  name_hidden: boolean
}): string {
  if (c.name_hidden) return 'Skyddat namn'
  return (c.full_name ?? c.display_name ?? '').trim() || 'Okänd kund'
}

/** A customer with no linked auth user is a stable-key guest (gäst-nyckel). */
export function customerAuthLabel(authUserId: string | null): string {
  return authUserId ? 'Lösenord' : 'Gäst-nyckel'
}
export function customerRole(authUserId: string | null): CustomerRole {
  return authUserId ? 'Kund' : 'Gäst'
}
/** customers.status enum (active|anonymized) → the badge label the mock shows. */
export function customerStatusLabel(status: string, nameHidden: boolean): string {
  if (status === 'anonymized') return 'Anonymiserad'
  if (nameHidden) return 'Skyddat namn'
  return 'Aktiv'
}

type CustomerRow = {
  id: string
  full_name: string | null
  display_name: string | null
  name_hidden: boolean
  email: string | null
  phone: string | null
  status: string
  last_seen_at: string | null
  auth_user_id: string | null
  tenant_id: string
  tenants: { slug: string; name: string } | { slug: string; name: string }[] | null
  bookings: { count: number }[] | null
}

/**
 * All customers cross-tenant (RLS bypass), filtered by free-text (name/email) and
 * optional salon. Joins tenants for the salon name and aggregates the booking
 * count (visits) in one round-trip via the embedded count.
 */
export async function listCustomersAllTenants(
  filters: CustomerFilters = {},
): Promise<CustomerListItem[]> {
  const { supabase } = await platformCtx()
  let q = supabase
    .from('customers')
    .select(
      'id, full_name, display_name, name_hidden, email, phone, status, last_seen_at, auth_user_id, tenant_id, tenants(slug, name), bookings(count)',
    )
    .order('last_seen_at', { ascending: false })

  if (filters.tenant && filters.tenant !== 'all') q = q.eq('tenant_id', filters.tenant)
  if (filters.q && filters.q.trim()) {
    // PostgREST .or() takes a comma-list — strip chars that break the parse.
    const safe = filters.q.trim().replace(/[,()*"\\]/g, ' ')
    const term = `%${safe}%`
    q = q.or(`full_name.ilike.${term},display_name.ilike.${term},email.ilike.${term}`)
  }

  const { data } = await q
  return ((data ?? []) as CustomerRow[]).map((c) => {
    const t = Array.isArray(c.tenants) ? c.tenants[0] : c.tenants
    const visits = Array.isArray(c.bookings) ? (c.bookings[0]?.count ?? 0) : 0
    return {
      id: c.id,
      name: customerDisplayName(c),
      email: c.email,
      phone: c.phone,
      tenant: t?.name ?? '—',
      slug: t?.slug ?? '',
      role: customerRole(c.auth_user_id),
      auth: customerAuthLabel(c.auth_user_id),
      visits,
      status: customerStatusLabel(c.status, c.name_hidden),
      lastLogin: c.last_seen_at,
    }
  })
}

// ── Personal (cross-tenant staff + invite-status) ───────────────────────────────
export type StaffListItem = {
  id: string
  name: string
  email: string | null
  tenant: string // salon NAME
  slug: string
  role: string // humanized role label (Frisör / Salongschef …)
  services: number
  invited: string | null // ISO created_at — the view formats it
  status: string // "Aktiv" | "Inbjuden" | "Väntar bekräftelse"
}

export type StaffFilters = { q?: string; status?: string }

/** Map the seeded role enum → the Swedish label the mock shows. */
const STAFF_ROLE_LABEL: Record<string, string> = {
  salon_admin: 'Ägare',
  staff: 'Personal',
}
export function staffRoleLabel(roleName: string | null): string {
  if (!roleName) return 'Personal'
  return STAFF_ROLE_LABEL[roleName] ?? roleName
}

/**
 * Derive the invite/active status the mock surfaces:
 *  • staff row with no linked user account  → "Väntar bekräftelse" (created via
 *    Zivar-assisted onboarding, magic-link not yet accepted).
 *  • linked user not active                 → "Inbjuden".
 *  • linked + active                        → "Aktiv".
 */
export function staffStatus(opts: {
  active: boolean
  hasUser: boolean
  userStatus: string | null
}): string {
  if (!opts.hasUser) return 'Väntar bekräftelse'
  if (!opts.active || opts.userStatus !== 'active') return 'Inbjuden'
  return 'Aktiv'
}

type StaffRow = {
  id: string
  title: string | null
  active: boolean
  created_at: string
  profile_id: string | null
  tenants: { slug: string; name: string } | { slug: string; name: string }[] | null
  users: { email: string | null; status: string | null; roles: { name: string | null } | { name: string | null }[] | null } | { email: string | null; status: string | null; roles: { name: string | null } | { name: string | null }[] | null }[] | null
  staff_services: { count: number }[] | null
}

/**
 * All staff cross-tenant (RLS bypass). Joins tenants for the salon name, users for
 * the login email + status + role, and aggregates the staff_services count. Filters
 * by free-text (name/email) and derived invite status — done in JS because status
 * is computed from active + linked-user, not a single column.
 */
export async function listStaffAllTenants(filters: StaffFilters = {}): Promise<StaffListItem[]> {
  const { supabase } = await platformCtx()
  const { data } = await supabase
    .from('staff')
    .select(
      'id, title, active, created_at, profile_id, tenants(slug, name), users(email, status, roles(name)), staff_services(count)',
    )
    .order('created_at', { ascending: false })

  let rows = ((data ?? []) as StaffRow[]).map((s) => {
    const t = Array.isArray(s.tenants) ? s.tenants[0] : s.tenants
    const u = Array.isArray(s.users) ? s.users[0] : s.users
    const role = u ? (Array.isArray(u.roles) ? u.roles[0] : u.roles) : null
    const services = Array.isArray(s.staff_services) ? (s.staff_services[0]?.count ?? 0) : 0
    return {
      id: s.id,
      name: (s.title ?? '').trim() || 'Namnlös',
      email: u?.email ?? null,
      tenant: t?.name ?? '—',
      slug: t?.slug ?? '',
      role: staffRoleLabel(role?.name ?? null),
      services,
      invited: s.created_at,
      status: staffStatus({
        active: s.active,
        hasUser: !!s.profile_id,
        userStatus: u?.status ?? null,
      }),
    }
  })

  // Free-text matches name + email + salong (mirrors the mock's combined filter).
  // Done in JS, not server-side: email lives on the embedded `users` resource, so
  // PostgREST can't OR across it in one filter — and the staff volume is tiny.
  if (filters.q && filters.q.trim()) {
    const needle = filters.q.trim().toLowerCase()
    rows = rows.filter((r) =>
      `${r.name} ${r.email ?? ''} ${r.tenant}`.toLowerCase().includes(needle),
    )
  }
  if (filters.status && filters.status !== 'all') {
    rows = rows.filter((r) => r.status === filters.status)
  }
  return rows
}
