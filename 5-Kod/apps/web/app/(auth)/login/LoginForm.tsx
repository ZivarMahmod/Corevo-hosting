'use client'

import { useActionState } from 'react'
import { signIn, type SignInState } from '../actions'

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signIn, {})

  return (
    <form action={formAction} className="auth-form">
      <h1>Logga in</h1>
      <input type="hidden" name="next" value={next} />

      <label className="auth-field">
        <span>E-post</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <label className="auth-field">
        <span>Lösenord</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>

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
