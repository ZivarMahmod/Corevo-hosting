import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getCustomerDetail, getCustomerContact } from '@/lib/admin/data'
import { formatDateTime, formatPrice, statusLabel } from '@/lib/admin/format'
import { badgeClass } from '@/components/admin/badge'
import { PageHead, Card, Badge } from '@/components/portal/ui'
import { CustomerContactCard } from '@/components/admin/CustomerContactCard'
import { CustomerPrivacyForm } from '@/components/admin/CustomerPrivacyForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kund · Salongsadmin' }

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Kund" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const customer = await getCustomerDetail(tenant.id, id)
  if (!customer) notFound()

  // Time-bound contact PII (RPC; null fields when outside the operational window).
  const contact = await getCustomerContact(id)
  const tz = tenant.timeZone

  return (
    <section className="portal-section">
      <PageHead
        eyebrow={
          <Link href="/admin/kunder" style={{ color: 'inherit', textDecoration: 'none' }}>
            ← Kunder
          </Link>
        }
        title={customer.shownName}
      >
        {customer.visits >= 5 ? (
          <Badge tone="gold">Återkommande · {customer.visits} besök</Badge>
        ) : (
          <Badge tone="neutral">{customer.visits} besök</Badge>
        )}
      </PageHead>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {/* Identitet — bestående */}
        <Card>
          <span className="eyebrow">Identitet · bestående</span>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px 18px',
              marginTop: 12,
            }}
          >
            <Detail label="Visningsnamn" value={customer.shownName} />
            <Detail label="Konto" value={customer.isLinkedAccount ? 'Inloggad kund' : 'Gäst'} />
            <Detail label="Kund sedan" value={formatDateTime(customer.firstSeenAt, tz)} />
            <Detail label="Senast sedd" value={formatDateTime(customer.lastSeenAt, tz)} />
          </div>
        </Card>

        {/* Visningsnamn — kunden styr (M6 §4) */}
        <Card>
          <span className="eyebrow">Visningsnamn · kundens val</span>
          <p className="prose" style={{ margin: '8px 0 14px', fontSize: 13 }}>
            Kunden väljer själv hur namnet syns. Lojalitetsbandet bygger på identiteten, aldrig på
            exponerad personuppgift. Du kan ändra detta på kundens begäran.
          </p>
          <CustomerPrivacyForm
            customerId={customer.id}
            nameHidden={customer.nameHidden}
            displayName={customer.displayName}
          />
        </Card>

        {/* Kontakt-PII — tidsbunden (RPC) */}
        <Card>
          <span className="eyebrow">Kontakt · tidsbunden</span>
          <p className="prose" style={{ margin: '8px 0 14px', fontSize: 13 }}>
            Telefon och e-post visas bara i det operativa fönstret kring en bokning. Utanför fönstret
            är de maskerade — så data inte ligger framme i onödan.
          </p>
          <CustomerContactCard contact={contact} />
        </Card>

        {/* Bokningshistorik (via bookings.customer_id) */}
        <Card pad={0}>
          <div style={{ padding: '18px 22px 4px' }}>
            <span className="eyebrow">Bokningshistorik</span>
          </div>
          {customer.history.length === 0 ? (
            <div style={{ padding: '8px 22px 22px', color: 'var(--c-ink-2)' }}>
              Inga bokningar kopplade till den här kunden ännu.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ptable">
                <thead>
                  <tr>
                    <th>Tid</th>
                    <th>Tjänst</th>
                    <th>Medarbetare</th>
                    <th>Status</th>
                    <th>Bokad den</th>
                    <th data-last="">Pris</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.history.map((b) => (
                    <tr key={b.id}>
                      <td>{formatDateTime(b.startTs, tz)}</td>
                      <td>{b.serviceName}</td>
                      <td>{b.staffTitle}</td>
                      <td>
                        <span className={badgeClass(b.status)}>{statusLabel(b.status)}</span>
                      </td>
                      <td style={{ color: 'var(--c-ink-3)' }}>{formatDateTime(b.createdAt, tz)}</td>
                      <td data-last="" className="num">
                        {formatPrice(b.priceCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--c-ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, marginTop: 3, color: 'var(--c-ink)' }}>{value}</div>
    </div>
  )
}
