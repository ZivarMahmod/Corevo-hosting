'use client'

// Orderbekräftelse-vy (client). Läser session-token ur localStorage och hämtar
// ordern token-gatat (getShopOrder → get_public_shop_order). Visar kvitto: rader,
// total, kund, leveransadress + ärlig betal-status. Ingen fejk-admin, riktiga data.
//
// goal-60: formen bor i order-confirmation.module.css (var 17 inline style={{}}).
// Inline kunde inte bära :hover/:focus-visible och ingen MALL kunde nå in — kvittot,
// sista intrycket av hela köpet, var därför alltid plattformsgrått. Funktionen här är
// oförändrad: samma token-gate, samma hämtning, samma STATUS_LABEL, samma belopp.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getShopOrder, type PublicShopOrder } from '../../actions'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import styles from '@/components/storefront/order-confirmation.module.css'

const TOKEN_KEY = 'corevo-shop-token'

const STATUS_LABEL: Record<string, string> = {
  reserved: 'Reserverad',
  awaiting_payment: 'Väntar på betalning',
  pending: 'Mottagen',
  confirmed: 'Bekräftad',
  ready: 'Klar att hämta',
  completed: 'Slutförd',
  cancelled: 'Avbruten',
  expired: 'Utgången',
}

export function OrderConfirmation({ orderId }: { orderId: string }) {
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
          Vi kunde inte visa den här beställningen i den här webbläsaren. Kontrollera bekräftelsemejlet.
        </p>
        <Link href="/" className={styles.backLink}>
          ← Tillbaka till butiken
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className={styles.head}>
        <div className={styles.mark} aria-hidden="true">
          ✓
        </div>
        <h1 className={styles.title}>Tack för din beställning!</h1>
        <p className={styles.meta}>
          Beställning #{order.id.slice(0, 8)} · {STATUS_LABEL[order.status] ?? order.status}
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
        <div className={styles.total}>
          <span>Totalt</span>
          <span className={styles.totalAmount}>{formatShopPrice(order.total_cents, order.currency)}</span>
        </div>
      </div>

      <div className={styles.details}>
        {order.customer_name ? <div className={styles.detailsName}>{order.customer_name}</div> : null}
        {order.customer_email ? <div className={styles.detailsMuted}>{order.customer_email}</div> : null}
        {order.ship_address ? <div className={styles.detailsMuted}>{order.ship_address}</div> : null}
        <p className={styles.payment}>
          {order.payment_status === 'paid' ? 'Betald.' : 'Betalas vid leverans/upphämtning.'}
        </p>
      </div>

      <div className={styles.actions}>
        <Link href="/" className={styles.cta}>
          ← Fortsätt handla
        </Link>
      </div>
    </div>
  )
}
