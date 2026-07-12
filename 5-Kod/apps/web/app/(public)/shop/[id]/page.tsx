import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { AddToCart } from '@/components/storefront/shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import { loadShopProduct } from '@/lib/storefront/shop/load-shop'
import s from './product.module.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const bundle = await currentTenant()
  if (!bundle) return { title: 'Webshop' }
  const data = await loadShopProduct(bundle.tenant.id, bundle.tenant.slug, id)
  return { title: data ? data.product.name : 'Webshop' }
}

/** Produktdetaljsida (goal-54 S4). Samma modul-gate som /shop: live/paused
 *  renderar (paused = stängd katalog), draft/off → 404. Okänd/inaktiv produkt
 *  → 404. Token-driven — inga egna färger, bara var(--color-*)/var(--font-*). */
export default async function ShopProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const states = await getTenantModuleStates(tenant.id, tenant.slug)
  const paused = isModulePaused(states, 'shop')
  if (!isModuleLive(states, 'shop') && !paused) notFound()

  const data = await loadShopProduct(tenant.id, tenant.slug, id)
  if (!data) notFound()
  const { config, product } = data

  const paragraphs = (product.description ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <section className="section" data-module="shop">
      <div className="section-inner">
        <p className={s.back}>
          <Link href="/shop" className={s.backLink}>
            ← Hela butiken
          </Link>
        </p>

        <div className={s.grid}>
          <div className={s.media}>
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.imageAlt ?? product.name}
                className={s.mediaImg}
              />
            ) : null}
          </div>

          <div>
            <h1 className={s.title}>{product.name}</h1>
            <p className={s.price}>{formatShopPrice(product.priceCents, product.currency)}</p>

            {paragraphs.map((text, i) => (
              <p key={i} className={s.body}>
                {text}
              </p>
            ))}

            {paused ? (
              <p role="status" className={s.paused}>
                Webshoppen är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
              </p>
            ) : (
              <div className={s.buy}>
                <AddToCart product={product} fulfilment={config.fulfilment} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
