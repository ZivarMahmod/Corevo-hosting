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
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getTenantFromHost } from '@/lib/tenant'
import { PROTECTED_PREFIXES } from '@/lib/auth/roles'

// Internal dashboard route (file lives at app/(platform)/platform); served at `/`.
const DASHBOARD_ROUTE = '/platform'
// Back-office surfaces that must NOT be served on a tenant (storefront) host.
const BACKOFFICE_PREFIXES = ['/admin', '/personal', '/platform', '/salonger', '/fakturering']

const isPrefix = (path: string, prefixes: readonly string[]): boolean =>
  prefixes.some((p) => path === p || path.startsWith(p + '/'))

export async function middleware(request: NextRequest) {
  const url = request.nextUrl
  const path = url.pathname

  // 1. Resolve tenant from Host (host → slug) with dev/preview fallbacks
  //    (?tenant= / /t/<slug>). Data isolation is enforced by RLS + tenant_id,
  //    NEVER by this header (ADR 01 §2).
  let tenant = getTenantFromHost(request.headers.get('host'), {
    search: url.searchParams,
    pathname: url.pathname,
  })

  // 1b. Preview fallback: hosts without per-tenant subdomains (e.g. *.workers.dev)
  //     persist the ?tenant=<slug> dev override in a cookie. Never overrides a real
  //     subdomain/host match (only fills an otherwise-unresolved tenant).
  const TENANT_OVERRIDE_COOKIE = 'corevo-tenant-override'
  const qsTenant = url.searchParams.get('tenant')
  if (tenant.kind !== 'tenant') {
    const cookieSlug = request.cookies.get(TENANT_OVERRIDE_COOKIE)?.value
    if (cookieSlug) tenant = { kind: 'tenant', slug: cookieSlug }
  }

  const isPlatformHost = tenant.kind === 'platform'
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

  // 4. G12 host routing. Decide rewrite/redirect BEFORE the auth gate, and gate
  //    against the EFFECTIVE (post-rewrite) path.
  let effectivePath = path
  let rewriteTo: string | null = null

  if (isPlatformHost) {
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
