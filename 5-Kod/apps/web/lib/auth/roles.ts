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
  // goal-17 platform control-center surfaces (clean URLs on booking.corevo.se,
  // siblings of /salonger + /fakturering). Each page ALSO self-gates with
  // requirePlatformAdmin(); listing them here is the cheap auth gate (defence in
  // depth) so an unauth hit bounces to /login before a server render.
  '/kunder',
  '/personal-plattform',
  '/drift-och-logg',
  '/integrationer',
  '/roller',
  '/installningar',
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
