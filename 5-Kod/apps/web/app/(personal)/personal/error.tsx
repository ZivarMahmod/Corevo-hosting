'use client'

import styles from '@/components/personal/personal.module.css'

/** Error boundary for the selected calendar day. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="portal-section">
      <h1>Kalender</h1>
      <p className="auth-error" role="alert">
        Kunde inte ladda kalendern. Kontrollera din anslutning och försök igen.
      </p>
      <div className={styles.actions} style={{ marginTop: '0.75rem' }}>
        <button type="button" className={styles.btn} onClick={() => reset()}>
          Försök igen
        </button>
      </div>
    </section>
  )
}
