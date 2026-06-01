'use client'

import { useEffect } from 'react'

/**
 * Segment-level error boundary for the salon-admin portal. Catches anything that
 * throws while a page renders or fetches (RLS denial, network, etc.) and shows a
 * friendly Swedish retry instead of a blank crash. `reset()` re-renders the
 * segment, re-running the server fetch.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface for ops/observability; the message itself stays user-friendly.
    console.error('admin segment error', error)
  }, [error])

  return (
    <section className="portal-section">
      <h1>Något gick fel</h1>
      <p className="auth-error" role="alert" style={{ maxWidth: '32rem' }}>
        Sidan kunde inte laddas just nu. Kontrollera din anslutning och försök igen. Står felet kvar,
        kontakta Corevo.
      </p>
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Försök igen
        </button>
      </div>
    </section>
  )
}
