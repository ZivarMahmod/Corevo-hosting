'use client'

// Webshop add-to-cart-kontroll (köp-räls, goal-49). Ersätter den parkerade ShopCta
// när shoppen är LIVE: variantval (om >1), qty-stepper (ej fri textruta — Baymard),
// add-knapp med feedback. Klient-pur: importerar bara pure types + useCart (ingen
// server-only). Lägger raden i klient-varukorgen; ordern föds vid kassa-start.

import { useEffect, useRef, useState } from 'react'
import { useCart } from './CartProvider'
import {
  shopCtaLabel,
  formatShopPrice,
  type ShopFulfilment,
  type ShopProduct,
} from '@/lib/storefront/shop/types'

export function AddToCart({
  product,
  fulfilment,
}: {
  product: ShopProduct
  fulfilment: ShopFulfilment
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
    return (
      <div style={{ marginTop: 12, fontFamily: 'var(--font-ui)', fontSize: 13, opacity: 0.6 }}>
        Tillfälligt otillgänglig
      </div>
    )
  }

  // (b) Varianter finns men ALLA är slut → disabled "Slutsåld"-knapp, inget
  // variantval/stepper (det finns inget köpbart att välja).
  if (allSoldOut) {
    return (
      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          disabled
          aria-label={`${product.name} — slutsåld`}
          style={{
            width: '100%',
            padding: '10px 16px',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.01em',
            cursor: 'not-allowed',
            color: 'var(--color-fg, #232520)',
            background: 'color-mix(in srgb, var(--color-fg, #232520) 8%, transparent)',
            border: '1px solid var(--color-accent, #C8A24A)',
            borderRadius: 'var(--radius, 4px)',
            opacity: 0.6,
          }}
        >
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

  const stepBtn: React.CSSProperties = {
    width: 34,
    height: 34,
    fontSize: 16,
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
    border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 18%, transparent)',
    background: 'transparent',
    color: 'var(--color-fg, #232520)',
    borderRadius: 'var(--radius, 4px)',
    lineHeight: 1,
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {variants.length > 1 ? (
        <select
          value={variantId}
          onChange={(e) => {
            setVariantId(e.target.value)
            setQty(1)
          }}
          aria-label={`Välj variant för ${product.name}`}
          style={{
            padding: '8px 10px',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            color: 'var(--color-fg, #232520)',
            background: 'var(--color-bg, #fff)',
            border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 18%, transparent)',
            borderRadius: 'var(--radius, 4px)',
          }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" aria-label="Minska antal" style={stepBtn} onClick={() => setQty((q) => Math.max(1, q - 1))}>
            −
          </button>
          <span aria-live="polite" style={{ minWidth: 24, textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 14 }}>
            {qty}
          </span>
          <button
            type="button"
            aria-label="Öka antal"
            style={{ ...stepBtn, opacity: maxQty != null && qty >= maxQty ? 0.4 : 1 }}
            disabled={maxQty != null && qty >= maxQty}
            onClick={() => setQty((q) => (maxQty != null ? Math.min(maxQty, q + 1) : q + 1))}
          >
            +
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={add}
        disabled={soldOut}
        aria-label={soldOut ? `${product.name} — slutsåld` : `${label} — ${product.name}`}
        style={{
          width: '100%',
          padding: '10px 16px',
          fontFamily: 'var(--font-ui)',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.01em',
          cursor: soldOut ? 'not-allowed' : 'pointer',
          color: soldOut ? 'var(--color-fg, #232520)' : 'var(--color-bg, #fff)',
          background: soldOut
            ? 'color-mix(in srgb, var(--color-fg, #232520) 8%, transparent)'
            : 'var(--color-accent, #C8A24A)',
          border: '1px solid var(--color-accent, #C8A24A)',
          borderRadius: 'var(--radius, 4px)',
          opacity: soldOut ? 0.6 : 1,
          transition: 'opacity 120ms ease',
        }}
      >
        {soldOut ? 'Slutsåld' : added ? 'Tillagd ✓' : label}
      </button>

      {added ? (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            padding: '8px 12px',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            color: 'var(--color-fg, #232520)',
            background: 'color-mix(in srgb, var(--color-accent, #C8A24A) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-accent, #C8A24A) 45%, transparent)',
            borderRadius: 'var(--radius, 4px)',
          }}
        >
          <span>Tillagd i varukorgen</span>
          <a
            href="/varukorg"
            style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline', whiteSpace: 'nowrap' }}
          >
            till varukorgen
          </a>
        </div>
      ) : null}
    </div>
  )
}
