'use client'

// Varukorgen som EGEN SIDA (goal-57 körning 11) — ersätter CartDrawer:n som
// renderades inne i navens fixed-lager (stacking-context-bugg: z-index 70 gällde
// bara inom nav-lagret 40, så sidinnehåll kunde rendera OVANPÅ korgen). Layout
// efter fruitkha-mönstret: radlista (bild/namn/antal-stepper/ta bort/radtotal)
// + summeringspanel med "Till kassan". Klient-pur (useCart + pure helpers).
// Frakt/moms beräknas i kassan (server-side) precis som förr.
//
// goal-60: all styling flyttad till cart.module.css. Inline `style={{}}` kunde inte
// bära :hover/:active/:focus-visible och kunde inte nås av en mall — varukorgen var
// omöjlig att göra fin. FORMEN flyttade, FUNKTIONEN står orörd.

import Link from 'next/link'
import { useCart } from './CartProvider'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import s from './cart.module.css'

export function CartPageContents() {
  const { lines, subtotalCents, setQty, removeLine } = useCart()
  const currency = lines[0]?.currency ?? 'SEK'

  if (lines.length === 0) {
    return (
      <div className={s.empty}>
        <p className={s.emptyText}>Varukorgen är tom.</p>
        <Link href="/shop" className={`${s.cta} ${s.ctaInline}`}>
          Till butiken
        </Link>
      </div>
    )
  }

  return (
    <div className={s.wrap}>
      {/* Radlistan */}
      <div className={s.lines}>
        {lines.map((l) => {
          const atMax = l.maxQty != null && l.quantity >= l.maxQty
          return (
            <div key={l.variantId} className={s.row}>
              <div className={s.thumb}>
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt={l.productName} className={s.thumbImg} />
                ) : null}
              </div>
              <div className={s.body}>
                <div className={s.name}>{l.productName}</div>
                {l.variantName && l.variantName !== 'Standard' ? (
                  <div className={s.variant}>{l.variantName}</div>
                ) : null}
                <div className={s.unit}>{formatShopPrice(l.priceCents, l.currency)} / st</div>
                <div className={s.qty}>
                  <button
                    type="button"
                    aria-label="Minska"
                    className={s.step}
                    onClick={() => setQty(l.variantId, l.quantity - 1)}
                  >
                    −
                  </button>
                  <span className={s.qtyValue}>{l.quantity}</span>
                  <button
                    type="button"
                    aria-label="Öka"
                    className={s.step}
                    disabled={atMax}
                    onClick={() => setQty(l.variantId, l.quantity + 1)}
                  >
                    +
                  </button>
                  {/* Destruktiv handling: egen färg (--sf-danger), på raden — aldrig
                      axel mot axel med "Till kassan". */}
                  <button type="button" className={s.remove} onClick={() => removeLine(l.variantId)}>
                    Ta bort
                  </button>
                </div>
              </div>
              <div className={s.lineTotal}>{formatShopPrice(l.priceCents * l.quantity, l.currency)}</div>
            </div>
          )
        })}
        <p className={s.back}>
          <Link href="/shop" className={s.backLink}>
            ← Fortsätt handla
          </Link>
        </p>
      </div>

      {/* Summeringspanelen (fruitkha total-section) */}
      <aside className={s.panel}>
        <h2 className={s.panelTitle}>Summering</h2>
        <div className={s.sumRow}>
          <span>Delsumma</span>
          <span className={s.sumValue}>{formatShopPrice(subtotalCents, currency)}</span>
        </div>
        <p className={s.fine}>Frakt och moms beräknas i kassan.</p>
        <Link href="/kassa" className={s.cta}>
          Till kassan
        </Link>
      </aside>
    </div>
  )
}
