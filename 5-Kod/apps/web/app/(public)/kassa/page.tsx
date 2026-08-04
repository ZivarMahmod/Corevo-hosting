import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { loadShopData } from '@/lib/storefront/shop/load-shop'
import { loadCheckoutOptions } from '@/lib/storefront/shop/checkout-options'
import { CheckoutForm } from '@/components/storefront/shop/CheckoutForm'
import { SubpageHero } from '@/components/storefront/sections'
import { themeModuleViews } from '@/components/storefront/layouts/runtime'
import s from './kassa.module.css'
import { commerceReleaseGate } from '@/lib/release/commerce'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kassa' }

export default async function KassaPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  if (!commerceReleaseGate(tenant.id).shop) notFound()

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  if (!isModuleLive(states, 'shop')) notFound()

  const shop = await loadShopData(tenant.id, tenant.slug)
  const fulfilment = shop?.config.fulfilment ?? 'ship'

  const checkout = shop
    ? await loadCheckoutOptions(tenant.id, tenant.slug, shop.config)
    : { shippingOptions: [], paymentMethods: [] }

  if (shop && shop.config.paymentMethods.length > 0 && checkout.paymentMethods.length === 0) {
    return (
      <section className={`section ${s.closed}`}>
        <h1 className={s.closedTitle}>Betalningen är tillfälligt stängd</h1>
        <p className={s.closedText}>
          Inget aktiverat betalsätt går att använda just nu. Din varukorg finns kvar.
        </p>
        <Link href="/shop" className={s.link}>
          Tillbaka till butiken
        </Link>
      </section>
    )
  }

  const OwnCheckout = themeModuleViews(bundle.settings.theme).checkout

  const accountsEnabled = bundle.settings.customerAccountsEnabled
  let signedInEmail: string | null = null
  let signedIn = false
  if (accountsEnabled) {
    const supabase = await createClient()
    const { data: auth } = await supabase.auth.getUser()
    signedIn = !!auth?.user
    signedInEmail = auth?.user?.email ?? null
  }

  const accountNotice = !accountsEnabled ? null : !signedIn ? (
    <p className={s.account}>
      Har du ett konto?{' '}
      <Link href="/login?next=/kassa" className={`${s.link} ${s.accountLink}`}>
        Logga in
      </Link>{' '}
      så sparas din beställning på Mina sidor.
    </p>
  ) : signedInEmail ? (
    <p className={s.account}>Inloggad som {signedInEmail} — beställningen sparas på Mina sidor.</p>
  ) : null

  if (OwnCheckout) {
    return (
      <section className={`section ${s.shell}`}>
        {accountNotice}
        <OwnCheckout
          fulfilment={fulfilment}
          shippingOptions={checkout.shippingOptions}
          paymentMethods={checkout.paymentMethods}
        />
      </section>
    )
  }

  return (
    <>
      <SubpageHero eyebrow="— Snart klart" title="Kassa" />
      <section className={`section ${s.shell}`}>
        {accountNotice}
        <CheckoutForm
          fulfilment={fulfilment}
          shippingOptions={checkout.shippingOptions}
          paymentMethods={checkout.paymentMethods}
        />
      </section>
    </>
  )
}
