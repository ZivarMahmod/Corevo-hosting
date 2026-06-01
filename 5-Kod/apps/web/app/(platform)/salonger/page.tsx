import type { Metadata } from 'next'
import Link from 'next/link'
import { listTenants } from '@/lib/platform/tenants'
import { BILLING_MODEL_LABELS, type BillingModel } from '@/lib/platform/billing'
import styles from '@/components/platform/platform.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Salonger' }

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const sp = await searchParams
  const q = sp.q ?? ''
  const status = sp.status ?? 'all'
  const tenants = await listTenants({ q, status })
  const isFiltered = q.trim() !== '' || status !== 'all'

  return (
    <section className="portal-section">
      <div className={styles.sectionHead}>
        <h1 style={{ margin: 0 }}>Salonger</h1>
        <Link href="/salonger/ny" className="btn-primary">
          + Ny salong
        </Link>
      </div>
      <p className={styles.muted}>
        {tenants.length} salong{tenants.length === 1 ? '' : 'er'}
        {isFiltered ? ' (filtrerat)' : ''}
      </p>

      {/* GET form → server reads searchParams (no client JS needed). */}
      <form className={styles.filters} method="get">
        <label className={styles.field}>
          <span>Sök (namn / subdomän)</span>
          <input name="q" defaultValue={q} placeholder="frisor…" autoCapitalize="none" />
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select name="status" defaultValue={status}>
            <option value="all">Alla</option>
            <option value="active">Aktiva</option>
            <option value="suspended">Pausade</option>
          </select>
        </label>
        <button type="submit" className={styles.btn}>
          Filtrera
        </button>
      </form>

      {tenants.length === 0 ? (
        <div className={styles.empty}>
          {isFiltered ? (
            <>
              <p className={styles.emptyTitle}>Inga salonger matchar filtret</p>
              <p className={styles.emptyText}>
                Prova en bredare sökning eller återställ filtret för att se alla salonger.
              </p>
              <Link href="/salonger" className={styles.btn}>
                Rensa filter
              </Link>
            </>
          ) : (
            <>
              <p className={styles.emptyTitle}>Inga salonger ännu</p>
              <p className={styles.emptyText}>
                Skapa din första salong — välj temamall och färger, så är den live direkt.
              </p>
              <Link href="/salonger/ny" className="btn-primary">
                + Ny salong
              </Link>
            </>
          )}
        </div>
      ) : (
        <table className="portal-table">
          <thead>
            <tr>
              <th>Subdomän</th>
              <th>Namn</th>
              <th>Status</th>
              <th>Prismodell</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/salonger/${t.id}`}>
                    <code className={styles.code}>{t.slug}</code>
                  </Link>
                </td>
                <td>{t.name}</td>
                <td>
                  <span className={`${styles.badge} ${t.status === 'active' ? styles.badgeActive : styles.badgeSuspended}`}>
                    {t.status}
                  </span>
                </td>
                <td>{BILLING_MODEL_LABELS[t.billingModel as BillingModel] ?? t.billingModel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
