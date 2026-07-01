'use client'

import { useActionState } from 'react'
import { updatePassword, type UpdatePasswordState } from '../actions'

export function PasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<UpdatePasswordState, FormData>(
    updatePassword,
    {},
  )

  return (
    <form action={formAction} className="auth-form">
      <h1>Välj lösenord</h1>
      {email ? (
        <p style={{ margin: '0 0 8px', fontSize: 14 }}>
          Kontot <strong>{email}</strong> är aktiverat — välj ett lösenord för att logga in
          framöver.
        </p>
      ) : null}

      <label className="auth-field">
        <span>Nytt lösenord (minst 8 tecken)</span>
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>

      <label className="auth-field">
        <span>Upprepa lösenordet</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>

      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Sparar…' : 'Spara och fortsätt'}
      </button>
    </form>
  )
}
