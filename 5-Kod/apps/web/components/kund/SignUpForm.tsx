'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUpCustomer, type SignUpState } from '@/lib/kund/actions'

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<SignUpState, FormData>(signUpCustomer, {})

  return (
    <form action={formAction} className="auth-form">
      <h1>Skapa konto</h1>

      <label className="auth-field">
        <span>Namn</span>
        <input name="name" type="text" autoComplete="name" required />
      </label>

      <label className="auth-field">
        <span>E-post</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <label className="auth-field">
        <span>Telefon</span>
        <input name="phone" type="tel" autoComplete="tel" required />
      </label>

      <label className="auth-field">
        <span>Lösenord</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>

      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Skapar konto…' : 'Skapa konto'}
      </button>

      <p className="auth-links">
        Har du redan ett konto? <Link href="/login">Logga in</Link>
      </p>
    </form>
  )
}
