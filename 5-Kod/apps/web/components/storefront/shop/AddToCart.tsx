'use client'

// Webshop add-to-cart-kontroll (köp-räls, goal-49). Ersätter den parkerade ShopCta
// när shoppen är LIVE: variantval (om >1), qty-stepper (ej fri textruta — Baymard),
// add-knapp med feedback. Klient-pur: importerar bara pure types + useCart (ingen
// server-only). Lägger raden i klient-varukorgen; ordern föds vid kassa-start.
//
// goal-60: stilarna bor i add-to-cart.module.css. Tidigare låg de i inline `style={{}}`,
// vilket gjorde :hover/:active/:focus-visible FYSISKT omöjliga — knappen kunde inte
// vara annat än torr. En mall ger den sin själ genom att sätta --sf-btn-* i sitt
// [data-theme]-block; funktionen här rörs aldrig.

import { useEffect, useRef, useState } from 'react'
import { useCart } from './CartProvider'
import { CartToast } from './CartToast'
import {
  shopCtaLabel,
  formatShopPrice,
  type ShopFulfilment,
  type ShopProduct,
} from '@/lib/storefront/shop/types'
import styles from './add-to-cart.module.css'

export function AddToCart({
  product,
  fulfilment,
  /** goal-62 E3 — GRIDEN ÄR ETT SKYLTFÖNSTER, INTE ETT FORMULÄR.
   *  I butiksgriden dolde vi inget: varje kort bar variantväljare + qty-stepper (−/1/+)
   *  + knapp. Fyra kontroller per vara × tolv varor = en vägg av formulär, och exakt det
   *  Zivar kallar post-it-lappen. `compact` lämnar KNAPPEN kvar (ett klick = 1 st i
   *  korgen, precis som hos Interflora) och flyttar antal/variant till produktsidan, där
   *  valet faktiskt hör hemma. Har varan flera varianter leder knappen dit i stället för
   *  att lägga i korgen — man ska aldrig råka köpa fel variant. */
  compact = false,
}: {
  product: ShopProduct
  fulfilment: ShopFulfilment
  compact?: boolean
}) {
  const { addLine } = useCart()
  const variants = product.variants
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '')
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const addedTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (addedTimer.current != null) window.clearTimeout(addedTimer.current)
    },
    [],
  )

  const variant = variants.find((v) => v.id === variantId) ?? variants[0]
  // available: null = ospårat lager (obegränsat, köpbart); 0 = slutsåld (loadern
  // klampar stock − reserved_qty till ≥ 0, se load-shop.ts).
  const allSoldOut = variants.length > 0 && variants.every((v) => v.available === 0)
  const soldOut = !variant || variant.available === 0
  const maxQty = variant?.available ?? null
  const label = shopCtaLabel(fulfilment)

  // (a) Inga varianter alls → ärligt otillgänglig (sällsynt efter DB-backfill).
  if (variants.length === 0) {
    return <div className={styles.unavailable}>Tillfälligt otillgänglig</div>
  }

  // (b) Varianter finns men ALLA är slut → disabled "Slutsåld"-knapp, inget
  // variantval/stepper (det finns inget köpbart att välja).
  if (allSoldOut) {
    return (
      <div className={styles.wrap}>
        <button type="button" className={styles.buy} disabled aria-label={`${product.name} — slutsåld`}>
          Slutsåld
        </button>
      </div>
    )
  }

  const add = () => {
    if (!variant || soldOut) return
    addLine(
      {
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        variantName: variant.name,
        priceCents: variant.priceCents,
        currency: variant.currency,
        imageUrl: variant.imageUrl ?? product.imageUrl,
        maxQty: variant.available,
      },
      qty,
    )
    // goal-55 7B: add-feedback — inline-flyout under knappen (~4 s) med länk till
    // kassan; navens korg-badge uppdateras samtidigt via useCart.
    setAdded(true)
    if (addedTimer.current != null) window.clearTimeout(addedTimer.current)
    addedTimer.current = window.setTimeout(() => setAdded(false), 4000)
  }

  // Kompakt (butiksgriden): EN knapp. Flera varianter → knappen leder till produktsidan,
  // där valet görs; en variant → ett klick lägger 1 st i korgen.
  if (compact) {
    return variants.length > 1 ? (
      <a href={`/shop/${product.id}`} className={styles.buy}>
        Välj variant
      </a>
    ) : (
      <div className={styles.wrap}>
        <button type="button" className={styles.buy} onClick={add}>
          {added ? 'Tillagd ✓' : 'Lägg i kundvagn'}
        </button>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      {variants.length > 1 ? (
        <select
          className={styles.variant}
          value={variantId}
          onChange={(e) => {
            setVariantId(e.target.value)
            setQty(1)
          }}
          aria-label={`Välj variant för ${product.name}`}
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id} disabled={v.available === 0}>
              {v.name} — {formatShopPrice(v.priceCents, v.currency)}
              {v.available === 0 ? ' (slut)' : ''}
            </option>
          ))}
        </select>
      ) : null}

      {!soldOut ? (
        <div className={styles.qtyRow}>
          <button
            type="button"
            className={styles.step}
            aria-label="Minska antal"
            disabled={qty <= 1}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span aria-live="polite" className={styles.qtyValue}>
            {qty}
          </span>
          <button
            type="button"
            className={styles.step}
            aria-label="Öka antal"
            disabled={maxQty != null && qty >= maxQty}
            onClick={() => setQty((q) => (maxQty != null ? Math.min(maxQty, q + 1) : q + 1))}
          >
            +
          </button>
        </div>
      ) : null}

      <button
        type="button"
        className={styles.buy}
        onClick={add}
        disabled={soldOut}
        aria-label={soldOut ? `${product.name} — slutsåld` : `${label} — ${product.name}`}
      >
        {soldOut ? 'Slutsåld' : added ? 'Tillagd ✓' : label}
      </button>

      {/* goal-61: kvittot är ett riktigt kort (vara + pris + väg vidare), portalerat till
          body — inte längre en textremsa nedklämd i produktkortet. */}
      {added && variant ? (
        <CartToast
          productName={product.name}
          variantName={variants.length > 1 ? variant.name : null}
          priceLabel={formatShopPrice(variant.priceCents * qty, variant.currency)}
          onClose={() => setAdded(false)}
        />
      ) : null}
    </div>
  )
}
