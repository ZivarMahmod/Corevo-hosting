import styles from '@/components/personal/personal.module.css'

/** Skeleton shown while working hours load (server fetch). */
export default function Loading() {
  return (
    <section className="portal-section" aria-busy="true" aria-label="Laddar arbetstider">
      <h1>Arbetstider</h1>
      <p className="prose">
        Dina veckovisa arbetstider styr vilka tider kunder kan boka (M3). Ändringar slår igenom
        direkt.
      </p>
      <div className={`${styles.skeleton} ${styles.skelRow}`} style={{ height: '5.5rem' }} />
      <div className={`${styles.skeleton} ${styles.skelRow}`} />
      <div className={`${styles.skeleton} ${styles.skelRow}`} />
    </section>
  )
}
