import styles from '@/components/booking/booking.module.css'

// SSR "laddar"-vy för boka-rutten. Speglar wizard-layouten så att skiftet till
// det riktiga innehållet känns sömlöst (skeleton + dämpade rubriker).
export default function BokaLoading() {
  return (
    <section className="section">
      <div className="section-inner">
        <h1 style={{ opacity: 0.35 }}>Laddar bokning…</h1>
        <p className="prose" style={{ opacity: 0.35 }}>
          Hämtar tjänster och tillgängliga tider.
        </p>

        <div className="wizard" aria-busy="true" aria-live="polite">
          <ol className="wizard-steps">
            {['Tjänst', 'Personal', 'Tid', 'Uppgifter'].map((label, i) => (
              <li key={label} className={i === 0 ? 'active' : ''}>
                <span className="wizard-step-num">{i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <ul className={styles.skeletonList}>
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className={styles.skeletonCard} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
