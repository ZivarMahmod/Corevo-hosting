import styles from '@/components/kund/kund.module.css'

/** Skeleton for a single booking's detail while it loads. */
export default function BokningLoading() {
  return (
    <section className="portal-section" aria-busy="true" aria-live="polite">
      <span className="prose" style={{ position: 'absolute', left: '-9999px' }}>
        Laddar bokningen…
      </span>

      <div className={`${styles.skeleton} ${styles.skelLine}`} style={{ width: '6rem' }} />
      <div className={`${styles.skeleton} ${styles.skelTitle}`} style={{ marginTop: '1rem' }} />

      <div className={styles.skelRows}>
        <div className={`${styles.skeleton} ${styles.skelRow}`} />
        <div className={`${styles.skeleton} ${styles.skelRow}`} />
        <div className={`${styles.skeleton} ${styles.skelRow}`} />
        <div className={`${styles.skeleton} ${styles.skelRow}`} />
      </div>
    </section>
  )
}
