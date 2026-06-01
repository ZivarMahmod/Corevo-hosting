import styles from '@/components/personal/personal.module.css'

/** Skeleton shown while today's overview + calendar load (server fetch). */
export default function Loading() {
  return (
    <section className="portal-section" aria-busy="true" aria-label="Laddar dagens vy">
      <h1>Idag</h1>
      <div className={styles.skelStats}>
        <div className={`${styles.skeleton} ${styles.skelStat}`} />
        <div className={`${styles.skeleton} ${styles.skelStat}`} />
      </div>
      <h2>Kalender</h2>
      <div className={`${styles.skeleton} ${styles.skelHeading}`} />
      <div className={`${styles.skeleton} ${styles.skelRow}`} />
      <div className={`${styles.skeleton} ${styles.skelRow}`} />
      <div className={`${styles.skeleton} ${styles.skelRow}`} />
    </section>
  )
}
