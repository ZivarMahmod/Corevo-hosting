// FROZEN after Wave 0 / G02 — tenant resolution + Supabase SSR session refresh.
// Do not edit in a parallel worktree (ADR 01 §2; parallell-exekvering §3 FRYS-list).
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getTenantFromHost } from '@/lib/tenant'

export async function middleware(request: NextRequest) {
  // 1. Resolve tenant from Host header (host → slug) with dev/preview fallbacks
  //    (?tenant= / /t/<slug>). Data isolation is enforced by RLS + tenant_id,
  //    NEVER by this header (ADR 01 §2).
  const url = request.nextUrl
  const tenant = getTenantFromHost(request.headers.get('host'), {
    search: url.searchParams,
    pathname: url.pathname,
  })

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
  //    Returns a response carrying any rotated auth cookies.
  const response = await updateSession(request, requestHeaders)

  // 4. Mirror on the response headers for observability/debugging.
  response.headers.set('x-corevo-tenant-kind', tenant.kind)
  if (tenant.kind === 'tenant') response.headers.set('x-corevo-tenant-slug', tenant.slug)
  if (tenant.kind === 'reserved') response.headers.set('x-corevo-reserved-subdomain', tenant.subdomain)

  return response
}

export const config = {
  // Run on everything except static assets and image optimization.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
