'use client'

import { useEffect } from 'react'

/**
 * Group-level error boundary for the (kund) route group. Backstops the public
 * /registrera view (which has no portal chrome of its own) so a failed
 * currentTenant()/getCurrentUser() in that server component shows a friendly
 * retry instead of bubbling to nothing. The /konto subtree has its own, nearer
 * boundary (konto/error.tsx) which takes precedence there. notFound() still
 * routes to not-found.tsx, so 404 behaviour is unaffected.
 */
export default function KundError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="auth-main">
      <div className="auth-card">
        <h1>Något gick fel</h1>
        <p className="auth-error" role="alert">
          Sidan kunde inte laddas just nu. Försök igen om en liten stund.
        </p>
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Försök igen
        </button>
      </div>
    </main>
  )
}
