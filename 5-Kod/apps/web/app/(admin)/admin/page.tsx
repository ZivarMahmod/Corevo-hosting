import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { dashboardData } from '@/lib/admin/data'
import { todayInTz, dayRangeUtc, weekRangeUtc } from '@/lib/admin/dates'
import { formatTime, statusLabel } from '@/lib/admin/format'
import { badgeClass } from '@/components/admin/badge'
import styles from '@/components/admin/admin.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Salongsadmin' }

export default async function AdminPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <h1>Salongsadmin</h1>
        <p className="prose">Ingen salong är kopplad till ditt konto. Kontakta Corevo.</p>
      </section>
    )
  }

  const today = todayInTz(tenant.timeZone)
  const data = await dashboardData(tenant.id, dayRangeUtc(today, tenant.timeZone), weekRangeUtc(today, tenant.timeZone))

  const stats = [
    { label: 'Bokningar idag', value: data.todayCount },
    { label: 'Bokningar denna vecka', value: data.weekCount },
    { label: 'Aktiva tjänster', value: data.servicesActive },
    { label: 'Aktiv personal', value: data.staffActive },
  ]

  return (
    <section className="portal-section">
      <h1>Översikt</h1>
      <p className="prose">{tenant.name} · {today}</p>

      <ul className="portal-stats">
        {stats.map((s) => (
          <li key={s.label} className="portal-stat">
            <span className="portal-stat-value">{s.value}</span>
            <span className="portal-stat-label">{s.label}</span>
          </li>
        ))}
      </ul>

      <div className={styles.section} style={{ marginTop: '2rem' }}>
        <div className={styles.sectionHead}>
          <h2>Dagens bokningar</h2>
          <Link className={styles.navLink} href="/admin/bokningar">
            Alla bokningar →
          </Link>
        </div>
        {data.upcomingToday.length === 0 ? (
          <p className={styles.muted}>Inga bokningar idag.</p>
        ) : (
          <ul className={styles.list}>
            {data.upcomingToday.map((b) => (
              <li key={b.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {formatTime(b.startTs, tenant.timeZone)} · {b.serviceName}
                  </span>
                  <span className={styles.rowSub}>{b.staffTitle}</span>
                </div>
                <span className={badgeClass(b.status)}>{statusLabel(b.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
