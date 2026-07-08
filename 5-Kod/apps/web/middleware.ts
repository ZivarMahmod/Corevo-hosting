// Tenant resolution + Supabase SSR session refresh + the G12 two-zone router.
//
// G12 — back-office vs storefront, split by host:
//  • PLATFORM host (booking.corevo.se) = back-office for super_admin / salon_admin
//    / staff. Clean URLs at the root: `/` serves the platform dashboard (the
//    internal `/platform` route, via rewrite); `/salonger`, `/fakturering`,
//    `/admin/*`, `/personal/*`, `/login` are served as-is. The bare `/platform*`
//    prefix is redirected to `/` so it never appears in the URL.
//  • TENANT host (frisorN.corevo.se) = storefront only: `(public)`, `/boka`,
//    `/konto`, `/registrera`, `/login`. Back-office paths are bounced to `/`.
//
// Tenant identity: the storefront resolves it from the HOST (the header set below);
// the back-office resolves it from the logged-in ACCOUNT (JWT app_metadata) in the
// DAL/layouts — never from the host. Data isolation is RLS + tenant_id (ADR 01 §2).
//
// goal-27 — on REAL *.corevo.se the back-office further splits into THREE doors by
// host (decideBackofficeRoute): superbooking = platform/super-admin, booking = salon
// admin (/admin), minbooking = staff (/personal). A surface that belongs to another
// door redirects to that host (cookies are host-locked, so the user re-logs in there).
// This split is GATED to non-preview hosts: dev/*.localhost + *.workers.dev keep the
// G12 single-host back-office (booking serves all three families) below, so the
// existing e2e/backoffice-routing.spec.ts (all *.localhost) is unaffected.
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import {
  getTenantFromHost,
  getPlatformHost,
  getSuperadminHost,
  getStaffHost,
  isExternalHost,
  isPreviewHost,
} from '@/lib/tenant'
import { resolveCustomDomainSlug } from '@/lib/custom-domain'
import { PROTECTED_PREFIXES } from '@/lib/auth/roles'
import { decideBackofficeRoute, type BackofficeHostKind } from '@/lib/auth/host-routing'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'

// Internal dashboard route (file lives at app/(platform)/platform); served at `/`.
const DASHBOARD_ROUTE = '/platform'
// Back-office surfaces that must NOT be served on a tenant (storefront) host.
// goal-17 added the six platform control-center routes (siblings of /salonger +
// /fakturering); listing them bounces them to `/` on a tenant host, exactly like
// the existing platform surfaces. NOTE: '/personal-plattform' is listed explicitly
// — isPrefix only matches '/personal' as a whole segment ('/personal' or
// '/personal/…'), so it never shadows the platform route.
const BACKOFFICE_PREFIXES = [
  '/admin',
  '/personal',
  '/platform',
  '/salonger',
  '/fakturering',
  '/kunder',
  '/personal-plattform',
  '/drift-och-logg',
  '/integrationer',
  '/roller',
  '/installningar',
]
// Tenant-SCOPED back-office surfaces: each resolves exactly one tenant from the
// logged-in account. A platform_admin has no single tenant to scope to, so these
// would silently render/mutate whatever tenant the account is anchored to —
// they're bounced to the platform dashboard (step 4b). The platform surfaces
// (/platform, /salonger, /fakturering) are NOT here: a platform_admin SHOULD reach
// them, and they're already flag-gated by requirePlatformAdmin() in the layout.
const TENANT_SCOPED_BACKOFFICE = ['/admin', '/personal']

const isPrefix = (path: string, prefixes: readonly string[]): boolean =>
  prefixes.some((p) => path === p || path.startsWith(p + '/'))

export async function middleware(request: NextRequest) {
  const url = request.nextUrl
  const path = url.pathname

  // 1. Resolve tenant from Host (host → slug) with dev/preview fallbacks
  //    (?tenant= / /t/<slug>). Data isolation is enforced by RLS + tenant_id,
  //    NEVER by this header (ADR 01 §2).
  const host = request.headers.get('host')
  let tenant = getTenantFromHost(host, {
    search: url.searchParams,
    pathname: url.pathname,
  })

  // 1b. Preview fallback: hosts without per-tenant subdomains (e.g. *.workers.dev)
  //     persist the ?tenant=<slug> dev override in a cookie. Never overrides a real
  //     subdomain/host match (only fills an otherwise-unresolved tenant).
  // The override (?tenant= and its persistence cookie) is a DEV/PREVIEW convenience
  // ONLY — gated to non-production hosts so a real salon/platform domain can never
  // be flipped to a foreign tenant (tenant-confusion). getTenantFromHost already
  // ignores ?tenant= off-preview; this gates the cookie read/write to match.
  const previewHost = isPreviewHost(host)
  const TENANT_OVERRIDE_COOKIE = 'corevo-tenant-override'
  const qsTenant = previewHost ? url.searchParams.get('tenant') : null
  if (previewHost && tenant.kind !== 'tenant') {
    const cookieSlug = request.cookies.get(TENANT_OVERRIDE_COOKIE)?.value
    if (cookieSlug) tenant = { kind: 'tenant', slug: cookieSlug }
  }

  // 1c. Custom domain (goal-16): an EXTERNAL host (a customer's own domain DNS-routed
  //     to the worker) doesn't match our *.corevo.se suffix, so it resolves to
  //     kind:'unknown'. Fall back to an async tenant_domains lookup (verified + active
  //     only, in-process cached). Purely ADDITIVE — a hit yields kind:'tenant' which
  //     flows into the headers/guard exactly like a subdomain match; a miss leaves
  //     'unknown' untouched. isExternalHost excludes *.workers.dev/localhost so the
  //     RPC never fires on staging. Custom-domain hosts are kind:'tenant', so they
  //     NEVER reach the isPlatformHost-gated VÅG 1 role→surface guard (step 4b).
  //     DORMANT until a real external domain is DNS-routed (Zivar ops); demo.corevo.se
  //     still classifies as a .corevo.se subdomain upstream and never reaches here.
  if (tenant.kind === 'unknown' && isExternalHost(host)) {
    const slug = await resolveCustomDomainSlug(host)
    if (slug) tenant = { kind: 'tenant', slug }
  }

  const isPlatformHost = tenant.kind === 'platform'
  const isSuperHost = tenant.kind === 'superadmin'
  const isStaffHost = tenant.kind === 'staff_portal'
  const isTenantHost = tenant.kind === 'tenant'

  // 2. Forward the resolved tenant to Server Components via REQUEST headers
  //    (headers() reads request, not response). Always set-or-delete so a client
  //    can't spoof x-corevo-tenant-slug; middleware is the single source of truth.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-corevo-tenant-kind', tenant.kind)
  if (tenant.kind === 'tenant') requestHeaders.set('x-corevo-tenant-slug', tenant.slug)
  else requestHeaders.delete('x-corevo-tenant-slug')
  if (tenant.kind === 'reserved') requestHeaders.set('x-corevo-reserved-subdomain', tenant.subdomain)
  else requestHeaders.delete('x-corevo-reserved-subdomain')

  // 2b. Preview-rutterna (/salong-preview/<slug>/…) renderar en tenants storefront ur
  //     SLUG i URL:en på admin-hosten. Sätt samma x-corevo-tenant-slug som en riktig
  //     tenant-host hade fått, så själv-hämtande storefront-komponenter (LocationHours,
  //     modulsektioner) resolvar RÄTT tenant via currentTenant() inne i previewen.
  //     Ofarligt att sätta för oinloggade: rutten själv-gatar med requirePlatformAdmin
  //     och headern gäller bara denna request (vars path ÄR preview-rutten).
  const previewSlug = /^\/salong-preview\/([a-z0-9-]+)/.exec(path)?.[1]
  if (previewSlug) requestHeaders.set('x-corevo-tenant-slug', previewSlug)

  // 3. Refresh the Supabase auth session (SSR). Returns a response carrying any
  //    rotated auth cookies + the resolved user. Those cookies MUST be carried
  //    onto whatever we return (pass-through, rewrite, or redirect) or the session
  //    regresses on the very requests that redirect/rewrite.
  const { response, user } = await updateSession(request, requestHeaders)

  const carryAuthCookies = (res: NextResponse): NextResponse => {
    for (const c of response.cookies.getAll()) res.cookies.set(c)
    return res
  }
  const persistOverride = (res: NextResponse): NextResponse => {
    if (qsTenant && tenant.kind === 'tenant') {
      res.cookies.set(TENANT_OVERRIDE_COOKIE, tenant.slug, { path: '/', sameSite: 'lax' })
    }
    return res
  }
  const bounce = (to: string): NextResponse =>
    persistOverride(carryAuthCookies(NextResponse.redirect(new URL(to, request.url))))
  // goal-27 — cross-door redirect: same path, DIFFERENT host. Force https — these are
  // production *.corevo.se hosts behind Cloudflare. Setting .host on a bare hostname
  // clears the port; .port = '' is belt-and-suspenders. Cookies are host-locked, so
  // carrying them is harmless (the destination door can't read them → fresh login).
  const crossHostBounce = (targetHost: string, to: string): NextResponse => {
    const dest = new URL(to, request.url)
    dest.protocol = 'https:'
    dest.host = targetHost
    dest.port = ''
    return persistOverride(carryAuthCookies(NextResponse.redirect(dest)))
  }

  // 3b. Sajtbyggare preview/spike routes (flag-gated) — the S2-editorns same-origin
  //     iframe-mål. De renderar en tenants PUBLIKA storefront ur SLUG i URL:en (värd-
  //     oberoende), så de måste serveras på VILKEN host editorn än kör på (inkl. admin-
  //     dörrarna booking/superbooking). Utan detta bouncar back-office-routern nedan dem
  //     (de är inte /admin-paths) → editorns preview-iframe 307:ar. Rutterna själv-gatar
  //     (sajtbyggareEnabled() + notFound() + slug-lookup); flagga AV → fall-igenom fyrar
  //     ej → noll yta (oförändrat). Före host-routningen så bouncen aldrig hinner före.
  if (sajtbyggareEnabled() && isPrefix(path, ['/sajtbyggare-spike'])) {
    response.headers.set('x-corevo-tenant-kind', tenant.kind)
    if (tenant.kind === 'tenant') response.headers.set('x-corevo-tenant-slug', tenant.slug)
    return persistOverride(response)
  }

  // 3c. Super-admin live storefront preview (Sida-fliken på /salonger/[id]) — same-origin
  //     iframe-mål. Renderar en tenants PUBLIKA storefront ur SLUG i URL:en (värd-
  //     oberoende), så den måste serveras på admin-dörren (superbooking) utan att
  //     back-office-routern nedan bouncar den till `/` (den är ingen /salonger-path).
  //     EJ flagg-gatad (riktig admin-funktion, ej spike); rutten själv-gatar med
  //     requirePlatformAdmin() → en oinloggad get 307:ar ändå till /login på sidnivå.
  //     Före host-routningen så bouncen aldrig hinner före.
  if (isPrefix(path, ['/salong-preview'])) {
    response.headers.set('x-corevo-tenant-kind', tenant.kind)
    return persistOverride(response)
  }

  // 4. G12 host routing. Decide rewrite/redirect BEFORE the auth gate, and gate
  //    against the EFFECTIVE (post-rewrite) path.
  let effectivePath = path
  let rewriteTo: string | null = null

  // Local dev comfort: bare localhost has no tenant, so `/` would otherwise fall
  // into the public storefront layout and 404. Treat it as the salon admin start.
  if (previewHost && tenant.kind === 'root' && path === '/') {
    effectivePath = '/admin'
    rewriteTo = '/admin'
  }

  // goal-27 — production 3-door split (REAL *.corevo.se only). The pure
  // decideBackofficeRoute owns the policy; this just translates its intent. Gated to
  // !previewHost so dev/*.localhost keeps the G12 single-host back-office (the else-if
  // below). Cross-door surfaces redirect to the owning host; the rest bounce home.
  if (!previewHost && (isSuperHost || isPlatformHost || isStaffHost)) {
    const decision = decideBackofficeRoute({
      hostKind: tenant.kind as BackofficeHostKind,
      path,
      hosts: { superadmin: getSuperadminHost(), platform: getPlatformHost(), staff: getStaffHost() },
    })
    if (decision.action === 'redirectHost') return crossHostBounce(decision.host, decision.to)
    if (decision.action === 'redirect') return bounce(decision.to)
    if (decision.action === 'rewrite') {
      effectivePath = decision.to
      rewriteTo = decision.to
    }
    // 'pass' → fall through to the cheap auth gate on the effective path.
  } else if (isPlatformHost) {
    // Preview/dev (booking.localhost): keep the G12 single-host back-office.
    // Never expose the internal `/platform` prefix — bounce it to the clean root.
    if (isPrefix(path, [DASHBOARD_ROUTE])) return bounce('/')
    // `/` serves the platform dashboard (rewrite; the URL stays `/`).
    if (path === '/') {
      effectivePath = DASHBOARD_ROUTE
      rewriteTo = DASHBOARD_ROUTE
    }
  } else if (isTenantHost) {
    // The storefront host never serves the back-office — bounce those to `/`.
    if (isPrefix(path, BACKOFFICE_PREFIXES)) return bounce('/')
  }

  // 4b. Role→surface guard (app_metadata ONLY — role-LEVEL authz stays in the DAL,
  //     see lib/supabase/middleware.ts). The route-group layouts fence by level
  //     (requirePortal) which lets a platform_admin short-circuit INTO the
  //     tenant-scoped back-office and silently render/mutate the account's anchored
  //     tenant. Close that here without a role DB-read: a platform_admin on a
  //     tenant-scoped surface is bounced to the platform dashboard. Reads the
  //     verified JWT app_metadata flag the SSR session already resolved (never
  //     client-spoofable). Only fires on the platform host; tenant hosts already
  //     bounced every back-office path above.
  if (user && isPlatformHost && isPrefix(effectivePath, TENANT_SCOPED_BACKOFFICE)) {
    const isPlatformAdmin =
      (user.app_metadata as { platform_admin?: boolean } | undefined)?.platform_admin === true
    if (isPlatformAdmin) {
      // goal-27 — in the production split, booking `/` redirects to `/admin`, so the
      // old bounce('/') here formed a `/` ⇄ `/admin` loop (ERR_TOO_MANY_REDIRECTS) for
      // a platform_admin holding a stale booking session. Send them to THEIR door
      // (superbooking) instead — host-locked cookies mean they re-login there. On
      // preview hosts booking `/` still SERVES the dashboard (rewrite, not redirect),
      // so bounce('/') stays loop-free and correct there.
      return previewHost ? bounce('/') : crossHostBounce(getSuperadminHost(), '/')
    }
  }

  // 5. Cheap auth gate on the effective path (role-level authz stays in the DAL).
  if (!user && isPrefix(effectivePath, PROTECTED_PREFIXES)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path) // the browser-visible path, not the rewrite
    if (qsTenant) loginUrl.searchParams.set('tenant', qsTenant)
    return bounce(loginUrl.toString())
  }

  // 6. Apply the rewrite (forward request headers + carry rotated auth cookies).
  if (rewriteTo) {
    const rewritten = NextResponse.rewrite(new URL(rewriteTo, request.url), {
      request: { headers: requestHeaders },
    })
    carryAuthCookies(rewritten)
    rewritten.headers.set('x-corevo-tenant-kind', tenant.kind)
    return persistOverride(rewritten)
  }

  // 7. Pass-through: mirror tenant headers on the response for observability.
  response.headers.set('x-corevo-tenant-kind', tenant.kind)
  if (tenant.kind === 'tenant') response.headers.set('x-corevo-tenant-slug', tenant.slug)
  if (tenant.kind === 'reserved') response.headers.set('x-corevo-reserved-subdomain', tenant.subdomain)
  return persistOverride(response)
}

export const config = {
  // Run on everything except static assets and image optimization.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
