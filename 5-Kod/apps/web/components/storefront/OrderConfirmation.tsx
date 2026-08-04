'use client'

// Ordern hämtas med webbläsarens session-token och visar aldrig en annan kunds kvitto.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getShopOrder, type PublicShopOrder } from '@/lib/storefront/shop/actions'
import {
  formatShopPrice,
  formatShippingPrice,
  paymentMethodSpec,
  PUBLIC_ORDER_STATUS_LABELS,
} from '@/lib/storefront/shop/types'
import styles from '@/components/storefront/order-confirmation.module.css'

const TOKEN_KEY = 'corevo-shop-token'

export function OrderConfirmation({
  orderId,
  // Temat äger prefixet; plattformen äger ordernumret.
  orderPrefix = '#',
}: {
  orderId: string
  orderPrefix?: string
}) {
  const [order, setOrder] = useState<PublicShopOrder | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing'>('loading')

  useEffect(() => {
    let token = ''
    try {
      token = localStorage.getItem(TOKEN_KEY) ?? ''
    } catch {
      token = ''
    }
    if (!token) {
      setState('missing')
      return
    }
    getShopOrder(orderId, token)
      .then((o) => {
        if (o) {
          setOrder(o)
          setState('ok')
        } else {
          setState('missing')
        }
      })
      .catch(() => setState('missing'))
  }, [orderId])

  if (state === 'loading') {
    return (
      <p className={styles.loading} role="status">
        Hämtar din beställning…
      </p>
    )
  }

  // Ingen order i DEN HÄR webbläsaren är inte ett FEL — kvittot ligger i mejlet.
  // Vyn läser därför som en upplysning, aldrig som en krasch.
  if (state === 'missing' || !order) {
    return (
      <div>
        <h1 className={styles.title}>Beställning</h1>
        <p className={styles.lead}>
          Vi kunde inte visa den här beställningen i den här webbläsaren. Kontrollera
          bekräftelsemejlet.
        </p>
        <Link href="/shop" className={styles.backLink}>
          ← Tillbaka till butiken
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.head}>
        <div className={styles.mark} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path className={styles.markPath} d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h1 className={styles.title}>Tack för din beställning!</h1>
        {/* Äldre ordrar utan order_no faller tillbaka på en kort del av sitt verkliga id. */}
        <p className={styles.meta}>
          Beställning{' '}
          {order.order_no ? `${orderPrefix}${order.order_no}` : `#${order.id.slice(0, 8)}`} ·{' '}
          {PUBLIC_ORDER_STATUS_LABELS[order.status] ?? order.status}
        </p>
      </div>

      <div className={styles.panel}>
        {order.items.map((it, i) => (
          <div key={i} className={styles.line}>
            <span>
              {it.product_name} × {it.quantity}
            </span>
            <span className={styles.lineAmount}>
              {formatShopPrice(it.unit_price_cents * it.quantity, order.currency)}
            </span>
          </div>
        ))}
        <div className={styles.line}>
          <span>Delsumma</span>
          <span className={styles.lineAmount}>
            {formatShopPrice(order.subtotal_cents, order.currency)}
          </span>
        </div>
        {order.shipping_cents > 0 || order.shipping_name ? (
          <div className={styles.line}>
            <span>{order.shipping_name ?? 'Leverans'}</span>
            <span className={styles.lineAmount}>
              {formatShippingPrice(order.shipping_cents, order.currency)}
            </span>
          </div>
        ) : null}
        {order.discount_cents > 0 ? (
          <div className={styles.line}>
            <span>Rabatt</span>
            <span className={styles.lineAmount}>
              −{formatShopPrice(order.discount_cents, order.currency)}
            </span>
          </div>
        ) : null}
        {order.tax_cents > 0 ? (
          <div className={styles.line}>
            <span>Moms</span>
            <span className={styles.lineAmount}>
              {formatShopPrice(order.tax_cents, order.currency)}
            </span>
          </div>
        ) : null}
        <div className={styles.total}>
          <span>Totalt</span>
          <span className={styles.totalAmount}>
            {formatShopPrice(order.total_cents, order.currency)}
          </span>
        </div>
      </div>

      <div className={styles.details}>
        {order.customer_name ? (
          <div className={styles.detailsName}>{order.customer_name}</div>
        ) : null}
        {order.customer_email ? (
          <div className={styles.detailsMuted}>{order.customer_email}</div>
        ) : null}
        {order.ship_address ? (
          <div className={styles.detailsMuted}>{order.ship_address}</div>
        ) : null}
        {/* Betal-raden säger VAD kunden valde när vi vet det — annars det gamla,
            ärliga löftet. Aldrig "Betald" på en obetald order. */}
        <p className={styles.payment}>
          {order.payment_status === 'paid'
            ? `Betald${order.payment_method ? ` med ${paymentMethodSpec(order.payment_method)?.label ?? order.payment_method}` : ''}.`
            : order.status === 'awaiting_payment'
              ? 'Väntar på betalning.'
              : 'Betalas vid leverans/upphämtning.'}
        </p>
      </div>

      <div className={styles.actions}>
        <Link href="/shop" className={styles.cta}>
          ← Fortsätt handla
        </Link>
      </div>
    </div>
  )
}
