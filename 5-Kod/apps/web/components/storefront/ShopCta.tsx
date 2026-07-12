'use client'

// Webshop add-to-cart / reserve CTA (multi-bransch spår 5). Client component so a
// product card (rendered by the server ShopSection) gets an interactive button.
//
// CLIENT/SERVER BOUNDARY (the rule that crashes next build if broken): this file
// imports ONLY from lib/storefront/shop/types.ts — a PURE module with no
// 'server-only' import. It must never reach the loader (load-shop.ts uses the
// Supabase client) or any server module. Types + the pure label helper only.
//
// BETAL-RAILS PAUSADE (beslut 14.2): this button does NOT take payment and does
// NOT post an order. It is the interaction SHELL — variant-aware label + an inert
// confirm affordance — wired to a real cart/checkout only when rails open. The
// onAdd hook is intentionally a no-op placeholder (logs in dev) so the storefront
// renders a complete, honest shop surface without any money flow.

// goal-60: formen bor nu i shop/add-to-cart.module.css — ANATOMIN ÄR DENSAMMA som den
// riktiga köpknappens (full bredd, sex lägen), så den återanvänder .buy i stället för att
// få en egen fil som snart divergerar. Var 1 inline style={{}} med `opacity: soldOut ?
// .6 : 1` — vilket tog knapptexten under kontrastgolvet i exakt det läge där den behövde
// vara läsbar. .buy:disabled löser slutsåld med MÄTTA färger i stället.

import { useState } from 'react'
import { shopCtaLabel, type ShopFulfilment } from '@/lib/storefront/shop/types'
import styles from './shop/add-to-cart.module.css'

export function ShopCta({
  fulfilment,
  productId,
  productName,
  soldOut = false,
}: {
  fulfilment: ShopFulfilment
  productId: string
  productName: string
  soldOut?: boolean
}) {
  const [added, setAdded] = useState(false)
  const label = shopCtaLabel(fulfilment)

  const onClick = () => {
    if (soldOut) return
    // PARKED: no cart, no order, no payment (rails paused). Acknowledge locally so
    // the affordance feels alive; real cart/checkout is a follow-up once rails open.
    setAdded(true)
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[shop] CTA (parked, no order placed):', { productId, productName, fulfilment })
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soldOut}
      aria-label={soldOut ? `${productName} — slutsåld` : `${label} — ${productName}`}
      className={`${styles.buy} ${styles.buySolo}`}
    >
      {soldOut ? 'Slutsåld' : added ? 'Tillagd ✓' : label}
    </button>
  )
}
