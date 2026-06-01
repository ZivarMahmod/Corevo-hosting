'use client'

import { useActionState } from 'react'
import { eraseMyAccount, type EraseState } from '@/lib/gdpr/actions'

// GDPR self-service (G10): export own data + erase account. Lives under the kund
// profile. Export is a plain authenticated download; erase requires typing RADERA.
export function GdprControls() {
  const [state, formAction, pending] = useActionState<EraseState, FormData>(eraseMyAccount, {})

  return (
    <div className="portal-section" style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
      <h2>Dina uppgifter</h2>
      <p className="prose">
        Du kan ladda ner all data vi har om dig, eller radera ditt konto permanent (rätten att bli glömd).
      </p>

      <p style={{ margin: '1rem 0' }}>
        <a className="btn-primary" href="/api/gdpr/export">
          Exportera mina uppgifter (JSON)
        </a>
      </p>

      <form action={formAction} className="auth-form">
        <label className="auth-field">
          <span>Radera mitt konto — skriv RADERA för att bekräfta</span>
          <input name="confirm" type="text" autoComplete="off" placeholder="RADERA" />
        </label>
        <p className="prose" style={{ fontSize: '0.85rem', color: '#a33' }}>
          Detta är permanent. Bokningshistoriken anonymiseras (sparas avidentifierad för salongens
          bokföring), och dina personuppgifter raderas.
        </p>
        {state.error ? (
          <p className="auth-error" role="alert">
            {state.error}
          </p>
        ) : null}
        <button type="submit" className="btn-primary" disabled={pending} style={{ background: '#a33' }}>
          {pending ? 'Raderar…' : 'Radera mitt konto'}
        </button>
      </form>
    </div>
  )
}
