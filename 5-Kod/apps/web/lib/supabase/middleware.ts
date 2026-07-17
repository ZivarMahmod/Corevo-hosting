import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase } from '@corevo/auth'

/**
 * Supabase SSR session refresh for middleware (canonical @supabase/ssr pattern).
 * Optionally forwards extra request headers (e.g. the resolved tenant slug) to
 * Server Components via headers(). Refreshed auth cookies are re-synced onto the
 * forwarded request so the SSR session is never regressed.
 * Do not run logic between createServerSupabase() and getClaims().
 *
 * PLAN 011 (prestanda): getClaims() i stället för getUser(). Med projektets
 * asymmetriska signeringsnycklar (ECC P-256, aktiva) verifieras JWT:n LOKALT mot
 * cachad JWKS — ingen GoTrue-nätverksrunda per request. getClaims refreshar
 * fortfarande en utgången session (cookie-rotationen sker via setAll-adaptern),
 * så DETTA förblir husets enda refresh-punkt.
 *
 * Returns the rotated `response` plus the resolved `user` (null when signed out)
 * so the middleware can run a cheap authenticated-only gate without a second
 * round-trip. Authorization (role level) stays in the DAL/layouts, not here.
 */
export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  const headers = requestHeaders ?? new Headers(request.headers)
  let response = NextResponse.next({ request: { headers } })

  const supabase = createServerSupabase({
    getAll: () => request.cookies.getAll(),
    setAll: (toSet) => {
      for (const { name, value } of toSet) request.cookies.set(name, value)
      // Rebuild the forwarded Cookie header from the now-updated request cookies
      // so the refreshed session reaches Server Components.
      headers.set('cookie', request.cookies.getAll().map((c) => `${c.name}=${c.value}`).join('; '))
      response = NextResponse.next({ request: { headers } })
      for (const { name, value, options } of toSet) {
        response.cookies.set(name, value, options)
      }
    },
  })

  // Refreshes the auth token if needed and rotates cookies onto `response`.
  // Lokal signaturverifiering (plan 011) — konsumenten läser bara id + app_metadata.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const user = claims?.sub
    ? {
        id: claims.sub,
        app_metadata: (claims.app_metadata ?? {}) as Record<string, unknown>,
      }
    : null

  return { response, user }
}
