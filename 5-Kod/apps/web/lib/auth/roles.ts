// Role → portal mapping (ADR 01 §4: 8 levels, publik → kund → frisör →
// reception → manager → owner → Corevo admin → super admin).
//
//   1 publik         (not a logged-in role)
//   2 kund           → (kund) portal
//   3 frisör/staff   → (personal) portal
//   4 reception
//   5 manager        → (admin) portal
//   6 owner / salon_admin
//   7 Corevo admin   → (platform) portal (platform_admin)
//   8 super admin
//
// Access is hierarchical: a level can enter any portal whose minimum level it
// meets. platform_admin (global level 7-8) reaches every portal cross-tenant.

export type Portal = 'kund' | 'personal' | 'admin' | 'platform'

/** Minimum role level required to enter each portal. */
export const PORTAL_MIN_LEVEL: Record<Portal, number> = {
  kund: 2,
  personal: 3,
  admin: 5,
  platform: 7,
}

// Path prefixes the middleware treats as authenticated-only (cheap gate).
// G12: back-office now lives on the platform host (booking.corevo.se) at clean
// URLs — `/salonger` + `/fakturering` join the list; the dashboard route is
// `/platform` (served at `/` via middleware rewrite, so the gate is applied to
// the post-rewrite path).
export const PROTECTED_PREFIXES = [
  '/konto',
  '/personal',
  '/admin',
  '/platform',
  '/salonger',
  '/fakturering',
] as const

/**
 * Where to send a user after login (G12: role decides the destination, host does
 * not). super_admin → `/` (platform dashboard on booking.corevo.se, rewritten);
 * salon_admin → `/admin`; staff → `/personal` (both back-office on booking.corevo.se);
 * customer → `/konto` (storefront on the tenant host).
 */
export function portalHomeFor(opts: { roleLevel: number; platformAdmin: boolean }): string {
  if (opts.platformAdmin || opts.roleLevel >= PORTAL_MIN_LEVEL.platform) return '/'
  if (opts.roleLevel >= PORTAL_MIN_LEVEL.admin) return '/admin'
  if (opts.roleLevel >= PORTAL_MIN_LEVEL.personal) return '/personal'
  return '/konto'
}
