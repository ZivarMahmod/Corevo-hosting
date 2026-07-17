'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function PasswordResetRequestForm() {
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    try {
      const supabase = createClient()

      // Browserns origin undviker Host-header-baserade resetlänkar. Alla riktiga
      // inloggningsdörrar måste samtidigt finnas i Supabase Redirect URLs.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/aterstall-losenord`,
      })
    } finally {
      // Samma svar även när leveransen eller transporten nekades. Det förhindrar
      // kontoenumerering och lämnar aldrig knappen permanent låst vid nätverksfel.
      setSubmitted(true)
      setPending(false)
    }
  }

  if (submitted) {
    return (
      <div className="auth-form">
        <h1>Kontrollera din e-post</h1>
        <p className="auth-sub">
          Om adressen finns hos oss skickas ett mejl med en säker länk för att välja
          ett nytt lösenord.
        </p>
        <p className="auth-links">
          <Link href="/login">Tillbaka till inloggningen</Link>
        </p>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Återställ lösenord</h1>
      <p className="auth-sub">Ange e-postadressen som du använder för att logga in.</p>
      <label className="auth-field">
        <span>E-post</span>
        <input name="email" type="email" autoComplete="email" spellCheck={false} required />
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? 'Skickar…' : 'Skicka återställningslänk'}
      </button>
      <p className="auth-links">
        <Link href="/login">Tillbaka till inloggningen</Link>
      </p>
    </form>
  )
}
