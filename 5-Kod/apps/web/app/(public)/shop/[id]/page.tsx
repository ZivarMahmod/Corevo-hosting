import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { AddToCart } from '@/components/storefront/shop/AddToCart'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import { loadShopProduct } from '@/lib/storefront/shop/load-shop'

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
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <section className="section" data-module="shop">
      <div className="section-inner">
        <p style={{ margin: '0 0 24px' }}>
          <Link
            href="/shop"
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--color-primary, #232520)',
              textDecoration: 'none',
              borderBottom: '1px solid var(--color-primary, #232520)',
              paddingBottom: 2,
            }}
          >
            ← Hela butiken
          </Link>
        </p>

        <div
          style={{
            display: 'grid',
            gap: 32,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            alignItems: 'start',
          }}
        >
          <div
            style={{
              aspectRatio: '4 / 3',
              background: 'color-mix(in srgb, var(--color-fg, #232520) 6%, transparent)',
              borderRadius: 'calc(var(--radius, 4px) * 2)',
              overflow: 'hidden',
            }}
          >
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.imageAlt ?? product.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : null}
          </div>

          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: 'var(--font-display, var(--font-body))',
                fontSize: 32,
                lineHeight: 1.15,
                color: 'var(--color-fg, #232520)',
              }}
            >
              {product.name}
            </h1>
            <p
              style={{
                margin: '12px 0 0',
                fontFamily: 'var(--font-ui)',
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--color-fg, #232520)',
              }}
            >
              {formatShopPrice(product.priceCents, product.currency)}
            </p>

            {paragraphs.map((text, i) => (
              <p
                key={i}
                style={{
                  margin: '16px 0 0',
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: 'color-mix(in srgb, var(--color-fg, #232520) 72%, transparent)',
                }}
              >
                {text}
              </p>
            ))}

            {paused ? (
              <p
                role="status"
                style={{
                  marginTop: 20,
                  fontFamily: 'var(--font-ui)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--color-fg, #232520)',
                  background: 'color-mix(in srgb, var(--color-accent, #C8A24A) 14%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-accent, #C8A24A) 30%, transparent)',
                  borderRadius: 'var(--radius, 4px)',
                  padding: '10px 14px',
                }}
              >
                Webshoppen är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
              </p>
            ) : (
              <div style={{ marginTop: 12 }}>
                <AddToCart product={product} fulfilment={config.fulfilment} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
