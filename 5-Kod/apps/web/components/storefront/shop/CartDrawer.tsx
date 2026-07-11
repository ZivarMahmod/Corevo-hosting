'use client'

// Delad varukorgs-drawer (goal-55 körning 7B). Slide-over från höger med rader
// (qty-steppers + ta bort), delsumma och "Till kassan" → /kassa. Ägs INTE av någon
// enskild knapp: både navens CartNavButton (temade sajter) och den flytande
// CartButton-bollen (look-vägen) monterar den med eget open-state. Klient-pur
// (useCart + pure helpers). Full kostnad visas i kassan (frakt/moms server-side).

import Link from 'next/link'
import { useCart } from './CartProvider'
import { formatShopPrice } from '@/lib/storefront/shop/types'

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, subtotalCents, setQty, removeLine } = useCart()
  if (!open) return null

  const currency = lines[0]?.currency ?? 'SEK'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Varukorg"
      style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', justifyContent: 'flex-end' }}
    >
      <button
        type="button"
        aria-label="Stäng varukorg"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer' }}
      />
      <aside
        style={{
          position: 'relative',
          width: 'min(420px, 92vw)',
          height: '100%',
          background: 'var(--color-bg, #fff)',
          color: 'var(--color-fg, #232520)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 30px rgba(0,0,0,0.2)',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            borderBottom: '1px solid color-mix(in srgb, var(--color-fg, #232520) 12%, transparent)',
          }}
        >
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display, var(--font-body))', fontSize: 20 }}>Varukorg</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Stäng"
            style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer', color: 'inherit', lineHeight: 1 }}
          >
            ×
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
          {lines.length === 0 ? (
            <p style={{ margin: '18px 0', fontFamily: 'var(--font-ui)', fontSize: 14, opacity: 0.7 }}>
              Varukorgen är tom.
            </p>
          ) : null}
          {lines.map((l) => (
            <div
              key={l.variantId}
              style={{
                display: 'flex',
                gap: 12,
                padding: '14px 0',
                borderBottom: '1px solid color-mix(in srgb, var(--color-fg, #232520) 8%, transparent)',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  flexShrink: 0,
                  borderRadius: 'var(--radius, 4px)',
                  overflow: 'hidden',
                  background: 'color-mix(in srgb, var(--color-fg, #232520) 6%, transparent)',
                }}
              >
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt={l.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600 }}>{l.productName}</div>
                {l.variantName && l.variantName !== 'Standard' ? (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{l.variantName}</div>
                ) : null}
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" aria-label="Minska" onClick={() => setQty(l.variantId, l.quantity - 1)} style={stepBtn}>
                    −
                  </button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontSize: 13 }}>{l.quantity}</span>
                  <button
                    type="button"
                    aria-label="Öka"
                    disabled={l.maxQty != null && l.quantity >= l.maxQty}
                    onClick={() => setQty(l.variantId, l.quantity + 1)}
                    style={{ ...stepBtn, opacity: l.maxQty != null && l.quantity >= l.maxQty ? 0.4 : 1 }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLine(l.variantId)}
                    style={{ marginLeft: 'auto', border: 'none', background: 'transparent', fontSize: 12, textDecoration: 'underline', cursor: 'pointer', color: 'inherit', opacity: 0.7 }}
                  >
                    Ta bort
                  </button>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {formatShopPrice(l.priceCents * l.quantity, l.currency)}
              </div>
            </div>
          ))}
        </div>

        <footer style={{ padding: '18px 20px', borderTop: '1px solid color-mix(in srgb, var(--color-fg, #232520) 12%, transparent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700 }}>
            <span>Delsumma</span>
            <span>{formatShopPrice(subtotalCents, currency)}</span>
          </div>
          <p style={{ margin: '4px 0 14px', fontSize: 12, opacity: 0.6 }}>Frakt och moms beräknas i kassan.</p>
          <Link
            href="/kassa"
            onClick={onClose}
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px 16px',
              fontFamily: 'var(--font-ui)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-bg, #fff)',
              background: 'var(--color-accent, #C8A24A)',
              borderRadius: 'var(--radius, 4px)',
              textDecoration: 'none',
            }}
          >
            Till kassan
          </Link>
        </footer>
      </aside>
    </div>
  )
}

const stepBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  fontSize: 14,
  cursor: 'pointer',
  border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 18%, transparent)',
  background: 'transparent',
  color: 'inherit',
  borderRadius: 'var(--radius, 4px)',
  lineHeight: 1,
}
