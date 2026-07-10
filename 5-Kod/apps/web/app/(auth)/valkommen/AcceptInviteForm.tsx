'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Phase = 'loading' | 'ready' | 'saving' | 'done' | 'invalid'

/**
 * Tar emot inbjudnings-tokens ur URL-hashen, loggar in sessionen och låter
 * medarbetaren välja sitt lösenord. Full sidladdning till '/' efteråt så
 * middlewaren/dörr-logiken skickar till rätt portal (staff → /personal,
 * salon_admin → /admin) med färska cookies.
 */
export function AcceptInviteForm() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const supabase = createClient()
      const hash = new URLSearchParams(window.location.hash.slice(1))
      const access = hash.get('access_token')
      const refresh = hash.get('refresh_token')
      if (access && refresh) {
        const { error: se } = await supabase.auth.setSession({
          access_token: access,
          refresh_token: refresh,
        })
        if (se) {
          setPhase('invalid')
          return
        }
        // Tokens ur adressfältet direkt — ska inte ligga i historik/bokmärke.
        window.history.replaceState(null, '', window.location.pathname)
        setPhase('ready')
        return
      }
      // Ingen hash — kanske redan inloggad (t.ex. sidladdning efter setSession).
      const { data } = await supabase.auth.getUser()
      setPhase(data.user ? 'ready' : 'invalid')
    }
    void run()
  }, [])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const pw = String(fd.get('password') ?? '')
    const pw2 = String(fd.get('password2') ?? '')
    if (pw.length < 8) {
      setError('Lösenordet behöver minst 8 tecken.')
      return
    }
    if (pw !== pw2) {
      setError('Lösenorden matchar inte.')
      return
    }
    setError(null)
    setPhase('saving')
    const supabase = createClient()
    const { error: ue } = await supabase.auth.updateUser({ password: pw })
    if (ue) {
      setError('Kunde inte spara lösenordet — försök igen.')
      setPhase('ready')
      return
    }
    setPhase('done')
    // Full navigering (inte router.push) så middlewaren ser sessionen och
    // dörr-logiken skickar till rätt portal.
    window.location.href = '/'
  }

  if (phase === 'loading') {
    return (
      <div className="auth-form">
        <p className="auth-sub">Öppnar din inbjudan…</p>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="auth-form">
        <p className="auth-sub">
          <strong>Länken har gått ut eller är redan använd.</strong>
        </p>
        <p className="auth-sub">
          Be den som bjöd in dig att skicka en ny inbjudan, så kommer ett färskt mail.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <p className="auth-sub">
        <strong>Välkommen!</strong> Välj ditt lösenord så är kontot klart.
      </p>
      <label className="auth-field">
        Nytt lösenord
        <input type="password" name="password" required minLength={8} autoComplete="new-password" autoFocus />
      </label>
      <label className="auth-field">
        Upprepa lösenordet
        <input type="password" name="password2" required minLength={8} autoComplete="new-password" />
      </label>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary" disabled={phase === 'saving' || phase === 'done'}>
        {phase === 'saving' || phase === 'done' ? 'Sparar…' : 'Spara och logga in'}
      </button>
    </form>
  )
}
