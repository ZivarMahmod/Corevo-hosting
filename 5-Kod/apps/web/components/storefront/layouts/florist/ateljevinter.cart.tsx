'use client'

// ATELJÉ VINTER — KORGEN (goal-64 regression). EXAKT KOPIA av filens `showKorg`:
// eyebrow "korg", tunn rubrik "dina förvärv", hårlinjerade rader (64×80-foto, namn,
// styckpris, −/antal/+ utan ramar, radsumma i primärfärg, "avstå" som gråton-länk),
// en summa-rad mot en TJOCK svart linje (border-top:1px solid #161616), och sist
// "← samlingen" + den fyllda "till kassan"-knappen.
//
// Tomt läge: filens hårlinjerade platta — "korgen är tom." + "till samlingen →".
//
// FUNKTIONEN är orörd och delad (vektor-regeln): useCart är samma hook, samma
// localStorage, samma setQty/removeLine. Byter kunden mall imorgon följer korgens
// INNEHÅLL med — bara formen byts.

import Link from 'next/link'
import { useCart } from '../../shop/CartProvider'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import styles from './ateljevinter.module.css'

export function AteljeVinterCart() {
  const { lines, subtotalCents, setQty, removeLine } = useCart()
  const currency = lines[0]?.currency ?? 'SEK'

  return (
    <section className={styles.avCartPage}>
      <p className={styles.avEyebrow}>korg</p>
      <h1 className={styles.avPageTitle}>dina förvärv</h1>

      {lines.length === 0 ? (
        <div className={styles.avCartEmpty}>
          <p className={styles.avCartEmptyText}>korgen är tom.</p>
          <Link href="/shop" className={styles.avUnderline}>
            till samlingen →
          </Link>
        </div>
      ) : (
        <div>
          <div className={styles.avCartLines}>
            {lines.map((l) => (
              <div key={l.variantId} className={styles.avCartRow}>
                <Link
                  href={`/shop/${l.productId}`}
                  className={styles.avCartPhoto}
                  aria-label={`${l.productName} — visa verket`}
                  style={l.imageUrl ? { backgroundImage: `url(${l.imageUrl})` } : undefined}
                />
                <div className={styles.avCartBody}>
                  <p className={styles.avCartName}>{l.productName}</p>
                  <p className={styles.avCartUnit}>
                    {formatShopPrice(l.priceCents, l.currency)} / exemplar
                  </p>
                </div>
                <div className={styles.avCartQty} role="group" aria-label={`antal — ${l.productName}`}>
                  <button
                    type="button"
                    aria-label="minska antal"
                    disabled={l.quantity <= 1}
                    onClick={() => setQty(l.variantId, l.quantity - 1)}
                  >
                    −
                  </button>
                  <span aria-live="polite">{l.quantity}</span>
                  <button
                    type="button"
                    aria-label="öka antal"
                    disabled={l.maxQty != null && l.quantity >= l.maxQty}
                    onClick={() => setQty(l.variantId, l.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <p className={styles.avCartLineTotal}>
                  {formatShopPrice(l.priceCents * l.quantity, l.currency)}
                </p>
                <button
                  type="button"
                  className={styles.avCartRemove}
                  onClick={() => removeLine(l.variantId)}
                >
                  avstå
                </button>
              </div>
            ))}
          </div>

          <div className={styles.avCartSum}>
            <p>summa</p>
            <p>{formatShopPrice(subtotalCents, currency)}</p>
          </div>

          <div className={styles.avCartActions}>
            <Link href="/shop" className={styles.avCartBack}>
              ← samlingen
            </Link>
            <Link href="/kassa" className={styles.avSolid}>
              till kassan
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
