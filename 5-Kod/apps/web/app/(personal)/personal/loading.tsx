import styles from '@/components/personal/personal.module.css'

/** Neutral calendar skeleton while the selected day loads. */
export default function Loading() {
  return (
    <section className="portal-section" aria-busy="true" aria-label="Laddar kalendern" style={{ maxWidth: 720 }}>
      <div className={`${styles.skeleton} ${styles.skelHeading}`} />
      <div
        className={styles.skeleton}
        style={{ height: '6rem', borderRadius: 16, margin: '1rem 0 1.6rem' }}
      />
      <div className={`${styles.skeleton} ${styles.skelRow}`} style={{ height: '4.5rem' }} />
      <div className={`${styles.skeleton} ${styles.skelRow}`} style={{ height: '4.5rem' }} />
      <div className={`${styles.skeleton} ${styles.skelRow}`} style={{ height: '4.5rem' }} />
    </section>
  )
}
