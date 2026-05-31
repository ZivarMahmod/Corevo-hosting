// Tenant resolution + Supabase SSR session refresh (frozen since Wave 0 / G02)
// plus a cheap authenticated-only gate added in the auth-foundation goal (G045).
// The tenant-resolution + cookie-forwarding core below is unchanged; only the
// post-session redirect gate is new. Role-level authorization lives in the
// route-group layouts + server actions (DAL), never in edge middleware.
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getTenantFromHost } from '@/lib/tenant'
import { PROTECTED_PREFIXES } from '@/lib/auth/roles'

export async function middleware(request: NextRequest) {
  // 1. Resolve tenant from Host header (host → slug) with dev/preview fallbacks
  //    (?tenant= / /t/<slug>). Data isolation is enforced by RLS + tenant_id,
  //    NEVER by this header (ADR 01 §2).
  const url = request.nextUrl
  let tenant = getTenantFromHost(request.headers.get('host'), {
    search: url.searchParams,
    pathname: url.pathname,
  })

  // 1b. Preview fallback: hosts without per-tenant subdomains (e.g. *.workers.dev)
  //     can't resolve a tenant from the host, so we persist the ?tenant=<slug> dev
  //     override in a cookie and reuse it on internal navigations. Never overrides
  //     a real subdomain/host match (only fills an otherwise-unresolved tenant).
  const TENANT_OVERRIDE_COOKIE = 'corevo-tenant-override'
  const qsTenant = url.searchParams.get('tenant')
  if (tenant.kind !== 'tenant') {
    const cookieSlug = request.cookies.get(TENANT_OVERRIDE_COOKIE)?.value
    if (cookieSlug) tenant = { kind: 'tenant', slug: cookieSlug }
  }
  const persistOverride = (res: NextResponse) => {
    if (qsTenant && tenant.kind === 'tenant') {
      res.cookies.set(TENANT_OVERRIDE_COOKIE, tenant.slug, { path: '/', sameSite: 'lax' })
    }
  }

  // 2. Forward the resolved tenant to Server Components via REQUEST headers
  //    (headers() reads request, not response). Always set-or-delete so a client
  //    can't spoof x-corevo-tenant-slug; middleware is the single source of truth.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-corevo-tenant-kind', tenant.kind)
  if (tenant.kind === 'tenant') requestHeaders.set('x-corevo-tenant-slug', tenant.slug)
  else requestHeaders.delete('x-corevo-tenant-slug')
  if (tenant.kind === 'reserved') requestHeaders.set('x-corevo-reserved-subdomain', tenant.subdomain)
  else requestHeaders.delete('x-corevo-reserved-subdomain')

  // 3. Refresh the Supabase auth session (SSR) and forward the headers downstream.
  //    Returns a response carrying any rotated auth cookies + the resolved user.
  const { response, user } = await updateSession(request, requestHeaders)

  // 3b. Cheap auth gate: protected portals require a session. (Role-level checks
  //     happen in the route-group layouts + server actions, not here.)
  const path = url.pathname
  if (!user && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path)
    if (qsTenant) loginUrl.searchParams.set('tenant', qsTenant) // keep ?tenant= override
    const redirectRes = NextResponse.redirect(loginUrl)
    persistOverride(redirectRes)
    return redirectRes
  }

  // 4. Mirror on the response headers for observability/debugging.
  response.headers.set('x-corevo-tenant-kind', tenant.kind)
  if (tenant.kind === 'tenant') response.headers.set('x-corevo-tenant-slug', tenant.slug)
  if (tenant.kind === 'reserved') response.headers.set('x-corevo-reserved-subdomain', tenant.subdomain)

  persistOverride(response)
  return response
}

export const config = {
  // Run on everything except static assets and image optimization.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
