// Webshop storefront SECTION (multi-bransch spår 5, §15 skelett vs skin).
//
// SERVER component. The SECTION reads module data (products + resolved config via
// loadShopData); the TEMPLATE/skin gives the look. Per §15: "funktioner bor i
// MODULEN, inte i mallen" — this section IS the shop module's storefront surface,
// injected at the module's default_section_position ('main', per 0031). It styles
// itself with the storefront design tokens (var(--color-*) / var(--font-*)), the
// same token-driven approach as ModulePausedBanner — no new palette, so it blends
// into whichever skin the tenant runs.
//
// GATING (caller contract): render this ONLY when the tenant's shop module is
// LIVE. The call site (storefront page/layout) resolves tenant_modules.state via
// getTenantModuleStates() + isModuleLive(states,'shop') and renders <ShopSection>
// only then — EXACTLY the booking gate shape in app/(public)/layout.tsx. draft/off
// never reach here; a PAUSED shop renders the section read-only (CTAs become a
// "stängt"-state) — same contract as the booking paused banner.
//
// FULFILMENT VARIANTS (config-first, beslut 14.5): the section behaves per the
// resolved variant via the pure helpers in lib/storefront/shop/types.ts:
//   ship                 → "Posta hem" promise; CTA "Lägg i kundvagn".
//   pickup_within_days   → "Hämta i butik inom X dagar"; CTA "Reservera …".
//   order_in_then_pickup → "Beställ hem till butik …"; CTA "Beställ till butik".
// No `if (bransch)` anywhere — only the variant drives the difference.
//
// BETAL-RAILS PAUSADE (beslut 14.2): no price-checkout, no pay step. ShopCta is an
// inert interaction shell; orders/payment are wired only when rails open.

import { SectionHeader, SubpageHero } from './sections'
import { AddToCart } from './shop/AddToCart'
import s from './shop-section.module.css'
import {
  fulfilmentPromise,
  formatShopPrice,
  SHOP_FULFILMENT_LABELS,
  type ShopData,
} from '@/lib/storefront/shop/types'
import { loadShopData } from '@/lib/storefront/shop/load-shop'

/** Resolve + render the shop section for one tenant. Returns null when there is
 *  nothing to show (no shop module row) so the caller can compose unconditionally.
 *  `paused` renders the catalog read-only with a closed-notice instead of CTAs. */
export async function ShopSection({
  tenantId,
  slug,
  paused = false,
  limit,
  moreHref,
  pageHero = false,
}: {
  tenantId: string
  slug: string
  /** true when tenant_modules.state='shop' is 'paused' → catalog visible, closed. */
  paused?: boolean
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
  if (typeof limit === 'number' && allProducts.length === 0 && !paused) return null

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

        {paused ? (
          <p role="status" className={s.notice}>
            Webshoppen är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
          </p>
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
                    <p className={s.price}>{formatShopPrice(p.priceCents, p.currency)}</p>
                    {/* Köp-räls (goal-49): live shop → variant-medveten add-to-cart;
                        'paused' utelämnar CTA helt (katalogen läses som stängd). */}
                    {paused ? null : (
                      <div className={s.cta}>
                        <AddToCart product={p} fulfilment={config.fulfilment} compact />
                      </div>
                    )}
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
