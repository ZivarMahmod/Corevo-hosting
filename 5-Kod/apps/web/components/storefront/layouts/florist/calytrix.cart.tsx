'use client'

// CALYTRIX — VARUKORGEN (goal-64). EXAKT KOPIA av `showVarukorg` i "Calytrix -
// E-handel.dc.html": "Din varukorg" i 56px serif, artikelräkningen under, sedan
// 1.8fr/1fr — radlistan till vänster (vit platta, 96×120-foto, namn, styckpris,
// −/antal/+ i kantiga rutor, radsumma i plommon, "Ta bort" understruket) och den
// STICKY sammanfattningen till höger (Delsumma · Totalt · TILL KASSAN).
//
// Tomt läge: filens kantade ruta — "Korgen är tom — än så länge."
//
// FUNKTIONEN är orörd och delad (vektor-regeln): useCart är samma hook, samma
// localStorage, samma setQty/removeLine, samma formatShopPrice. Byter kunden mall
// imorgon följer korgens INNEHÅLL med — bara formen byts.
//
// AVVIKELSE (medveten): filens summering har en rad "Leverans (bud) 79 kr". Motorn
// har ingen frakt-modell (v1: total = delsumma, frakt/moms additivt senare) — en
// hårdkodad 79-kronorsrad hade varit ett påhittat pris i en riktig kassa. Raden är
// ersatt av filens egen finstil om vad som händer i nästa steg.
import Link from 'next/link'
import { useCart } from '@/components/storefront/shop/CartProvider'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import s from './calytrix-cart.module.css'

export function CalytrixCart() {
  const { lines, subtotalCents, setQty, removeLine } = useCart()
  const currency = lines[0]?.currency ?? 'SEK'
  const count = lines.reduce((a, l) => a + l.quantity, 0)

  return (
    <section className={s.cxCart}>
      <h1 className={s.cxTitle}>Din varukorg</h1>
      <p className={s.cxCount}>
        {count} {count === 1 ? 'artikel' : 'artiklar'}
      </p>

      {lines.length === 0 ? (
        <div className={s.cxEmpty}>
          <p className={s.cxEmptyTitle}>Korgen är tom — än så länge.</p>
          <p className={s.cxEmptyText}>Någon där ute förtjänar blommor idag.</p>
          <Link href="/shop" className={s.cxBtn}>
            Till butiken
          </Link>
        </div>
      ) : (
        <div className={s.cxGrid}>
          <div className={s.cxLines}>
            <ul className={s.cxList}>
              {lines.map((l) => (
                <li key={l.variantId} className={s.cxRow}>
                  <Link
                    href={`/shop/${l.productId}`}
                    className={s.cxRowPhoto}
                    aria-label={`${l.productName} — visa produkt`}
                    style={l.imageUrl ? { backgroundImage: `url(${l.imageUrl})` } : undefined}
                  />

                  <div className={s.cxRowBody}>
                    <p className={s.cxRowName}>
                      <Link href={`/shop/${l.productId}`}>{l.productName}</Link>
                    </p>
                    <p className={s.cxRowUnit}>
                      {formatShopPrice(l.priceCents, l.currency)} / st
                      {l.variantName && l.variantName !== 'Standard' ? ` · ${l.variantName}` : ''}
                    </p>

                    <div className={s.cxQty} role="group" aria-label={`Antal — ${l.productName}`}>
                      <button
                        type="button"
                        className={s.cxQtyBtn}
                        aria-label="Minska antal"
                        disabled={l.quantity <= 1}
                        onClick={() => setQty(l.variantId, l.quantity - 1)}
                      >
                        −
                      </button>
                      <span className={s.cxQtyVal} aria-live="polite">
                        {l.quantity}
                      </span>
                      <button
                        type="button"
                        className={s.cxQtyBtn}
                        aria-label="Öka antal"
                        disabled={l.maxQty != null && l.quantity >= l.maxQty}
                        onClick={() => setQty(l.variantId, l.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className={s.cxRowEnd}>
                    <p className={s.cxRowTotal}>
                      {formatShopPrice(l.priceCents * l.quantity, l.currency)}
                    </p>
                    <button
                      type="button"
                      className={s.cxRemove}
                      onClick={() => removeLine(l.variantId)}
                    >
                      Ta bort
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div className={s.cxListRule} />
            <Link href="/shop" className={s.cxBack}>
              ← Fortsätt handla
            </Link>
          </div>

          <aside className={s.cxSummary} aria-label="Sammanfattning">
            <h2 className={s.cxSummaryTitle}>Sammanfattning</h2>
            <div className={s.cxSumRow}>
              <span className={s.cxSumLabel}>Delsumma</span>
              <span className={s.cxSumValue}>{formatShopPrice(subtotalCents, currency)}</span>
            </div>
            <div className={s.cxSumTotal}>
              <span>Totalt</span>
              <span className={s.cxSumTotalValue}>{formatShopPrice(subtotalCents, currency)}</span>
            </div>
            <Link href="/kassa" className={s.cxCta}>
              Till kassan
            </Link>
            <p className={s.cxFine}>Leveranssätt och eventuell frakt väljs i kassan.</p>
          </aside>
        </div>
      )}
    </section>
  )
}
