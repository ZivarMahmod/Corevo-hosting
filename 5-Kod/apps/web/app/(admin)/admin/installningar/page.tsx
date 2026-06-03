import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow, listLocations, listDomains } from '@/lib/admin/data'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { StripeConnectCard } from '@/components/admin/StripeConnectCard'
import { PageHead, Card, Badge, Callout } from '@/components/portal/ui'
import styles from '@/components/admin/admin.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Inställningar · Salongsadmin' }

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'corevo.se').replace(/:\d+$/, '')

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>
}) {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salong-admin" title="Inställningar" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const supabase = await createClient()
  const [settings, locations, domains, { data: stripeRow }, { stripe }] = await Promise.all([
    getSettingsRow(tenant.id),
    listLocations(tenant.id),
    listDomains(tenant.id),
    supabase
      .from('tenants')
      .select('stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted')
      .eq('id', tenant.id)
      .maybeSingle(),
    searchParams.then((s) => ({ stripe: s.stripe })),
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
        title="Inställningar"
        lede="Salongens namn, kontakt, tidszon, betalningssätt och avbokningsregel. Avbokningsregeln läses av kundportalen när en kund vill avboka eller boka om."
      />

      {/* §6 T10 — produkten berättar om sig själv: en lugn explainer som ramar in
          vad som styrs här. Påstår inget per-toggle (de pillarna + sina egna proof-
          band bor i SettingsForm), så det är ärligt på sidnivå. */}
      <Callout tone="info" icon="info">
        Allt du ställer in här styr direkt vad kunden möter på din publika sajt — vid
        bokning, i bekräftelsemejl och när hen vill avboka. Varje rad visar sitt nuläge
        med en Aktiv/Av-markering.
      </Callout>

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

      <StripeConnectCard
        hasAccount={Boolean(stripeRow?.stripe_account_id)}
        chargesEnabled={stripeRow?.stripe_charges_enabled ?? false}
        payoutsEnabled={stripeRow?.stripe_payouts_enabled ?? false}
        detailsSubmitted={stripeRow?.stripe_details_submitted ?? false}
        paymentsEnabled={settings?.payments_enabled ?? false}
        justReturned={stripe === 'return'}
      />

      {/* ── Egen domän ── den enda inställningsgruppen som sidan själv renderar,
          så den får visa upp playbook-mönstret: Card-primitiv + eyebrow-rubrik +
          Badge-status + proof-Callout. Endast riktiga fält: d.domain / d.verified /
          d.is_primary. */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <div>
          <span className="eyebrow">Egen domän</span>
          <h2 className="h2" style={{ margin: '6px 0 0' }}>
            Adress till din sajt
          </h2>
        </div>

        <p className="body" style={{ margin: 0 }}>
          Din salong nås på{' '}
          <span className={styles.code}>
            {tenant.slug}.{ROOT_DOMAIN}
          </span>
          . Vill du koppla en egen domän (t.ex. <span className={styles.code}>dinsalong.se</span>)
          kontaktar du Corevo — själva DNS-/Cloudflare-kopplingen görs av oss (G08).
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
                  {domains.length === 1 ? '' : 'er'} är verifierad och pekar mot din salong —
                  kunder kan nå sajten på din egna adress.
                </>
              ) : (
                <>
                  Domänen är tillagd men inte verifierad ännu. Tills DNS-kopplingen är klar når
                  kunderna din sajt på {tenant.slug}.{ROOT_DOMAIN} — Corevo hör av sig när den är
                  redo.
                </>
              )}
            </Callout>
          </>
        ) : (
          /* Behåller den befintliga svenska tomtillståndet (regel 6), om-skinnad som
             en lugn info-Callout. */
          <Callout tone="info" icon="info">
            Ingen egen domän kopplad ännu. Din salong nås på {tenant.slug}.{ROOT_DOMAIN}. Kontakta
            Corevo för att koppla en egen domän.
          </Callout>
        )}
      </Card>
    </section>
  )
}
