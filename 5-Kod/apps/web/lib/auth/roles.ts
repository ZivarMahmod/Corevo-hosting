import { PLATFORM_ROUTE_PREFIXES } from './platform-routes'

// Role → portal mapping. ADR 01 §4 sketched an 8-level ladder (publik → kund →
// frisör → reception → manager → owner → Corevo admin → super admin), but only
// FOUR levels are actually seeded in the DB. Thresholds below are pinned to those
// REAL levels so seeding a phantom level (4/5/7) can never silently shift the
// surface matrix.
//
//   REAL seeded levels:
//     2 kund         → (kund) portal
//     3 staff        → (personal) portal
//     6 salon_admin  → (admin) portal
//     8 super_admin  → (platform) portal (platform_admin=true)
//
// Access is hierarchical: a level can enter any portal whose minimum it meets
// (a salon_admin=6 also reaches /personal, by design). The (platform) portal is
// gated by the platform_admin BOOLEAN flag (requirePlatformAdmin), NOT by level —
// the numeric `platform` threshold below is only the portalHomeFor() fallback.
// A platform_admin reaches every portal cross-tenant; the middleware additionally
// bounces them OFF the tenant-scoped surfaces (/admin, /personal) so they land on
// the platform dashboard instead of an account-anchored tenant.

export type Portal = 'kund' | 'personal' | 'admin' | 'platform'

/** Minimum role level required to enter each portal (pinned to real DB levels). */
export const PORTAL_MIN_LEVEL: Record<Portal, number> = {
  kund: 2,
  personal: 3,
  admin: 6,
  platform: 8,
}

// Path prefixes the middleware treats as authenticated-only (cheap gate).
// G12: back-office now lives on the platform host (booking.corevo.se) at clean
// URLs — `/kunder` + `/fakturering` join the list; the dashboard route is
// `/platform` (served at `/` via middleware rewrite, so the gate is applied to
// the post-rewrite path).
export const PROTECTED_PREFIXES = [
  '/konto',
  '/personal',
  '/admin',
  // Every app/(platform) route shares the same edge-safe contract as host
  // routing and the tenant-host bounce. Each page also self-gates through the
  // (platform) layout; this is the cheap defence-in-depth auth gate.
  ...PLATFORM_ROUTE_PREFIXES,
] as const

/**
 * Where to send a user after login (G12: role decides the destination, host does
 * not). super_admin → `/` (platform dashboard on booking.corevo.se, rewritten);
 * salon_admin → `/admin`; staff → `/personal` (both back-office on booking.corevo.se);
 * customer → `/konto` (storefront on the tenant host).
 */
export function portalHomeFor(opts: {
  roleLevel: number
  platformAdmin: boolean
  partnerAdmin?: boolean
}): string {
  if (opts.platformAdmin || opts.partnerAdmin || opts.roleLevel >= PORTAL_MIN_LEVEL.platform) return '/'
  if (opts.roleLevel >= PORTAL_MIN_LEVEL.admin) return '/admin'
  // Paket 06: personalens egen mobil-PWA är primär på booking.corevo.se.
  // Kundadminens kalender finns kvar för uttryckligen delegerade adminytor.
  if (opts.roleLevel >= PORTAL_MIN_LEVEL.personal) return '/personal'
  return '/konto'
}

/**
 * goal-27 — DOOR ISOLATION. Which single back-office host (TenantResolution kind) a
 * role uses as its PRIMARY sign-in host: super_admin ⇒ superbooking
 * ('superadmin'), salon_admin/staff ⇒ booking ('platform'). minbooking is an
 * explicit staff-only legacy exception enforced by loginAccessForHost. A
 * customer (below the staff floor) has no back-office door → 'tenant'. The login
 * action rejects + signs out any credential used on a host whose kind ≠ this, so a
 * super-admin credential can NEVER establish a session on booking/minbooking (and
 * vice-versa) — that's what protects the super-admin "godmode" login. Mirrors
 * portalHomeFor's thresholds (platform_admin flag wins regardless of level).
 */
export function backofficeHostKindForRole(opts: {
  roleLevel: number
  platformAdmin: boolean
  partnerAdmin?: boolean
}): 'superadmin' | 'platform' | 'staff_portal' | 'tenant' {
  if (opts.platformAdmin || opts.partnerAdmin || opts.roleLevel >= PORTAL_MIN_LEVEL.platform) {
    return 'superadmin'
  }
  // ROLL-SEPARATION: personal (nivå 3) jobbar i adminportalens kalender och därför på
  // ADMIN-dörren (booking). Den dörren serverar även /personal (schema/frånvaro), så
  // hela arbetsdagen ligger bakom EN inloggning — noll extra klick, ingen värdbyte.
  // minbooking-dörren (staff_portal) lever kvar och serverar /personal som förr.
  if (opts.roleLevel >= PORTAL_MIN_LEVEL.personal) return 'platform'
  return 'tenant'
}

export type LoginHostKind = 'superadmin' | 'platform' | 'staff_portal' | 'tenant' | 'other'
export type LoginHostAccess =
  | { allowed: true; legacyStaff: boolean }
  | { allowed: false; legacyStaff: false }

/** Database-backed activation state used after authentication, not JWT claims. */
export function isActiveLoginAccount(input: {
  profileStatus: string | null | undefined
  roleLevel: number
  activeStaff: boolean
}): boolean {
  return (
    input.profileStatus === 'active' &&
    input.roleLevel >= PORTAL_MIN_LEVEL.kund &&
    (input.roleLevel !== PORTAL_MIN_LEVEL.personal || input.activeStaff)
  )
}

/**
 * Authoritative production login-door contract. A role may establish a session
 * only on its own host. Staff additionally retain the explicit minbooking
 * legacy door, but that exception never applies to owners or platform admins.
 * Customers are bound to the exact resolved storefront tenant.
 */
export function loginAccessForHost(opts: {
  roleLevel: number
  platformAdmin: boolean
  partnerAdmin?: boolean
  accountTenantId: string | null
  hostKind: LoginHostKind
  hostTenantId: string | null
}): LoginHostAccess {
  const accountDoor = backofficeHostKindForRole(opts)

  if (accountDoor === 'tenant') {
    const matchingTenant =
      opts.hostKind === 'tenant' &&
      Boolean(opts.accountTenantId) &&
      opts.accountTenantId === opts.hostTenantId
    return matchingTenant
      ? { allowed: true, legacyStaff: false }
      : { allowed: false, legacyStaff: false }
  }

  if (accountDoor === opts.hostKind) return { allowed: true, legacyStaff: false }

  const legacyStaff =
    accountDoor === 'platform' &&
    opts.hostKind === 'staff_portal' &&
    !opts.platformAdmin &&
    opts.roleLevel >= PORTAL_MIN_LEVEL.personal &&
    opts.roleLevel < PORTAL_MIN_LEVEL.admin
  return legacyStaff
    ? { allowed: true, legacyStaff: true }
    : { allowed: false, legacyStaff: false }
}
