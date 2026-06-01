import styles from './admin.module.css'

/**
 * Loading placeholder for salon-admin pages — mirrors the section header + a few
 * list/stat rows so the layout doesn't jump when the server data resolves.
 * Purely presentational; used by route-level `loading.tsx` files (App Router
 * Suspense fallback). Respects prefers-reduced-motion via the .skelRow rule.
 */
export function AdminSkeleton({
  title,
  rows = 4,
  stats = false,
}: {
  title: string
  rows?: number
  stats?: boolean
}) {
  return (
    <section className="portal-section" aria-busy="true" aria-live="polite">
      <h1>{title}</h1>
      <p className="prose">
        <span className={styles.muted}>Laddar…</span>
      </p>
      {stats ? (
        <ul className="portal-stats">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className={`${styles.skelRow} ${styles.skelStat}`} aria-hidden="true" />
          ))}
        </ul>
      ) : null}
      <div className={styles.skeleton} style={{ marginTop: '1.5rem' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={styles.skelRow} aria-hidden="true" />
        ))}
      </div>
    </section>
  )
}
