import type { Metadata } from 'next'
import { requirePortal } from '@/lib/auth/session'
import { getAdminTenant } from '@/lib/admin/tenant'
import { getAdminModuleStates, isModuleActivated, moduleAdminConfig } from '@/lib/admin/modules'
import { listShopProducts, listShopOrders } from '@/lib/admin/shop/data'
import { listMediaAssets } from '@/lib/admin/media/data'
import { ShopAdmin } from '@/components/admin/ShopAdmin'
import { PageHead, Callout } from '@/components/portal/ui'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Webshop · Salongsadmin' }

export default async function WebshopPage() {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) {
    return (
      <section className="portal-section">
        <PageHead eyebrow="Salongsadmin" title="Webshop" />
        <p className="prose">Ingen salong är kopplad till ditt konto.</p>
      </section>
    )
  }

  const states = await getAdminModuleStates(tenant.id)

  if (!isModuleActivated(states, 'shop')) {
    return (
      <section className="portal-section">
        <PageHead eyebrow={tenant.name} title="Webshop" />
        <Callout tone="info" icon="info">
          Webshop är inte aktiverad för din salong. Be plattformsadmin aktivera modulen.
        </Callout>
      </section>
    )
  }

  const [products, orders, assets] = await Promise.all([
    listShopProducts(tenant.id),
    listShopOrders(tenant.id),
    listMediaAssets(tenant.id),
  ])

  const config = moduleAdminConfig(states, 'shop')
  const fulfilment = typeof config.fulfilment === 'string' ? config.fulfilment : 'ship'

  return (
    <section className="portal-section">
      <ShopAdmin products={products} orders={orders} fulfilment={fulfilment} tenantName={tenant.name} assets={assets} />
    </section>
  )
}
