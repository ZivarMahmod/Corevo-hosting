import styles from '@/components/kund/kund.module.css'

/** Skeleton for "Mina tider" — renders inside PortalShell while bookings load. */
export default function KontoLoading() {
  return (
    <section className="portal-section" aria-busy="true" aria-live="polite">
      <span className="prose" style={{ position: 'absolute', left: '-9999px' }}>
        Laddar dina tider…
      </span>

      <div className={`${styles.skeleton} ${styles.skelTitle}`} />

      <div className={`${styles.skeleton} ${styles.skelGroupTitle}`} />
      <div className={styles.skelRows}>
        <div className={`${styles.skeleton} ${styles.skelRow}`} />
        <div className={`${styles.skeleton} ${styles.skelRow}`} />
      </div>

      <div className={`${styles.skeleton} ${styles.skelGroupTitle}`} />
      <div className={styles.skelRows}>
        <div className={`${styles.skeleton} ${styles.skelRow}`} />
      </div>
    </section>
  )
}
