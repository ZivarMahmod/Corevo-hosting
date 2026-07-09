'use client'

import { useEffect } from 'react'

/** Error boundary för fristående /boka (vattentät-audit P1-5). Utan denna
 *  eskalerar ett kast hela vägen till global-error.tsx som ERSÄTTER dokumentet
 *  och slänger allt kunden skrivit. Här: behåll dokumentet, ge en riktig retry.
 *  OBS ärlighet: om felet slog EFTER att bokningen skrevs kan den redan finnas —
 *  säg åt kunden att kolla mejlen innan omtag (samma sanning som wizardens
 *  transport-catch). */
export default function BokaError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('boka error', error)
  }, [error])

  return (
    <main className="auth-main">
      <div className="auth-card">
        <div className="auth-form">
          <h1>Något gick fel</h1>
          <p className="auth-sub">
            Vi kunde inte ladda bokningen just nu. Om du precis försökte boka: kolla din e-post —
            bokningen kan redan ha gått igenom.
          </p>
          <button type="button" className="btn-primary" onClick={() => reset()}>
            Försök igen
          </button>
        </div>
      </div>
    </main>
  )
}
