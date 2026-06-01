'use client'

import styles from './platform.module.css'

/**
 * Shared error UI for platform route segments. Next.js error boundaries are
 * client components and receive { error, reset }. `reset` re-renders the segment
 * (re-runs the failed server fetch) — a real retry, no dead button.
 */
export function PlatformError({
  title = 'Kunde inte ladda',
  message = 'Något gick fel när data hämtades. Försök igen.',
  reset,
}: {
  title?: string
  message?: string
  reset: () => void
}) {
  return (
    <section className="portal-section">
      <div className={styles.errorBox} role="alert">
        <p className={styles.errorTitle}>{title}</p>
        <p className={styles.errorMsg}>{message}</p>
        <div className={styles.actions}>
          <button type="button" className="btn-primary" onClick={() => reset()}>
            Försök igen
          </button>
        </div>
      </div>
    </section>
  )
}
