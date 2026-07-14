'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, Callout, Button, Field, inputStyle } from '@/components/portal/ui'

/** L3 C-04 — konto och säkerhet, byggt på Supabase Auth:s RIKTIGA API:
 *   · lösenordsbyte   → supabase.auth.updateUser({ password })
 *   · andra enheter   → supabase.auth.signOut({ scope: 'others' })
 *
 *  AKTIVA SESSIONER: Supabase Auth exponerar INGEN lista över en användares
 *  sessioner för klienten (auth-js har varken listSessions eller ett sessions-API;
 *  admin-API:t kan bara logga ut, inte räkna upp). Vi visar därför bara den enhet
 *  vi FAKTISKT vet något om — den här — och säger det rakt ut. Ingen fejkad lista. */
export function AccountSecurity({
  email,
  lastSignInAt,
}: {
  email: string | null
  lastSignInAt: string | null
}) {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null)

  const lastSignIn = lastSignInAt
    ? new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long', timeStyle: 'short' }).format(
        new Date(lastSignInAt),
      )
    : null

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (!email) {
      setMsg({ tone: 'warning', text: 'Kontot saknar e-post. Kontakta Corevo.' })
      return
    }
    if (password.length < 8) {
      setMsg({ tone: 'warning', text: 'Lösenordet måste vara minst 8 tecken.' })
      return
    }
    if (password !== repeat) {
      setMsg({ tone: 'warning', text: 'De två lösenorden är inte lika.' })
      return
    }
    setBusy(true)
    const supabase = createClient()

    // ÅTERAUTENTISERING (Codex-granskning, ALLVARLIG). `updateUser({password})` litar
    // ENBART på sessionen. En kapad session — stulen cookie, glömd inloggning på en
    // delad iPad i receptionen — kunde alltså sätta ett nytt lösenord och göra
    // övertagandet permanent, utan att någonsin ha känt till det gamla.
    // Vi kräver därför det nuvarande lösenordet och verifierar det mot Auth FÖRE bytet.
    const { error: reauth } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    })
    if (reauth) {
      setBusy(false)
      setMsg({ tone: 'warning', text: 'Fel nuvarande lösenord.' })
      return
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setBusy(false)
      setMsg({ tone: 'warning', text: 'Lösenordet kunde inte bytas. Försök igen.' })
      return
    }

    // Ett lösenordsbyte är ofta ETT SVAR på ett intrång. Då ska angriparens session dö
    // med det gamla lösenordet — annars sitter hen kvar. Den här enheten är kvar
    // inloggad; alla andra kastas ut.
    await supabase.auth.signOut({ scope: 'others' })

    setBusy(false)
    setCurrent('')
    setPassword('')
    setRepeat('')
    setMsg({
      tone: 'success',
      text: 'Lösenordet är bytt. Alla andra enheter har loggats ut.',
    })
    router.refresh()
  }

  async function signOutOthers() {
    setMsg(null)
    setBusy(true)
    const { error } = await createClient().auth.signOut({ scope: 'others' })
    setBusy(false)
    setMsg(
      error
        ? { tone: 'warning', text: 'Kunde inte logga ut andra enheter. Försök igen.' }
        : { tone: 'success', text: 'Alla andra enheter är utloggade. Den här är kvar.' },
    )
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {msg ? (
        <Callout tone={msg.tone} icon={msg.tone === 'success' ? 'checkCircle' : 'alert'}>
          {msg.text}
        </Callout>
      ) : null}

      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 className="h2" style={{ margin: 0 }}>
          Byt lösenord
        </h2>
        <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {/* Nuvarande lösenord = vakten mot en kapad session. Utan det räcker en stulen
              cookie för att låsa ute den riktiga ägaren för gott. */}
          <Field label="Nuvarande lösenord">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Nytt lösenord">
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Upprepa lösenordet">
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Sparar …' : 'Spara lösenord'}
            </Button>
          </div>
        </form>
      </Card>

      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 className="h2" style={{ margin: 0 }}>
          Inloggade enheter
        </h2>
        <p className="body" style={{ margin: 0 }}>
          Du är inloggad som <strong>{email ?? 'okänd användare'}</strong> på den här enheten
          {lastSignIn ? ` sedan ${lastSignIn}` : ''}. Vi kan inte visa en lista över dina övriga
          enheter — inloggningstjänsten lämnar inte ut den. Knappen loggar ut alla andra.
        </p>
        <div>
          <Button variant="subtle" onClick={signOutOthers} disabled={busy}>
            Logga ut andra enheter
          </Button>
        </div>
      </Card>
    </div>
  )
}
