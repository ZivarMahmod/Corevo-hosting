import styles from '@/components/personal/personal.module.css'

/** Skeleton shown while time-off entries load (server fetch). */
export default function Loading() {
  return (
    <section className="portal-section" aria-busy="true" aria-label="Laddar frånvaro">
      <h1>Frånvaro</h1>
      <p className="prose">
        Registrerad frånvaro blockerar bokningsbara tider direkt i boka-flödet (M3).
      </p>
      <div className={`${styles.skeleton} ${styles.skelRow}`} style={{ height: '5.5rem' }} />
      <div className={`${styles.skeleton} ${styles.skelRow}`} />
      <div className={`${styles.skeleton} ${styles.skelRow}`} />
    </section>
  )
}
