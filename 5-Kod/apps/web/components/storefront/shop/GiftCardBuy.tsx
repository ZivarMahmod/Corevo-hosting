'use client'

// PRESENTKORTETS KÖPKNAPP (goal-64) — mockens `addGift` blir sann.
//
// Alla 12 Claude Design-paket har den här knappen, och alla 12 lägger presentkortet i
// VARUKORGEN, inte i ett eget flöde:
//
//   addGift: () => this.addToCart({ id: 'gift' + amount, name: `Presentkort ${kr(amount)}`, priceNum: amount })
//
// Fram till nu kunde plattformen inte det (korgraden krävde en produktvariant), så
// storefronten hade en INERT platta: "Presentkort köper du i butiken — eller hör av dig".
// Korgen bär numera radtypen 'giftcard' (0059) → knappen gör vad den säger.
//
// PRISET KOMMER ALDRIG HÄRIFRÅN. Komponenten lägger ett VAL i korgen (belopp + leverans);
// reserve_shop_order slår upp beloppet mot kundens egen lista och räknar totalen. En
// manipulerad localStorage-korg får exakt ingenting.
//
// FUNKTIONEN är modulens, FORMEN är mallens (vektor-regeln): stilarna hänger på
// --sf-btn-*/--color-* precis som AddToCart, så varje tema klär knappen i sitt eget språk.

import { useState } from 'react'
import { useCart } from './CartProvider'
import { CartToast } from './CartToast'
import {
  formatGiftPrice,
  GIFT_DELIVERY_LABELS,
  type GiftDeliveryMode,
  type PresentkortConfig,
} from '@/lib/storefront/presentkort/types'
import styles from './gift-card-buy.module.css'

export function GiftCardBuy({ config }: { config: PresentkortConfig }) {
  const { addLine } = useCart()
  const amounts = config.amountPresets
  const modes = config.deliveryModes
  const [amount, setAmount] = useState<number | null>(amounts[0] ?? null)
  const [mode, setMode] = useState<GiftDeliveryMode>(modes[0] ?? 'digital')
  const [recipient, setRecipient] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [added, setAdded] = useState(false)

  // Kunden har inga belopp konfigurerade → INGEN köpknapp. En knapp utan ett lagligt
  // belopp bakom sig är en knapp som ljuger (och servern skulle ändå avvisa köpet).
  if (amounts.length === 0 || amount == null) return null

  const add = () => {
    addLine(
      {
        // Radens nyckel: samma sammanslagning som mocken (`id: 'gift' + amount`) — samma
        // belopp + leverans två gånger blir EN rad, olika belopp blir olika rader.
        variantId: `gift:${amount}:${mode}`,
        productId: 'giftcard',
        productName: `Presentkort ${formatGiftPrice(amount, config.currency)}`,
        variantName: GIFT_DELIVERY_LABELS[mode],
        priceCents: amount * 100, // ENBART för rendering i korgen; servern re-summerar
        currency: config.currency,
        imageUrl: null,
        maxQty: null, // ett presentkort har inget lager
        kind: 'giftcard',
        giftAmount: amount,
        giftDeliveryMode: mode,
        giftRecipientName: recipient.trim() || undefined,
        giftRecipientEmail: email.trim() || undefined,
        giftMessage: message.trim() || undefined,
      },
      1,
    )
    setAdded(true)
  }

  return (
    <div className={styles.wrap}>
      <ul className={styles.amounts} aria-label="Välj belopp">
        {amounts.map((a) => (
          <li key={a}>
            <button
              type="button"
              className={a === amount ? `${styles.chip} ${styles.chipOn}` : styles.chip}
              aria-pressed={a === amount}
              onClick={() => setAmount(a)}
            >
              {formatGiftPrice(a, config.currency)}
            </button>
          </li>
        ))}
      </ul>

      {/* Auroras giftModes. Ett enda val → ingen väljare, bara ett besked. */}
      {modes.length > 1 ? (
        <ul className={styles.modes} aria-label="Välj leveranssätt">
          {modes.map((m) => (
            <li key={m}>
              <button
                type="button"
                className={m === mode ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                aria-pressed={m === mode}
                onClick={() => setMode(m)}
              >
                {GIFT_DELIVERY_LABELS[m]}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.modeNote}>
          {mode === 'in_store' ? 'Hämtas i butik.' : 'Skickas direkt till mottagarens mejl.'}
        </p>
      )}

      {/* Mottagaren — VALFRI. Utelämnad: kortet går till köparen själv (servern faller
          tillbaka på orderns kunduppgifter vid utfärdandet). Ett digitalt kort utan
          adressat vore däremot en kod som ingen får. */}
      {mode === 'digital' ? (
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>Mottagarens namn (valfritt)</span>
            <input
              className={styles.input}
              value={recipient}
              maxLength={120}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Mottagarens e-post (valfritt)</span>
            <input
              className={styles.input}
              type="email"
              value={email}
              maxLength={160}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Hälsning (valfritt)</span>
            <textarea
              className={styles.input}
              rows={2}
              value={message}
              maxLength={500}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      <button type="button" className={styles.buy} onClick={add}>
        {added ? 'Tillagd ✓' : `Lägg i korgen — ${formatGiftPrice(amount, config.currency)}`}
      </button>

      {added ? (
        <CartToast
          productName={`Presentkort ${formatGiftPrice(amount, config.currency)}`}
          variantName={modes.length > 1 ? GIFT_DELIVERY_LABELS[mode] : null}
          priceLabel={formatGiftPrice(amount, config.currency)}
          onClose={() => setAdded(false)}
        />
      ) : null}
    </div>
  )
}
