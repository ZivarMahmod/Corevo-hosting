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

import { SectionHeader } from './sections'
import { AddToCart } from './shop/AddToCart'
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
}: {
  tenantId: string
  slug: string
  /** true when tenant_modules.state='shop' is 'paused' → catalog visible, closed. */
  paused?: boolean
  /** Teaser-läge (startsidan): visa max så här många produkter. */
  limit?: number
  /** Länk till modulens EGEN sida ("Visa hela butiken →") — visas när något klipps. */
  moreHref?: string
}) {
  const data: ShopData | null = await loadShopData(tenantId, slug)
  if (!data) return null

  const { config, products: allProducts } = data
  const products = typeof limit === 'number' ? allProducts.slice(0, limit) : allProducts
  const clipped = products.length < allProducts.length

  return (
    <section className="section" data-module="shop" data-fulfilment={config.fulfilment}>
      <div className="section-inner">
        <SectionHeader
          eyebrow={`— Webshop · ${SHOP_FULFILMENT_LABELS[config.fulfilment]}`}
          title="Handla hos oss"
          lead={fulfilmentPromise(config)}
        />

        {paused ? (
          <p
            role="status"
            style={{
              marginTop: 8,
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
        ) : null}

        {products.length === 0 ? (
          <p
            style={{
              marginTop: 16,
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'color-mix(in srgb, var(--color-fg, #232520) 70%, transparent)',
            }}
          >
            Produkter visas snart.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: '28px 0 0',
              padding: 0,
              display: 'grid',
              gap: 24,
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            }}
          >
            {products.map((p) => {
              return (
                <li
                  key={p.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'color-mix(in srgb, var(--color-fg, #232520) 3%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 10%, transparent)',
                    borderRadius: 'calc(var(--radius, 4px) * 2)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      aspectRatio: '4 / 3',
                      background: 'color-mix(in srgb, var(--color-fg, #232520) 6%, transparent)',
                    }}
                  >
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.imageAlt ?? p.name}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : null}
                  </div>
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-display, var(--font-body))',
                        fontSize: 17,
                        color: 'var(--color-fg, #232520)',
                      }}
                    >
                      {p.name}
                    </h3>
                    {p.description ? (
                      <p
                        style={{
                          margin: '6px 0 0',
                          fontFamily: 'var(--font-body)',
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: 'color-mix(in srgb, var(--color-fg, #232520) 72%, transparent)',
                        }}
                      >
                        {p.description}
                      </p>
                    ) : null}
                    <p
                      style={{
                        margin: '12px 0 0',
                        fontFamily: 'var(--font-ui)',
                        fontSize: 16,
                        fontWeight: 700,
                        color: 'var(--color-fg, #232520)',
                      }}
                    >
                      {formatShopPrice(p.priceCents, p.currency)}
                    </p>
                    {/* Köp-räls (goal-49): live shop → variant-medveten add-to-cart;
                        'paused' utelämnar CTA helt (katalogen läses som stängd). */}
                    {paused ? null : (
                      <div style={{ marginTop: 'auto' }}>
                        <AddToCart product={p} fulfilment={config.fulfilment} />
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {moreHref && (clipped || typeof limit === 'number') && allProducts.length > 0 ? (
          <p style={{ margin: '24px 0 0' }}>
            <a
              href={moreHref}
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
              Visa hela butiken →
            </a>
          </p>
        ) : null}
      </div>
    </section>
  )
}
