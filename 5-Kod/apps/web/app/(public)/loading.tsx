import styles from '@/components/brand/brand.module.css'

/** Shared storefront loading skeleton (hero band + service-grid). Renders while
 *  the per-request tenant + services resolve. Covers every (public) route; the
 *  service-card skeleton matches the data-heavy /tjanster + home grids. */
export default function PublicLoading() {
  return (
    <>
      <section className="hero" aria-hidden="true">
        <div className={styles.heroSkeleton}>
          <div className={`${styles.skeletonBar} ${styles.skeletonTiny}`} />
          <div className={styles.skeletonBar} style={{ height: '2.5rem', width: '60%' }} />
          <div className={`${styles.skeletonBar} ${styles.skeletonShort}`} />
          <div className={styles.skeletonBar} style={{ width: '8rem', height: '2.5rem' }} />
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <span className={styles.srOnly} role="status">
            Laddar…
          </span>
          <ul className={`service-grid`} aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className={styles.skeleton}>
                <div className={styles.skeletonBar} />
                <div className={`${styles.skeletonBar} ${styles.skeletonShort}`} />
                <div className={`${styles.skeletonBar} ${styles.skeletonTiny}`} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
