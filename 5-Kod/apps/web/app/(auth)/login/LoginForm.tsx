'use client'

import Link from 'next/link'
import { useActionState, useEffect } from 'react'
import { signIn, type SignInState } from '../actions'

// fix-29 — purge a stale, BROADLY-scoped (.corevo.se) Supabase auth cookie before
// login. Pre-host-split (G12/G13, AUTH_COOKIE_DOMAIN=.corevo.se) the session cookie
// was shared across *.corevo.se; goal-27 made it host-locked (per-door). A browser
// that logged in BEFORE the split still holds the old .corevo.se cookie, which is
// sent to superbooking/booking/minbooking ALONGSIDE the new host-locked one — two
// cookies, same name → the server reads the stale one, the session looks invalid,
// and the user is bounced back to /login on every navigation ("loggar ut hela
// tiden"). We can delete it from JS because @supabase/ssr stores it non-HttpOnly.
// Only the .corevo.se-scoped duplicate is expired; the valid host-locked cookie is
// host-scoped and survives. No-op for a browser that never had the legacy cookie.
function purgeLegacySharedAuthCookie() {
  if (typeof document === 'undefined') return
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = url.replace(/^https?:\/\//, '').split('.')[0]
  if (!ref) return
  const base = `sb-${ref}-auth-token`
  // base + chunk suffixes (.0..).4 — @supabase/ssr splits large tokens into chunks.
  const names = [base, ...Array.from({ length: 5 }, (_, i) => `${base}.${i}`)]
  for (const name of names) {
    document.cookie = `${name}=; Path=/; Domain=.corevo.se; Max-Age=0; SameSite=Lax`
  }
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {})

  // Break the stale-cookie churn loop on the surface the churn always lands on.
  useEffect(() => {
    purgeLegacySharedAuthCookie()
  }, [])

  return (
    <form action={formAction} className="auth-form">
      <h1>Välkommen tillbaka</h1>
      <p className="auth-sub">Logga in med din e-post så tar vi dig till din översikt.</p>
      <input type="hidden" name="next" value={next} />

      <label className="auth-field">
        <span>E-post</span>
        <input name="email" type="email" autoComplete="email" spellCheck={false} required />
      </label>

      <label className="auth-field">
        <span>Lösenord</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>

      <p className="auth-links">
        <Link href="/glomt-losenord">Glömt lösenordet?</Link>
      </p>

      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Loggar in…' : 'Logga in'}
      </button>
    </form>
  )
}
