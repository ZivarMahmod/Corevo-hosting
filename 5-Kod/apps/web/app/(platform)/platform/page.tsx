import type { Metadata } from 'next'
import Link from 'next/link'
import { platformMetrics } from '@/lib/platform/metrics'
import { listTenants } from '@/lib/platform/tenants'
import styles from '@/components/platform/platform.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Översikt' }

export default async function PlatformOverviewPage() {
  // platform_admin → RLS grants cross-tenant read (private.is_platform_admin()).
  // Seeing MORE than one tenant here is the proof that "platform når tvärs".
  const [metrics, recent] = await Promise.all([platformMetrics(), listTenants()])

  return (
    <section className="portal-section">
      <h1>Översikt</h1>
      <p className="prose">
        Corevos kontrollcenter — hela plattformen tvärs över alla salonger.
      </p>

      <ul className="portal-stats">
        <Stat label="Salonger totalt" value={metrics.tenantsTotal} />
        <Stat label="Aktiva salonger" value={metrics.tenantsActive} />
        <Stat label="Pausade" value={metrics.tenantsSuspended} />
        <Stat label="Bokningar totalt" value={metrics.bookingsTotal} />
      </ul>

      <div className={styles.sectionHead} style={{ marginTop: '2rem' }}>
        <h2 style={{ margin: 0 }}>Senaste salonger</h2>
        <Link href="/platform/tenants" className={styles.navLink}>
          Alla salonger →
        </Link>
      </div>

      <table className="portal-table">
        <thead>
          <tr>
            <th>Subdomän</th>
            <th>Namn</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {recent.slice(0, 8).map((t) => (
            <tr key={t.id}>
              <td>
                <Link href={`/platform/tenants/${t.id}`}>
                  <code className={styles.code}>{t.slug}</code>
                </Link>
              </td>
              <td>{t.name}</td>
              <td>
                <span className={`${styles.badge} ${t.status === 'active' ? styles.badgeActive : styles.badgeSuspended}`}>
                  {t.status}
                </span>
              </td>
            </tr>
          ))}
          {recent.length === 0 ? (
            <tr>
              <td colSpan={3} className={styles.muted}>
                Inga salonger ännu. <Link href="/platform/tenants/ny">Skapa den första →</Link>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <li className="portal-stat">
      <span className="portal-stat-value">{value}</span>
      <span>{label}</span>
    </li>
  )
}
