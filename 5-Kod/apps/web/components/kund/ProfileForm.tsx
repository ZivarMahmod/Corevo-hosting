'use client'

import { useActionState } from 'react'
import { updateProfile, type ProfileState } from '@/lib/kund/actions'

export function ProfileForm({
  email,
  name,
  phone,
}: {
  email: string | null
  name: string
  phone: string
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(updateProfile, {})

  return (
    <form action={formAction} className="auth-form">
      <label className="auth-field">
        <span>Namn</span>
        <input name="name" type="text" autoComplete="name" defaultValue={name} required />
      </label>

      <label className="auth-field">
        <span>Telefon</span>
        <input name="phone" type="tel" autoComplete="tel" defaultValue={phone} />
      </label>

      <label className="auth-field">
        <span>E-post</span>
        <input type="email" value={email ?? ''} readOnly disabled />
      </label>

      {state.error ? (
        <p className="auth-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="prose" role="status">{state.success}</p> : null}

      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Sparar…' : 'Spara'}
      </button>
    </form>
  )
}
