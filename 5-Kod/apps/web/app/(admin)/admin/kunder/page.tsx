import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listCustomers, customerStats } from '@/lib/admin/data'
import { formatDateTime } from '@/lib/admin/format'
import { PageHead, Stat, Card, Badge, Icon } from '@/components/portal/ui'
import { CustomerSearch } from '@/components/admin/CustomerSearch'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kunder · Salongsadmin' }

/** Lojalitetsnivå → Badge-ton + svensk etikett (§4.6: Guld→gold, Silver→info,
 *  Ny→success, annars neutral). Nivån är härledd från riktiga ledger-poäng. */
function tierBadge(tier: 'guld' | 'silver' | 'brons' | 'ny') {
  switch (tier) {
    case 'guld':
      return { tone: 'gold' as const, label: 'Guld' }
    case 'silver':
      return { tone: 'info' as const, label: 'Silver' }
    case 'brons':
      return { tone: 'neutral' as const, label: 'Brons' }
    default:
      return { tone: 'success' as const, label: 'Ny' }
  }
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const sp = await searchParams
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Kunder" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const all = await listCustomers(tenant.id)
  const stats = customerStats(all)
  const q = sp.q?.trim() ?? ''
  const list = q ? all.filter((c) => c.shownName.toLowerCase().includes(q.toLowerCase())) : all

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title="Kunder"
        lede="Din kunddatabas — sök, följ historik och se vem som kommer tillbaka. Allt byggs upp automatiskt från bokningarna."
      />

      <div className="bo-stat-grid">
        <Stat label="Kunder totalt" value={stats.total} icon="users" />
        <Stat label="Återkommande" value={stats.returning} icon="user" delta="≥ 5 besök" deltaTone="muted" />
        <Stat label="Skyddat namn" value={stats.protectedNames} icon="shield" delta="Kundens val" deltaTone="muted" />
        <Stat
          label="Lojalitetspoäng"
          value={stats.loyaltyPoints.toLocaleString('sv-SE')}
          icon="gift"
          hint="Summa över alla kunder"
        />
      </div>

      <div style={{ maxWidth: 360 }}>
        <CustomerSearch defaultValue={q} />
      </div>

      {all.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '14px 8px', color: 'var(--c-ink-2)' }}>
            <strong style={{ display: 'block', color: 'var(--c-ink)', marginBottom: 4 }}>
              Inga kunder ännu.
            </strong>
            När bokningar görs på din publika sajt byggs kunddatabasen upp automatiskt — varje
            återkommande kund får en stabil rad här.
          </div>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '14px 8px', color: 'var(--c-ink-2)' }}>
            <strong style={{ display: 'block', color: 'var(--c-ink)', marginBottom: 4 }}>
              Ingen kund matchar “{q}”.
            </strong>
            <Link href="/admin/kunder" className="num" style={{ color: 'var(--c-forest)' }}>
              Rensa sökningen
            </Link>{' '}
            för att se alla.
          </div>
        </Card>
      ) : (
        <Card pad={0}>
          <div style={{ overflowX: 'auto' }}>
            <table className="ptable">
              <thead>
                <tr>
                  <th>Kund</th>
                  <th>Nivå</th>
                  <th>Besök</th>
                  <th data-last="">Senaste besök</th>
                  <th style={{ textAlign: 'right' }}>Lojalitet</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const tier = tierBadge(c.tier)
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link
                          href={`/admin/kunder/${c.id}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            color: 'inherit',
                            textDecoration: 'none',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 999,
                              background: 'var(--c-forest)',
                              color: '#fff',
                              display: 'grid',
                              placeItems: 'center',
                              fontSize: 12.5,
                              fontWeight: 700,
                              flex: 'none',
                            }}
                          >
                            {c.shownName[0]?.toUpperCase() ?? '?'}
                          </span>
                          <span style={{ fontWeight: 600 }}>{c.shownName}</span>
                          {c.nameHidden && (
                            <span
                              title="Kunden visar skyddat namn"
                              style={{ display: 'inline-flex', color: 'var(--c-info)' }}
                            >
                              <Icon name="shield" size={13} />
                            </span>
                          )}
                        </Link>
                      </td>
                      <td>
                        <Badge tone={tier.tone}>{tier.label}</Badge>
                      </td>
                      <td className="num">{c.visits}</td>
                      <td data-last="" style={{ color: 'var(--c-ink-2)' }}>
                        {c.lastVisitTs ? formatDateTime(c.lastVisitTs, tenant.timeZone) : '—'}
                      </td>
                      <td
                        className="num"
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          color: 'var(--c-gold-600)',
                        }}
                      >
                        {c.loyaltyPoints.toLocaleString('sv-SE')} p
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  )
}
