import styles from '@/components/personal/personal.module.css'

/** Skeleton shown while today's view loads (server fetch). Mirrors the retrofit:
 *  a PageHead, the forest "Nästa kund" hero, then the day-list cards. */
export default function Loading() {
  return (
    <section className="portal-section" aria-busy="true" aria-label="Laddar dagens vy" style={{ maxWidth: 720 }}>
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
