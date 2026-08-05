// Callers render this section only for a live shop module.

import { SectionHeader, SubpageHero } from './sections'
import { AddToCart } from './shop/AddToCart'
import s from './shop-section.module.css'
import {
  fulfilmentPromise,
  formatProductPrice,
  SHOP_FULFILMENT_LABELS,
  type ShopData,
} from '@/lib/storefront/shop/types'
import { loadShopData } from '@/lib/storefront/shop/load-shop'

/** Resolve + render the shop section for one live tenant module. */
export async function ShopSection({
  tenantId,
  slug,
  limit,
  moreHref,
  pageHero = false,
}: {
  tenantId: string
  slug: string
  /** Teaser-läge (startsidan): visa max så här många produkter. */
  limit?: number
  /** Länk till modulens EGEN sida ("Visa hela butiken →") — visas när något klipps. */
  moreHref?: string
  /** Modulens EGEN sida: fruitkha-hero-bandet i stället för SectionHeader (goal-57). */
  pageHero?: boolean
}) {
  const data: ShopData | null = await loadShopData(tenantId, slug)
  if (!data) return null

  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length
  // Startsidans teaser (limit satt) för en LIVE men TOM butik → rendera inget alls
  // (S12: inga "visas snart"-löften till besökare); modulens egen sida behåller
  // sin vänliga tom-text.
  if (typeof limit === 'number' && allProducts.length === 0) return null

  return (
    <>
      {pageHero ? (
        <SubpageHero
          eyebrow={`— Webshop · ${SHOP_FULFILMENT_LABELS[config.fulfilment]}`}
          title="Handla hos oss"
          lede={fulfilmentPromise(config)}
        />
      ) : null}
    <section className="section" data-module="shop" data-fulfilment={config.fulfilment}>
      <div className="section-inner">
        {!pageHero ? (
          <SectionHeader
            eyebrow={`— Webshop · ${SHOP_FULFILMENT_LABELS[config.fulfilment]}`}
            title="Handla hos oss"
            lead={fulfilmentPromise(config)}
          />
        ) : null}

        {products.length === 0 ? (
          <p className={s.empty}>Produkter visas snart.</p>
        ) : (
          <ul className={s.grid}>
            {products.map((p) => {
              return (
                <li key={p.id} className={s.card}>
                  {/* Länka bild + namn till produktdetaljsidan — INTE hela kortet,
                      så AddToCart-knappen nedanför förblir klickbar (goal-54 S4). */}
                  <a
                    href={`/shop/${p.id}`}
                    aria-label={`${p.name} — visa produkt`}
                    className={s.media}
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.imageAlt ?? p.name}
                        loading="lazy"
                        className={s.img}
                      />
                    ) : null}
                    {/* goal-62 F5: SLUTSÅLD SYNS PÅ VARAN, inte bara på knappen. Förr var
                        enda signalen att köpknappen längst ned var grå — man hann bli
                        intresserad innan man förstod. Badgen sitter på bilden och läser
                        mallens badge-tokens (samma arketyp som korgens räknare). Villkoret
                        är modulens sanning: alla varianter slut (available === 0). */}
                    {p.variants.length > 0 && p.variants.every((v) => v.available === 0) ? (
                      <span className={s.soldOut}>Slutsåld</span>
                    ) : null}
                    {/* goal-61: hover-/fokus-hint — ren affordance-dubblett av länken
                        (aria-label ovan bär redan betydelsen), därför aria-hidden. */}
                    <span className={s.mediaHint} aria-hidden="true">
                      Se produkt
                    </span>
                  </a>
                  <div className={s.body}>
                    <h3 className={s.title}>
                      <a href={`/shop/${p.id}`} className={s.titleLink}>
                        {p.name}
                      </a>
                    </h3>
                    {/* goal-62 E3: BESKRIVNINGEN ÄR BORTA UR GRIDEN. Mätt: den låg som
                        14px brödtext i varje kort och gjorde kortet till en lapp med text
                        på. Griden är ett skyltfönster — namn och pris. Beskrivningen bor
                        på produktsidan, där man faktiskt läser den. */}
                    <p className={s.price}>{formatProductPrice(p)}</p>
                    <div className={s.cta}>
                      <AddToCart product={p} fulfilment={config.fulfilment} compact />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {moreHref && (clipped || typeof limit === 'number') && allProducts.length > 0 ? (
          <p className={s.moreWrap}>
            <a href={moreHref} className={s.more}>
              Visa hela butiken →
            </a>
          </p>
        ) : null}
      </div>
    </section>
    </>
  )
}
