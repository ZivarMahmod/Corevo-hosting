'use client'

import { useEffect } from 'react'
import styles from '@/components/kund/kund.module.css'

/**
 * Error boundary for the whole /konto/* subtree. Renders inside the PortalShell
 * chrome (the boundary is below konto/layout.tsx), so the header stays. Catches
 * data-read failures (e.g. getMyBookings) that would otherwise bubble to nothing.
 * notFound() is NOT caught here — it routes to not-found.tsx — so the booking
 * detail page's own-only 404 behaviour is preserved.
 */
export default function KontoError({
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
    <section className="portal-section">
      <h1>Något gick fel</h1>
      <p className="auth-error" role="alert">
        Vi kunde inte hämta dina uppgifter just nu. Försök igen om en liten stund.
      </p>
      <div className={styles.actions}>
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Försök igen
        </button>
      </div>
    </section>
  )
}
