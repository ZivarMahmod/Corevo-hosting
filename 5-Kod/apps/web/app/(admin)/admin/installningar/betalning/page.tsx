import type { Metadata } from 'next'
import { requireOrganizationOwner } from '@/lib/admin/owner-guard'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getSettingsRow } from '@/lib/admin/data'
import { createClient } from '@/lib/supabase/server'
import { StripeConnectCard } from '@/components/admin/StripeConnectCard'
import { SettingsWorkspace } from '@/components/admin/SettingsWorkspace'
import { SettingsWorkspaceEmpty } from '@/components/admin/SettingsWorkspaceEmpty'
import { PageHead } from '@/components/portal/ui'
import { settingsCategories } from '@/lib/admin/settings-map'

/** L3 C-01 — Betalning. StripeConnectCard är ORÖRD, den flyttade bara hit från
 *  inställningsroten (som nu är kartan). Stripes retur-URL pekar hit (lib/admin/stripe.ts). */

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Betalning · Adminpanel' }

export default async function BetalningPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>
}) {
  const user = await requireOrganizationOwner('installningar')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return <SettingsWorkspaceEmpty currentCategory="betalning" title="Betalning" />
  }

  const supabase = await createClient()
  const [settings, { data: stripeRow }, { stripe }] = await Promise.all([
    getSettingsRow(tenant.id),
    supabase
      .from('tenants')
      .select('stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted')
      .eq('id', tenant.id)
      .maybeSingle(),
    searchParams.then((s) => ({ stripe: s.stripe })),
  ])

  return (
    <SettingsWorkspace categories={settingsCategories(tenant.terminology)} currentCategory="betalning">
    <section className="portal-section" style={{ maxWidth: '640px' }}>
      <PageHead
        eyebrow="Inställningar"
        title="Betalning"
        lede="Koppla Stripe och välj om kunden betalar vid bokning eller på plats."
      />
      <StripeConnectCard
        hasAccount={Boolean(stripeRow?.stripe_account_id)}
        chargesEnabled={stripeRow?.stripe_charges_enabled ?? false}
        payoutsEnabled={stripeRow?.stripe_payouts_enabled ?? false}
        detailsSubmitted={stripeRow?.stripe_details_submitted ?? false}
        paymentsEnabled={settings?.payments_enabled ?? false}
        justReturned={stripe === 'return'}
      />
    </section>
    </SettingsWorkspace>
  )
}
