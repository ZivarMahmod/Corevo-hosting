import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { listCustomers, customerStats } from '@/lib/admin/data'
import { getCustomerStaffFavorite } from '@/lib/kund/favorites'
import { formatDateTime } from '@/lib/admin/format'
import { PageHead, Stat, Card, Badge, Icon, Button, Callout } from '@/components/portal/ui'
import { CustomerSearch } from '@/components/admin/CustomerSearch'
import { CustomerExport, type ExportRow } from './CustomerExport'

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
  const goldCount = all.filter((c) => c.tier === 'guld').length
  const q = sp.q?.trim() ?? ''
  const list = q ? all.filter((c) => c.shownName.toLowerCase().includes(q.toLowerCase())) : all

  // Favoritfrisör per synlig rad (§4.6 "Frisör"-kolumn). RLS: customer_favorites
  // släpper in admin (role_level>=3) tenant-wide (migr 0011:520), så detta är en
  // RIKTIG admin-läsbar källa — den namngivna getCustomerStaffFavorite. Ofta null
  // på äkta data (få kunder favoritmarkerar) → ärlig "—", aldrig påhittad frisör.
  // NB: detta är en per-rad-läsning (N+1). En batchad favorit-läsning saknas i
  // listCustomers — FLAGGAD i manifestet (lib är fryst, läggs ej till här).
  const favs = await Promise.all(list.map((c) => getCustomerStaffFavorite(c.id)))
  const favName = (i: number): string => favs[i]?.title?.trim() || '—'

  // Privacy-safe export-rader: SAMMA visningsnamn som listan (aldrig dolt fullnamn),
  // bara härledda figurer som redan syns. Ingen rå PII (telefon/e-post) lämnar RPC:n.
  const exportRows: ExportRow[] = list.map((c, i) => ({
    shownName: c.shownName,
    tier: tierBadge(c.tier).label,
    visits: c.visits,
    lastVisit: c.lastVisitTs ? formatDateTime(c.lastVisitTs, tenant.timeZone) : '—',
    favStaff: favName(i),
    loyaltyPoints: c.loyaltyPoints,
  }))

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={tenant.name}
        title="Kunder"
        lede="Frisören känner igen återkommande kunder år efter år — utan att kundens personuppgifter ligger exponerade."
      >
        <CustomerExport rows={exportRows} />
      </PageHead>

      <div className="bo-stat-grid">
        <Stat label="Kunder totalt" value={stats.total} icon="users" />
        <Stat label="Återkommande" value={stats.returning} icon="repeat" hint="≥ 5 besök" />
        <Stat label="Guld-nivå" value={goldCount} icon="gift" />
        <Stat label="Skyddat namn" value={stats.protectedNames} icon="shield" hint="Kundens val" />
      </div>

      {/* Röd tråd-band: kunddatabasen byggs av bokningar — det finns ingen manuell
          "skapa kund"-väg i dataskiktet (kunder härleds från bokningar). Ärlig
          förklaring i stället för en död primärknapp. */}
      <Callout tone="info" icon="info">
        Kunddatabasen byggs automatiskt från bokningarna — varje återkommande gäst får en stabil
        rad här. Det finns ingen manuell &quot;skapa kund&quot;; en ny kund uppstår när första
        bokningen görs på din publika sajt.
      </Callout>

      <div style={{ margin: '16px 0 0' }}>
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
                  <th>Senaste</th>
                  <th>Frisör</th>
                  <th data-last="">Lojalitet</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => {
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
                      <td style={{ color: 'var(--c-ink-2)' }}>
                        {c.lastVisitTs ? formatDateTime(c.lastVisitTs, tenant.timeZone) : '—'}
                      </td>
                      <td style={{ color: 'var(--c-ink-2)' }}>{favName(i)}</td>
                      <td
                        data-last=""
                        className="num"
                        style={{ fontWeight: 600, color: 'var(--c-gold-600)' }}
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
