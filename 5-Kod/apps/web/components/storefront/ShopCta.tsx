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

import { useState } from 'react'
import { shopCtaLabel, type ShopFulfilment } from '@/lib/storefront/shop/types'

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
      style={{
        marginTop: 12,
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
  )
}
