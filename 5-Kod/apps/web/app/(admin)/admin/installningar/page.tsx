import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow, listLocations, listDomains } from '@/lib/admin/data'
import { createClient } from '@/lib/supabase/server'
import { SettingsForm } from '@/components/admin/SettingsForm'
import { StripeConnectCard } from '@/components/admin/StripeConnectCard'
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
        <h1>Inställningar</h1>
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
    sms_enabled?: boolean
    cookie_banner_enabled?: boolean
  }
  const contact = sjson.contact ?? {}

  return (
    <section className="portal-section">
      <h1>Inställningar</h1>
      <p className="prose">
        Salongens namn, kontakt, tidszon, betalningssätt och avbokningsregel. Avbokningsregeln läses
        av kundportalen när en kund vill avboka eller boka om.
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
        smsEnabled={sjson.sms_enabled === true}
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

      <div className={`${styles.section} ${styles.card}`} style={{ marginTop: '2rem' }}>
        <h2 style={{ marginTop: 0 }}>Egen domän</h2>
        <p className="prose">
          Din salong nås på{' '}
          <span className={styles.code}>
            {tenant.slug}.{ROOT_DOMAIN}
          </span>
          . Vill du koppla en egen domän (t.ex. <span className={styles.code}>dinsalong.se</span>)
          kontaktar du Corevo — själva DNS-/Cloudflare-kopplingen görs av oss (G08).
        </p>
        {domains.length > 0 ? (
          <ul className={styles.list}>
            {domains.map((d) => (
              <li key={d.id} className={styles.row}>
                <span className={styles.code}>{d.domain}</span>
                <span className={`${styles.badge}`}>
                  {d.verified ? 'Verifierad' : 'Väntar på verifiering'}
                  {d.is_primary ? ' · primär' : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            <strong>Ingen egen domän kopplad ännu.</strong>
            Din salong nås på {tenant.slug}.{ROOT_DOMAIN}. Kontakta Corevo för att koppla en egen
            domän.
          </div>
        )}
      </div>
    </section>
  )
}
