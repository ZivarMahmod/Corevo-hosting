import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive } from '@/lib/tenant-modules'
import { loadShopData } from '@/lib/storefront/shop/load-shop'
import { CheckoutForm } from './CheckoutForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Kassa' }

// Webshop-kassa (köp-räls, goal-49). Gatad på LIVE shop-modul. Server-delen
// resolverar tenant + fulfilment-variant (för vilka fält som visas); CheckoutForm
// (client) läser klient-varukorgen, reserverar ordern (håller lager) och bekräftar.
export default async function KassaPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle

  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  if (!isModuleLive(states, 'shop')) notFound()

  const shop = await loadShopData(tenant.id, tenant.slug)
  const fulfilment = shop?.config.fulfilment ?? 'ship'

  return (
    <section className="section" style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ fontFamily: 'var(--font-display, var(--font-body))', fontSize: 28, margin: '0 0 24px' }}>Kassa</h1>
      <CheckoutForm fulfilment={fulfilment} />
    </section>
  )
}
