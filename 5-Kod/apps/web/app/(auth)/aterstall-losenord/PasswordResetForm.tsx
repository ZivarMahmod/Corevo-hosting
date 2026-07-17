'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Phase = 'loading' | 'ready' | 'saving' | 'done' | 'invalid'

export function PasswordResetForm() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const access = hash.get('access_token')
    const refresh = hash.get('refresh_token')
    const recovery = hash.get('type') === 'recovery'

    const subscription = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPhase('ready')
    })

    const openRecovery = async () => {
      if (!access || !refresh || !recovery) return
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: access,
        refresh_token: refresh,
      })
      if (sessionError) {
        setPhase('invalid')
        return
      }
      window.history.replaceState(null, '', window.location.pathname)
      setPhase('ready')
    }
    void openRecovery()

    const timeout = window.setTimeout(() => {
      setPhase((current) => (current === 'loading' ? 'invalid' : current))
    }, 2500)

    return () => {
      window.clearTimeout(timeout)
      subscription.data.subscription.unsubscribe()
    }
  }, [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password') ?? '')
    const repeated = String(formData.get('password2') ?? '')
    if (password.length < 8) {
      setError('Lösenordet behöver minst 8 tecken.')
      return
    }
    if (password !== repeated) {
      setError('Lösenorden matchar inte.')
      return
    }

    setError(null)
    setPhase('saving')
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError('Lösenordet kunde inte sparas. Begär en ny länk och försök igen.')
      setPhase('ready')
      return
    }
    await supabase.auth.signOut()
    setPhase('done')
  }

  if (phase === 'loading') {
    return <div className="auth-form"><p className="auth-sub">Öppnar den säkra länken…</p></div>
  }

  if (phase === 'invalid') {
    return (
      <div className="auth-form">
        <h1>Länken kan inte användas</h1>
        <p className="auth-sub">Den har gått ut, redan använts eller saknar en giltig återställningssession.</p>
        <p className="auth-links"><Link href="/glomt-losenord">Begär en ny länk</Link></p>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="auth-form">
        <h1>Lösenordet är sparat</h1>
        <p className="auth-sub">Logga in igen med ditt nya lösenord.</p>
        <p className="auth-links"><Link href="/login">Logga in</Link></p>
      </div>
    )
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <h1>Välj nytt lösenord</h1>
      <label className="auth-field">
        <span>Nytt lösenord</span>
        <input name="password" type="password" minLength={8} autoComplete="new-password" required autoFocus />
      </label>
      <label className="auth-field">
        <span>Upprepa lösenordet</span>
        <input name="password2" type="password" minLength={8} autoComplete="new-password" required />
      </label>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      <button type="submit" className="btn-primary" disabled={phase === 'saving'}>
        {phase === 'saving' ? 'Sparar…' : 'Spara nytt lösenord'}
      </button>
    </form>
  )
}
