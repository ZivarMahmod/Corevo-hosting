import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { resolveTerm } from '@/lib/platform/verticals-shared'
import {
  getCustomerDetail,
  getCustomerContact,
  getCustomerLoyalty,
  type CustomerTier,
} from '@/lib/admin/data'
import { getCustomerStaffFavorite } from '@/lib/kund/favorites'
import { formatDateTime, formatPrice, statusLabel } from '@/lib/admin/format'
import { badgeClass } from '@/components/admin/badge'
import { PageHead, Card, Badge, LoyaltyBlock } from '@/components/portal/ui'
import { CustomerContactCard } from '@/components/admin/CustomerContactCard'
import { CustomerPrivacyForm } from '@/components/admin/CustomerPrivacyForm'
import { CustomerFlags } from '@/components/admin/CustomerFlags'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kund · Adminpanel' }

/** Härledd nivå → svensk etikett (samma mappning som listan; LoyaltyBlock/Badge
 *  vill ha versal-initial-etiketten). */
const TIER_LABEL: Record<CustomerTier, string> = {
  guld: 'Guld',
  silver: 'Silver',
  brons: 'Brons',
  ny: 'Ny',
}

/** Nästa riktiga nivåtröskel ovanför nuvarande poäng. Trösklarna speglar
 *  lib/admin/data (Guld=500, Silver=150); guld = toppnivå → null (rail döljs). */
function nextTierAt(tier: CustomerTier): number | null {
  switch (tier) {
    case 'ny':
    case 'brons':
      return 150
    case 'silver':
      return 500
    default:
      return null
  }
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireAdminArea('kunder')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Kund" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const customer = await getCustomerDetail(tenant.id, id)
  if (!customer) notFound()

  // Time-bound contact PII (RPC; null fields when outside the operational window).
  // Riktigt lojalitets-saldo + favoritfrisör (båda admin-läsbara via RLS). Kör
  // parallellt. Prestanda C4: getCustomerLoyalty läser BARA den här kundens aggregat
  // (RPC admin_customer_rows med p_customer) i stället för att dra HELA kundlistan.
  const [contact, fav, loyalty] = await Promise.all([
    getCustomerContact(id),
    getCustomerStaffFavorite(id),
    getCustomerLoyalty(tenant.id, id),
  ])
  // VIKTIGT: getCustomerLoyalty är status='active'-filtrerad medan getCustomerDetail
  // INTE filtrerar status — en 'anonymized' (GDPR-skrubbad) kund nås via direkt-URL men
  // har ingen aktiv rad. Då är loyalty null → vi visar en ÄRLIG tom-text, ALDRIG ett
  // påhittat 0/Ny-saldo.
  const favStaff = fav?.title?.trim() || '—'
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
            <Detail label="Återkommande" value={`${customer.visits} besök`} num />
            <Detail
              label={`Favorit${resolveTerm(tenant.terminology, 'staff', 'Personal').toLowerCase()}`}
              value={favStaff}
            />
            <Detail label="Konto" value={customer.isLinkedAccount ? 'Inloggad kund' : 'Gäst'} />
            <Detail label="Kund sedan" value={formatDateTime(customer.firstSeenAt, tz)} num />
            <Detail label="Senast sedd" value={formatDateTime(customer.lastSeenAt, tz)} num />
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

        {/* Styrning (B-25): dölj (soft delete) + självbokning. Medvetet SKILD från
            GDPR-vägen — dölj är reversibelt, anonymisering är det inte. */}
        <Card>
          <span className="eyebrow">Styrning</span>
          <p className="prose" style={{ margin: '8px 0 14px', fontSize: 13 }}>
            Att dölja en kund raderar ingenting — historiken och bokningarna finns kvar. Stängd
            självbokning betyder att ni bokar åt kunden; er egen kalender påverkas aldrig.
          </p>
          <CustomerFlags
            customerId={customer.id}
            hidden={customer.hidden}
            selfBook={customer.selfBook}
          />
        </Card>

        {/* Kontakt-PII — tidsbunden (RPC). Behåller den RPC-medvetna kortets
            grindning (visas bara i driftfönstret) — ärlig maskering utanför. */}
        <Card>
          <span className="eyebrow">Kontakt-PII · tidsbunden</span>
          <p className="prose" style={{ margin: '8px 0 14px', fontSize: 13 }}>
            Telefon och e-post visas bara i det operativa fönstret kring en bokning. Utanför fönstret
            är de maskerade — så data inte ligger framme i onödan.
          </p>
          {/* canEdit: en GDPR-skrubbad kund (status ≠ 'active') får ALDRIG
              återfyllas med ny PII — server-actionen vägrar, kortet döljer formen. */}
          <CustomerContactCard
            contact={contact}
            customerId={customer.id}
            canEdit={customer.status === 'active'}
          />
        </Card>

        {/* Lojalitet — stor guld-poängsiffra + Nästa nivå + progress (§4.6).
            LoyaltyBlock äger sin egen "Lojalitet · {nivå}"-eyebrow, så Card:en
            sätter ingen egen rubrik (undviker dubblering). Poäng/nivå härleds ur
            loyalty_ledger (riktigt saldo, aldrig fejkat). Saknas raden (skrubbad
            kund) → ärlig tom-text, aldrig påhittat saldo. */}
        <Card>
          {loyalty ? (
            <LoyaltyBlock
              world="backoffice"
              tier={TIER_LABEL[loyalty.tier]}
              points={loyalty.loyaltyPoints}
              nextTierAt={nextTierAt(loyalty.tier)}
            />
          ) : (
            <>
              <span className="eyebrow">Lojalitet</span>
              <p className="prose" style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--c-ink-2)' }}>
                Lojalitetspoäng kunde inte hämtas för den här kunden (kunden kan vara avregistrerad
                eller skrubbad). Inget saldo visas hellre än ett påhittat.
              </p>
            </>
          )}
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
                    <th>{resolveTerm(tenant.terminology, 'staff', 'Medarbetare')}</th>
                    <th>Status</th>
                    <th>Bokad den</th>
                    <th data-last="">Pris</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.history.map((b) => (
                    <tr key={b.id}>
                      <td className="num">{formatDateTime(b.startTs, tz)}</td>
                      <td>{b.serviceName}</td>
                      <td>{b.staffTitle}</td>
                      <td>
                        <span className={badgeClass(b.status)}>{statusLabel(b.status)}</span>
                      </td>
                      <td className="num" style={{ color: 'var(--c-ink-3)' }}>
                        {formatDateTime(b.createdAt, tz)}
                      </td>
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

function Detail({ label, value, num }: { label: string; value: string; num?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--c-ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </div>
      <div
        className={num ? 'num' : undefined}
        style={{ fontSize: 14, fontWeight: 500, marginTop: 3, color: 'var(--c-ink)' }}
      >
        {value}
      </div>
    </div>
  )
}
