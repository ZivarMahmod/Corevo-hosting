import type { Metadata } from 'next'
import { requireOrganizationOwner } from '@/lib/admin/owner-guard'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow, listLocations, listDomains } from '@/lib/admin/data'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { PageHead, Card, Badge, Callout, Button } from '@/components/portal/ui'
import styles from '@/components/admin/admin.module.css'

/** L3 C-01 — Företag och profil. SAMMA formulär som förut (SettingsForm är orörd);
 *  sidan flyttade bara ut ur inställningsroten, som nu är kartan över kategorierna.
 *  Betalningen bor i sin egen kategori (/admin/installningar/betalning). */

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Företag och profil · Adminpanel' }

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se').replace(/:\d+$/, '')

export default async function ForetagPage() {
  const user = await requireOrganizationOwner('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Inställningar" title="Företag och profil" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const [settings, locations, domains] = await Promise.all([
    getSettingsRow(tenant.id),
    listLocations(tenant.id),
    listDomains(tenant.id),
  ])
  const primary = locations.find((l) => l.is_primary) ?? locations[0] ?? null
  const sjson = (settings?.settings ?? {}) as {
    cancellation_cutoff_hours?: number
    contact?: { email?: string | null; phone?: string | null }
    customer_accounts_enabled?: boolean
    notifications?: { confirmation?: boolean; reminder?: boolean; review?: boolean }
    google_review_url?: string | null
    cookie_banner_enabled?: boolean
  }
  const contact = sjson.contact ?? {}
  const verifiedDomains = domains.filter((d) => d.verified).length

  return (
    <section className="portal-section" style={{ maxWidth: '640px' }}>
      <PageHead
        eyebrow={tenant.name}
        title="Företag och profil"
        lede="Namn, kontakt, adress, tidszon och avbokningsregel."
      />
      <p style={{ margin: '0 0 1rem' }}>
        <Button href="/admin/installningar" variant="ghost" icon="arrowLeft" size="sm">
          Alla inställningar
        </Button>
      </p>

      <SettingsForm
        name={tenant.name}
        paymentMode={settings?.payment_mode ?? 'on_site'}
        cancellationHours={
          typeof sjson.cancellation_cutoff_hours === 'number' ? sjson.cancellation_cutoff_hours : 24
        }
        timezone={primary?.timezone ?? tenant.timeZone}
        locationName={primary?.name ?? tenant.name}
        address={primary?.address ?? ''}
        contactEmail={contact.email ?? ''}
        contactPhone={contact.phone ?? ''}
        customerAccountsEnabled={sjson.customer_accounts_enabled === true}
        notifications={{
          confirmation: sjson.notifications?.confirmation !== false,
          reminder: sjson.notifications?.reminder !== false,
          review: sjson.notifications?.review !== false,
        }}
        googleReviewUrl={sjson.google_review_url ?? ''}
        cookieBannerEnabled={sjson.cookie_banner_enabled !== false}
      />

      {/* ── Egen domän ── enda gruppen sidan själv renderar. Endast riktiga fält:
          d.domain / d.verified / d.is_primary. */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <div>
          <span className="eyebrow">Egen domän</span>
          <h2 className="h2" style={{ margin: '6px 0 0' }}>
            Adress till din sida
          </h2>
        </div>

        <p className="body" style={{ margin: 0 }}>
          Ditt företag nås på{' '}
          <span className={styles.code}>
            {tenant.slug}.{ROOT_DOMAIN}
          </span>
          . Vill du koppla en egen domän (t.ex. <span className={styles.code}>dittforetag.se</span>)
          kontaktar du Corevo — själva DNS-/Cloudflare-kopplingen görs av oss.
        </p>

        {domains.length > 0 ? (
          <>
            <ul className={styles.list}>
              {domains.map((d) => (
                <li key={d.id} className={styles.row}>
                  <span className={styles.code}>{d.domain}</span>
                  <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <Badge tone={d.verified ? 'success' : 'warning'}>
                      {d.verified ? 'Verifierad' : 'Väntar på verifiering'}
                    </Badge>
                    {d.is_primary ? <Badge tone="gold">Primär</Badge> : null}
                  </span>
                </li>
              ))}
            </ul>
            <Callout
              tone={verifiedDomains > 0 ? 'success' : 'warning'}
              icon={verifiedDomains > 0 ? 'checkCircle' : 'alert'}
            >
              {verifiedDomains > 0 ? (
                <>
                  <span className="num">{verifiedDomains}</span> av{' '}
                  <span className="num">{domains.length}</span> domän
                  {domains.length === 1 ? '' : 'er'} är verifierad och pekar mot ditt företag —
                  kunder kan nå sidan på din egna adress.
                </>
              ) : (
                <>
                  Domänen är tillagd men inte verifierad ännu. Tills DNS-kopplingen är klar når
                  kunderna din sida på {tenant.slug}.{ROOT_DOMAIN} — Corevo hör av sig när den är
                  redo.
                </>
              )}
            </Callout>
          </>
        ) : (
          <Callout tone="info" icon="info">
            Ingen egen domän kopplad ännu. Ditt företag nås på {tenant.slug}.{ROOT_DOMAIN}. Kontakta
            Corevo för att koppla en egen domän.
          </Callout>
        )}
      </Card>
    </section>
  )
}
