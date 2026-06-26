'use client'

// Orderbekräftelse-vy (client). Läser session-token ur localStorage och hämtar
// ordern token-gatat (getShopOrder → get_public_shop_order). Visar kvitto: rader,
// total, kund, leveransadress + ärlig betal-status. Ingen fejk-admin, riktiga data.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getShopOrder, type PublicShopOrder } from '../../actions'
import { formatShopPrice } from '@/lib/storefront/shop/types'

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
    return <p style={{ fontFamily: 'var(--font-body)' }}>Hämtar din beställning…</p>
  }

  if (state === 'missing' || !order) {
    return (
      <div>
        <h1 style={{ fontFamily: 'var(--font-display, var(--font-body))', fontSize: 26 }}>Beställning</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 16 }}>
          Vi kunde inte visa den här beställningen i den här webbläsaren. Kontrollera bekräftelsemejlet.
        </p>
        <Link href="/" style={{ color: 'var(--color-accent, #C8A24A)' }}>← Tillbaka till butiken</Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 44, lineHeight: 1 }}>✓</div>
        <h1 style={{ fontFamily: 'var(--font-display, var(--font-body))', fontSize: 28, margin: '12px 0 4px' }}>
          Tack för din beställning!
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, opacity: 0.7 }}>
          Beställning #{order.id.slice(0, 8)} · {STATUS_LABEL[order.status] ?? order.status}
        </p>
      </div>

      <div
        style={{
          padding: 20,
          background: 'color-mix(in srgb, var(--color-fg, #232520) 3%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 10%, transparent)',
          borderRadius: 'calc(var(--radius, 4px) * 2)',
        }}
      >
        {order.items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '5px 0' }}>
            <span>
              {it.product_name} × {it.quantity}
            </span>
            <span>{formatShopPrice(it.unit_price_cents * it.quantity, order.currency)}</span>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid color-mix(in srgb, var(--color-fg, #232520) 12%, transparent)',
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          <span>Totalt</span>
          <span>{formatShopPrice(order.total_cents, order.currency)}</span>
        </div>
      </div>

      <div style={{ marginTop: 20, fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.6 }}>
        {order.customer_name ? <div>{order.customer_name}</div> : null}
        {order.customer_email ? <div style={{ opacity: 0.75 }}>{order.customer_email}</div> : null}
        {order.ship_address ? <div style={{ opacity: 0.75 }}>{order.ship_address}</div> : null}
        <p style={{ marginTop: 12, opacity: 0.6, fontSize: 13 }}>
          {order.payment_status === 'paid' ? 'Betald.' : 'Betalas vid leverans/upphämtning.'}
        </p>
      </div>

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <Link href="/" style={{ color: 'var(--color-accent, #C8A24A)', fontFamily: 'var(--font-ui)', fontSize: 14 }}>
          ← Fortsätt handla
        </Link>
      </div>
    </div>
  )
}
