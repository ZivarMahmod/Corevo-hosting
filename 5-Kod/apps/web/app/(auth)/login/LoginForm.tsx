'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { signIn, type SignInState } from '../actions'
import { isCustomerClaimPath } from '@/lib/kund/customer-claim'

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
  const [showPassword, setShowPassword] = useState(false)

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
        <span className="auth-input-wrap">
          <input
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="auth-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Dölj lösenordet' : 'Visa lösenordet'}
            title={showPassword ? 'Dölj lösenordet' : 'Visa lösenordet'}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </span>
      </label>

      <p className="auth-links">
        <Link href="/glomt-losenord">Glömt lösenordet?</Link>
      </p>

      {isCustomerClaimPath(next) ? (
        <p className="auth-links">
          Ny kund? <Link href={`/registrera?next=${encodeURIComponent(next)}`}>Skapa konto från din säkra länk</Link>
        </p>
      ) : null}

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
