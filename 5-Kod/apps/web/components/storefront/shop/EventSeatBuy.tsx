'use client'

// KURSPLATSEN SOM KÖP (goal-64) — Calytrix `add: () => this.addToCart({ ... ' (kursplats)' })`.
//
// Calytrix designar kursen som ett köp: "Boka din plats direkt — kursplatsen läggs i
// varukorgen och betalas i kassan som allt annat." Plattformen kunde bara anmäla utan
// betalning (0052). Nu bär korgen radtypen 'event' (0059).
//
// KAPACITET ÄR LAGER. En kursplats i korgen HÅLLER en plats (tenant_events.reserved_qty)
// på exakt samma sätt som en produkt håller lager — annars kan två personer köpa sista
// platsen och båda få betala för den. Holdet tas i reserve_shop_order och släpps vid
// avbruten/utgången order.
//
// PRISET ÄR KURSENS. Komponenten skickar bara ett event_id och ett antal; servern läser
// price_cents ur tillfället. `seatsLeft` här är en KLIENT-HINT (samma roll som maxQty på
// en produktrad) — den slutgiltiga vakten sitter i RPC:n.
//
// GATAD: renderas bara när kunden tar betalt i kassan (config.payment === 'checkout').
// Annars är KursAnmalanForm fortfarande vägen in, oförändrad.

import { useState } from 'react'
import { useCart } from './CartProvider'
import { CartToast } from './CartToast'
import { formatEventPrice } from '@/lib/storefront/kurser/types'
import styles from './add-to-cart.module.css'

export function EventSeatBuy({
  eventId,
  title,
  priceCents,
  /** Lediga platser just nu; null = okänt (service-nyckel saknas) → ingen klient-tak. */
  seatsLeft,
}: {
  eventId: string
  title: string
  priceCents: number
  seatsLeft: number | null
}) {
  const { addLine } = useCart()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  // Fullbokat → ingen knapp. Sidan säger redan varför (kortets "Fullbokat"-besked).
  if (seatsLeft != null && seatsLeft <= 0) return null

  // 20 = event_registrations.party_size-taket (0052). Klienten ska aldrig kunna be om
  // ett antal som DB:n sedan avvisar med ett fel köparen inte förstår.
  const maxQty = Math.min(20, seatsLeft ?? 20)

  const add = () => {
    addLine(
      {
        variantId: `event:${eventId}`, // radens nyckel — ALDRIG ett variant-id (se CartLine)
        productId: eventId,
        productName: `${title} (kursplats)`,
        variantName: 'Kursplats',
        priceCents, // ENBART för rendering i korgen; servern re-summerar ur kursens pris
        currency: 'SEK',
        imageUrl: null,
        maxQty: seatsLeft, // klient-hint: korgen kan inte överstiga lediga platser
        kind: 'event',
        eventId,
      },
      qty,
    )
    setAdded(true)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.qtyRow}>
        <button
          type="button"
          className={styles.step}
          aria-label="Färre platser"
          disabled={qty <= 1}
          onClick={() => setQty((q) => Math.max(1, q - 1))}
        >
          −
        </button>
        <span aria-live="polite" className={styles.qtyValue}>
          {qty}
        </span>
        <button
          type="button"
          className={styles.step}
          aria-label="Fler platser"
          disabled={qty >= maxQty}
          onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
        >
          +
        </button>
      </div>

      <button type="button" className={styles.buy} onClick={add}>
        {added ? 'Tillagd ✓' : `Lägg i korgen — ${formatEventPrice(priceCents * qty)}`}
      </button>

      {added ? (
        <CartToast
          productName={`${title} (kursplats)`}
          variantName={qty > 1 ? `${qty} platser` : null}
          priceLabel={formatEventPrice(priceCents * qty)}
          onClose={() => setAdded(false)}
        />
      ) : null}
    </div>
  )
}
