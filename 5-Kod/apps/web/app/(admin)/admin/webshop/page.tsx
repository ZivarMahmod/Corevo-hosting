import type { Metadata } from 'next'
import { requireAdminArea } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated, moduleAdminConfig } from '@/lib/admin/modules'
import { listShopProducts, listShopOrders, listShippingOptions } from '@/lib/admin/shop/data'
import { shopRailsStatus } from '@/lib/storefront/shop/checkout-options'
import { parsePaymentMethods } from '@/lib/storefront/shop/types'
import { listMediaAssets } from '@/lib/admin/media/data'
import { ShopAdmin } from '@/components/admin/ShopAdmin'
import { PageHead, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Webshop · Adminpanel' }

export default async function WebshopPage() {
  const user = await requireAdminArea('webshop')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Adminpanel" title="Webshop" />
        <p className="prose">Inget företag är kopplat till ditt konto.</p>
      </section>
    )
  }

  const states = await getAdminModuleStates(tenant.id)

  if (!isModuleActivated(states, 'shop')) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Webshop" />
        <Callout tone="info" icon="info">
          Webshop är inte aktiverad för ditt företag. Be plattformsadmin aktivera modulen.
        </Callout>
      </section>
    )
  }

  const [products, orders, assets, shippingOptions, rails] = await Promise.all([
    listShopProducts(tenant.id),
    listShopOrders(tenant.id),
    listMediaAssets(tenant.id),
    listShippingOptions(tenant.id), // goal-64: kundens leveransval
    shopRailsStatus(tenant.id), // goal-64: är Stripe/PayPal faktiskt kopplade?
  ])

  const config = moduleAdminConfig(states, 'shop')
  const fulfilment = typeof config.fulfilment === 'string' ? config.fulfilment : 'ship'
  // Betalsätten bor i samma config-jsonb som fulfilment (payment_methods: string[]).
  const paymentMethods = parsePaymentMethods(config.payment_methods)

  return (
    <section className="portal-section">
      <ShopAdmin
        products={products}
        orders={orders}
        fulfilment={fulfilment}
        tenantName={tenant.name}
        assets={assets}
        shippingOptions={shippingOptions}
        paymentMethods={paymentMethods}
        stripeReady={rails.stripeReady}
        paypalReady={rails.paypalReady}
      />
    </section>
  )
}
