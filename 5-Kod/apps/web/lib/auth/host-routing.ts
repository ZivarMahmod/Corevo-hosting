// goal-27 — host-based 3-door back-office split (PRODUCTION hosts only). Pure +
// dependency-free so it runs in middleware (edge) and a plain vitest.
//
// Three back-office hosts, each serving exactly ONE surface family:
//   superbooking.corevo.se  (kind 'superadmin')   → app/(platform)  PLATFORM_GROUP
//   booking.corevo.se       (kind 'platform')      → app/(admin)     ADMIN_GROUP
//   minbooking.corevo.se    (kind 'staff_portal')  → app/(personal)  STAFF_GROUP
//
// A request for a surface that belongs to ANOTHER door is redirected to that
// host. Cookies are host-locked (AUTH_COOKIE_DOMAIN unset), so there is no session
// on the other host → the user logs in on the right door (edge accepted v1).
// Anything outside the three families (+ auth/api) is bounced to the host's own
// home. The clean-URL dashboard rewrite (`/` ⇄ /platform) lives on the superadmin
// host.
//
// SCOPE: this policy is for REAL *.corevo.se hosts only. The caller (middleware)
// gates it behind !isPreviewHost, so dev/*.localhost + *.workers.dev keep the G12
// unified back-office (booking serves all three families) — that's why the
// existing e2e/backoffice-routing.spec.ts (all *.localhost) stays valid.

export type BackofficeHostKind = 'superadmin' | 'platform' | 'staff_portal'

export type HostRouteDecision =
  | { action: 'pass' }
  | { action: 'rewrite'; to: string } // same host, URL unchanged
  | { action: 'redirect'; to: string } // same host
  | { action: 'redirectHost'; host: string; to: string } // cross-host (absolute)

export type BackofficeHosts = { superadmin: string; platform: string; staff: string }

// Internal dashboard route (file lives at app/(platform)/platform); served at `/`.
const DASHBOARD = '/platform'

// app/(platform) clean surfaces (siblings served at the root on the superadmin
// host). Mirrors the platform block of PROTECTED_PREFIXES + the dashboard route.
const PLATFORM_GROUP = [
  '/platform',
  '/salonger',
  '/fakturering',
  '/kunder',
  '/roller',
  '/installningar',
  '/drift-och-logg',
  '/integrationer',
  '/personal-plattform',
]
const ADMIN_GROUP = ['/admin'] // app/(admin)
const STAFF_GROUP = ['/personal'] // app/(personal)

// Whole-SEGMENT prefix match: '/personal' matches '/personal' and '/personal/x'
// but NOT '/personal-plattform' (its own platform surface), and '/installningar'
// (platform) never shadows '/admin/installningar' (admin) because the latter is
// caught by ADMIN_GROUP's '/admin' first. Identical to middleware's isPrefix —
// duplicated here to keep this module dependency-free.
const isPrefix = (path: string, prefixes: readonly string[]): boolean =>
  prefixes.some((p) => path === p || path.startsWith(p + '/'))

// Served on EVERY back-office host: the shared auth pages and all route handlers.
// '/auth' = /auth/confirm (mejl-länkens token→session-växling) och
// '/uppdatera-losenord' = välj-lösenord-sidan efter invite/recovery — båda måste
// nås på varje dörr eftersom invite-mejlet pekar på mottagarens roll-host.
const isAlwaysAllowed = (path: string): boolean =>
  isPrefix(path, ['/login', '/ingen-atkomst', '/auth', '/uppdatera-losenord']) ||
  path === '/api' ||
  path.startsWith('/api/')

/**
 * Decide how a back-office host should route `path`. Pure: returns an intent the
 * middleware translates into a NextResponse (rewrite/redirect/cross-host/pass).
 * Only called for the three back-office host kinds on real *.corevo.se hosts.
 */
export function decideBackofficeRoute(params: {
  hostKind: BackofficeHostKind
  path: string
  hosts: BackofficeHosts
}): HostRouteDecision {
  const { hostKind, path, hosts } = params

  if (isAlwaysAllowed(path)) return { action: 'pass' }

  switch (hostKind) {
    case 'superadmin':
      // Never expose the internal /platform prefix — bounce to the clean root.
      if (isPrefix(path, [DASHBOARD])) return { action: 'redirect', to: '/' }
      // `/` serves the platform dashboard (rewrite; the URL stays `/`).
      if (path === '/') return { action: 'rewrite', to: DASHBOARD }
      if (isPrefix(path, PLATFORM_GROUP)) return { action: 'pass' }
      if (isPrefix(path, ADMIN_GROUP)) return { action: 'redirectHost', host: hosts.platform, to: path }
      if (isPrefix(path, STAFF_GROUP)) return { action: 'redirectHost', host: hosts.staff, to: path }
      return { action: 'redirect', to: '/' }

    case 'platform':
      if (isPrefix(path, PLATFORM_GROUP)) return { action: 'redirectHost', host: hosts.superadmin, to: path }
      if (isPrefix(path, STAFF_GROUP)) return { action: 'redirectHost', host: hosts.staff, to: path }
      if (isPrefix(path, ADMIN_GROUP)) return { action: 'pass' }
      // `/` (and anything else) → salon-admin entry; the auth gate forwards an
      // unauthenticated visitor on to /login.
      return { action: 'redirect', to: '/admin' }

    case 'staff_portal':
      if (isPrefix(path, PLATFORM_GROUP)) return { action: 'redirectHost', host: hosts.superadmin, to: path }
      if (isPrefix(path, ADMIN_GROUP)) return { action: 'redirectHost', host: hosts.platform, to: path }
      if (isPrefix(path, STAFF_GROUP)) return { action: 'pass' }
      return { action: 'redirect', to: '/personal' }
  }
}
