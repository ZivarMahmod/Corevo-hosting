import styles from './platform.module.css'

/** Reusable loading skeletons for platform route segments (server-safe). */

export function StatsSkeleton({ stats = 4 }: { stats?: number }) {
  return (
    <div className={styles.skelStats} aria-hidden="true">
      {Array.from({ length: stats }).map((_, i) => (
        <div key={i} className={`${styles.skel} ${styles.skelStat}`} />
      ))}
    </div>
  )
}

export function TableSkeleton() {
  return <div className={`${styles.skel} ${styles.skelTable}`} aria-hidden="true" />
}

export function PageSkeleton({
  title = true,
  stats,
  table = true,
}: {
  title?: boolean
  stats?: number
  table?: boolean
}) {
  return (
    <section className="portal-section" aria-busy="true" aria-label="Laddar">
      {title ? <div className={`${styles.skel} ${styles.skelTitle}`} /> : null}
      <div className={`${styles.skel} ${styles.skelLine}`} style={{ maxWidth: '28rem' }} />
      {stats ? <StatsSkeleton stats={stats} /> : null}
      {table ? <TableSkeleton /> : null}
    </section>
  )
}
