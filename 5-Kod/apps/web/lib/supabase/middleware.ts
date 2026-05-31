import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabase } from '@corevo/auth'

/**
 * Supabase SSR session refresh for middleware (canonical @supabase/ssr pattern).
 * Optionally forwards extra request headers (e.g. the resolved tenant slug) to
 * Server Components via headers(). Refreshed auth cookies are re-synced onto the
 * forwarded request so the SSR session is never regressed.
 * Do not run logic between createServerSupabase() and getUser().
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
  await supabase.auth.getUser()

  return response
}
