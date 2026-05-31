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

/** Path prefixes the middleware treats as authenticated-only (cheap gate). */
export const PROTECTED_PREFIXES = ['/konto', '/personal', '/admin', '/platform'] as const

/** Where to send a user after login / when they hit '/' of the app, by level. */
export function portalHomeFor(opts: { roleLevel: number; platformAdmin: boolean }): string {
  if (opts.platformAdmin || opts.roleLevel >= PORTAL_MIN_LEVEL.platform) return '/platform'
  if (opts.roleLevel >= PORTAL_MIN_LEVEL.admin) return '/admin'
  if (opts.roleLevel >= PORTAL_MIN_LEVEL.personal) return '/personal'
  return '/konto'
}
