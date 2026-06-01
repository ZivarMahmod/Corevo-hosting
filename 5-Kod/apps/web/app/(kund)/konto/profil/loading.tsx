import styles from '@/components/kund/kund.module.css'

/** Skeleton for the profile page while name/phone/email load. */
export default function ProfilLoading() {
  return (
    <section className="portal-section" aria-busy="true" aria-live="polite">
      <span className="prose" style={{ position: 'absolute', left: '-9999px' }}>
        Laddar din profil…
      </span>

      <div className={`${styles.skeleton} ${styles.skelTitle}`} />

      <div className={styles.skelRows}>
        <div className={`${styles.skeleton} ${styles.skelRow}`} />
        <div className={`${styles.skeleton} ${styles.skelRow}`} />
        <div className={`${styles.skeleton} ${styles.skelRow}`} />
      </div>
    </section>
  )
}
