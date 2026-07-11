'use client'

// Varukorgen som EGEN SIDA (goal-57 körning 11) — ersätter CartDrawer:n som
// renderades inne i navens fixed-lager (stacking-context-bugg: z-index 70 gällde
// bara inom nav-lagret 40, så sidinnehåll kunde rendera OVANPÅ korgen). Layout
// efter fruitkha-mönstret: radlista (bild/namn/antal-stepper/ta bort/radtotal)
// + summeringspanel med "Till kassan". Klient-pur (useCart + pure helpers).
// Frakt/moms beräknas i kassan (server-side) precis som förr.

import Link from 'next/link'
import { useCart } from './CartProvider'
import { formatShopPrice } from '@/lib/storefront/shop/types'

export function CartPageContents() {
  const { lines, subtotalCents, setQty, removeLine } = useCart()
  const currency = lines[0]?.currency ?? 'SEK'

  if (lines.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <p style={{ margin: '0 0 20px', fontFamily: 'var(--font-ui)', fontSize: 15, opacity: 0.7 }}>
          Varukorgen är tom.
        </p>
        <Link
          href="/shop"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            fontFamily: 'var(--font-ui)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-bg, #fff)',
            background: 'var(--color-accent, #C8A24A)',
            borderRadius: 'var(--radius, 4px)',
            textDecoration: 'none',
          }}
        >
          Till butiken
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
      {/* Radlistan */}
      <div style={{ flex: '1 1 380px', minWidth: 0 }}>
        {lines.map((l) => (
          <div
            key={l.variantId}
            style={{
              display: 'flex',
              gap: 16,
              padding: '18px 0',
              borderBottom: '1px solid color-mix(in srgb, var(--color-fg, #232520) 10%, transparent)',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
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
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 600 }}>{l.productName}</div>
              {l.variantName && l.variantName !== 'Standard' ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>{l.variantName}</div>
              ) : null}
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>
                {formatShopPrice(l.priceCents, l.currency)} / st
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" aria-label="Minska" onClick={() => setQty(l.variantId, l.quantity - 1)} style={stepBtn}>
                  −
                </button>
                <span style={{ minWidth: 24, textAlign: 'center', fontSize: 14 }}>{l.quantity}</span>
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
                  style={{
                    marginLeft: 12,
                    border: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    color: 'inherit',
                    opacity: 0.7,
                  }}
                >
                  Ta bort
                </button>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {formatShopPrice(l.priceCents * l.quantity, l.currency)}
            </div>
          </div>
        ))}
        <p style={{ margin: '16px 0 0', fontSize: 13 }}>
          <Link href="/shop" style={{ color: 'inherit', textDecoration: 'underline', opacity: 0.75 }}>
            ← Fortsätt handla
          </Link>
        </p>
      </div>

      {/* Summeringspanelen (fruitkha total-section) */}
      <aside
        style={{
          flex: '0 1 300px',
          padding: '22px 24px',
          background: 'color-mix(in srgb, var(--color-fg, #232520) 4%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 10%, transparent)',
          borderRadius: 'var(--radius, 4px)',
        }}
      >
        <h2 style={{ margin: '0 0 14px', fontFamily: 'var(--font-display, var(--font-body))', fontSize: 20 }}>
          Summering
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700 }}>
          <span>Delsumma</span>
          <span>{formatShopPrice(subtotalCents, currency)}</span>
        </div>
        <p style={{ margin: '6px 0 18px', fontSize: 12, opacity: 0.6 }}>Frakt och moms beräknas i kassan.</p>
        <Link
          href="/kassa"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '13px 16px',
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
      </aside>
    </div>
  )
}

const stepBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  fontSize: 15,
  cursor: 'pointer',
  border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 18%, transparent)',
  background: 'transparent',
  color: 'inherit',
  borderRadius: 'var(--radius, 4px)',
  lineHeight: 1,
}
