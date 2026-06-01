'use client'

import styles from '@/components/personal/personal.module.css'

/** Error boundary for the today/calendar view — ink-red box + retry. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="portal-section">
      <h1>Idag</h1>
      <p className="auth-error" role="alert">
        Kunde inte ladda dagens vy. Kontrollera din anslutning och försök igen.
      </p>
      <div className={styles.actions} style={{ marginTop: '0.75rem' }}>
        <button type="button" className={styles.btn} onClick={() => reset()}>
          Försök igen
        </button>
      </div>
    </section>
  )
}
