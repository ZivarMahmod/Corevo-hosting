import { PLATFORM_ROUTE_PREFIXES } from './platform-routes'
import type { TenantResolution } from '@/lib/tenant'

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
  if (opts.platformAdmin || opts.partnerAdmin || opts.roleLevel >= PORTAL_MIN_LEVEL.platform)
    return '/'
  if (opts.roleLevel >= PORTAL_MIN_LEVEL.admin) return '/admin'
  // Paket 06: personalens egen mobil-PWA är primär på booking.corevo.se.
  // Kundadminens kalender finns kvar för uttryckligen delegerade adminytor.
  if (opts.roleLevel >= PORTAL_MIN_LEVEL.personal) return '/personal'
  return '/konto'
}

/** One sign-in host per role: platform operators use superbooking, tenant admin
 * and staff use booking, and customers use their exact tenant host. */
export function backofficeHostKindForRole(opts: {
  roleLevel: number
  platformAdmin: boolean
  partnerAdmin?: boolean
}): 'superadmin' | 'platform' | 'tenant' {
  if (opts.platformAdmin || opts.partnerAdmin || opts.roleLevel >= PORTAL_MIN_LEVEL.platform) {
    return 'superadmin'
  }
  if (opts.roleLevel >= PORTAL_MIN_LEVEL.personal) return 'platform'
  return 'tenant'
}

export type LoginHostKind = 'superadmin' | 'platform' | 'staff_portal' | 'tenant' | 'other'

/** The compatibility staff host must stay on its one session-bearing surface. */
export function loginDestinationForHost(opts: {
  home: string
  next: string | null
  hostKind: LoginHostKind | null
}): string {
  return opts.hostKind === 'staff_portal' ? opts.home : (opts.next ?? opts.home)
}

export function resolveLoginHostKind(
  resolution: TenantResolution,
  hasActiveTenant: boolean,
): LoginHostKind {
  return resolution.kind === 'superadmin' ||
    resolution.kind === 'platform' ||
    resolution.kind === 'staff_portal'
    ? resolution.kind
    : hasActiveTenant
      ? 'tenant'
      : 'other'
}

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

/** A role may establish a session only on its own host. */
export function loginAccessForHost(opts: {
  roleLevel: number
  platformAdmin: boolean
  partnerAdmin?: boolean
  accountTenantId: string | null
  hostKind: LoginHostKind
  hostTenantId: string | null
}): { allowed: boolean } {
  const accountDoor = backofficeHostKindForRole(opts)

  if (accountDoor === 'tenant') {
    const matchingTenant =
      opts.hostKind === 'tenant' &&
      Boolean(opts.accountTenantId) &&
      opts.accountTenantId === opts.hostTenantId
    return { allowed: matchingTenant }
  }

  // COMPAT: minbooking is a published staff-only login boundary. It reaches the
  // same /personal owner as booking and never admits owners/platform operators.
  if (opts.hostKind === 'staff_portal') {
    return {
      allowed:
        accountDoor === 'platform' &&
        !opts.platformAdmin &&
        !opts.partnerAdmin &&
        opts.roleLevel === PORTAL_MIN_LEVEL.personal,
    }
  }

  return { allowed: accountDoor === opts.hostKind }
}
