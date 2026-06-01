'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import styles from '@/components/brand/brand.module.css'

/** Storefront error boundary. Catches render/data errors in (public) pages.
 *  (Layout-level unknown-tenant resolves via notFound(), which boundaries
 *  correctly ignore.) Ink-red .auth-error box + a real retry via reset(). */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface for observability; no PII.
    console.error('storefront error', error)
  }, [error])

  return (
    // A <div>, not <main>: this renders inside (public)/layout.tsx's <main>,
    // so a nested <main> would be invalid + a duplicate landmark.
    <div className={styles.errorMain}>
      <h1 className={styles.errorTitle}>Något gick fel</h1>
      <p className="auth-error">
        Vi kunde inte ladda sidan just nu. Försök igen om en liten stund.
      </p>
      <div className={styles.errorActions}>
        <button type="button" className={`btn-accent ${styles.retryBtn}`} onClick={() => reset()}>
          Försök igen
        </button>
        <Link href="/" className="btn-primary">
          Till startsidan
        </Link>
      </div>
    </div>
  )
}
