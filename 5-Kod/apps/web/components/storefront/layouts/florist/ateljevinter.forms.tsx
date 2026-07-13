'use client'

// ATELJÉ VINTER — FORMULÄR-ÖARNA (goal-64 regression, exakt kopia ur .dc.html).
//
// Mallen äger FORMEN, modulen äger FUNKTIONEN. De här 'use client'-öarna renderar
// filens egna fält (understruken hårlinje, transparent, gemena etiketter) och postar
// till EXAKT samma server-actions som de delade formulären — submitOffertRequest.
// Ingen validering, inget pending-läge, ingen fältkontrakt ändras; bara markupen är
// mallens.
//
// CLIENT/SERVER-STAKETET (kostade 18h en gång): den här filens importgraf når INGEN
// 'server-only'-modul. Den importerar bara: react; de PURA typerna i
// lib/storefront/offert/types (ingen I/O); och server-actionen (RPC-gräns via
// 'use server'). Lägg ALDRIG load-offert eller @/lib/supabase/* här.

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  offertCtaLabel,
  OFFERT_SUBMIT_INITIAL,
  type OffertMode,
  type OffertSubmitState,
} from '@/lib/storefront/offert/types'
import { submitOffertRequest } from '@/lib/storefront/offert/intake'
import { KURS_SUBMIT_INITIAL, type KursSubmitState } from '@/lib/storefront/kurser/types'
import { submitEventRegistration } from '@/app/(public)/kurser/actions'
import { useCart } from '../../shop/CartProvider'
import {
  formatGiftPrice,
  GIFT_DELIVERY_LABELS,
  type GiftDeliveryMode,
  type PresentkortConfig,
} from '@/lib/storefront/presentkort/types'
import styles from './ateljevinter.module.css'

/** Submit-knappen, nästlad så useFormStatus läser DET HÄR formulärets pending-läge.
 *  Filens knapp är den fyllda svarta (.avSolidWide) — gemener, spärrad 0.24em. */
function OffertSubmit({ mode }: { mode: OffertMode }) {
  const { pending } = useFormStatus()
  // Filens copy är gemen; offertCtaLabel ger "Skicka förfrågan" → mallen sänker den.
  const label = offertCtaLabel(mode).toLowerCase()
  return (
    <button type="submit" className={styles.avSolidWide} disabled={pending} aria-label={label}>
      {pending ? 'skickar…' : label}
    </button>
  )
}

/**
 * BESTÄLLNINGSVERK — filens `showOffert`. uppdragets art-chips (config.subjects),
 * namn + e-post i två spalter, beskrivning, och den fyllda knappen. Fälten är filens:
 * `border:none; border-bottom:1px solid #161616`, transparent, gemen etikett.
 *
 * Fältkontraktet är modulens (submitOffertRequest): name krävs, e-post ELLER telefon,
 * subject sparas för alla lägen, message krävs för allt utom callback. Filens
 * beställningsverk saknar telefonfält — därför samlar den e-post, och validering
 * (e-post eller telefon) uppfylls av e-posten.
 */
export function AteljeVinterOffertForm({
  mode,
  responseDays,
  subjects,
}: {
  mode: OffertMode
  responseDays: number
  subjects: string[]
}) {
  const [state, formAction] = useActionState<OffertSubmitState, FormData>(
    submitOffertRequest,
    OFFERT_SUBMIT_INITIAL,
  )

  const hasChips = subjects.length > 0
  const showSubject = mode === 'estimate_form' && !hasChips
  const showMessage = mode !== 'callback'

  if (state.phase === 'done') {
    return (
      <p role="status" className={styles.avFormDone}>
        mottaget — vi återkommer inom {responseDays} {responseDays === 1 ? 'dag' : 'dagar'}.
      </p>
    )
  }

  return (
    <form action={formAction} className={styles.avForm}>
      {hasChips ? (
        <fieldset className={styles.avFieldset}>
          <legend className={styles.avSubLabel}>uppdragets art</legend>
          <div className={styles.avChipRow}>
            {subjects.map((s) => (
              <label key={s} className={styles.avChip}>
                <input type="radio" name="subject" value={s} required className={styles.avChipInput} />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className={styles.avFormRow}>
        <div>
          <label className={styles.avFieldLabel} htmlFor="av-offert-name">
            namn
          </label>
          <input
            id="av-offert-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            placeholder="för- och efternamn"
            className={styles.avField}
          />
        </div>
        <div>
          <label className={styles.avFieldLabel} htmlFor="av-offert-email">
            e-post
          </label>
          <input
            id="av-offert-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={160}
            placeholder="namn@adress.se"
            className={styles.avField}
          />
        </div>
      </div>

      {showSubject ? (
        <div className={styles.avFormField}>
          <label className={styles.avFieldLabel} htmlFor="av-offert-subject">
            vad gäller det?
          </label>
          <input
            id="av-offert-subject"
            name="subject"
            type="text"
            required
            maxLength={200}
            className={styles.avField}
          />
        </div>
      ) : null}

      {showMessage ? (
        <div className={styles.avFormField}>
          <label className={styles.avFieldLabel} htmlFor="av-offert-message">
            beskrivning
          </label>
          <textarea
            id="av-offert-message"
            name="message"
            rows={4}
            required
            maxLength={4000}
            placeholder="plats, datum, känsla, budget…"
            className={styles.avTextarea}
          />
        </div>
      ) : null}

      {state.phase === 'error' ? (
        <p role="alert" className={styles.avFormError}>
          {state.message}
        </p>
      ) : null}

      <OffertSubmit mode={mode} />
    </form>
  )
}

/**
 * GÅVOBREV — filens `showPresentkort`. Det inramade "kortet" (butiksnamn · gåvobrev ·
 * belopp · giltighet), beloppschipsen och den svarta "+ lägg i korgen"-knappen. Beloppet
 * i kortet uppdateras live när ett chip väljs → hela ytan är en klient-ö.
 *
 * FUNKTIONEN är modulens: exakt samma korg-rad som GiftCardBuy (kind 'giftcard',
 * variantId `gift:<belopp>:<läge>`), så reserve_shop_order slår upp beloppet mot kundens
 * egen lista och kassan/utfärdandet är oförändrade. Inga belopp konfigurerade → ingen
 * knapp (en knapp utan lagligt belopp bakom sig ljuger; servern skulle ändå avvisa köpet).
 */
export function AteljeVinterGiftForm({
  config,
  tenantName,
}: {
  config: PresentkortConfig
  tenantName: string
}) {
  const { addLine } = useCart()
  const amounts = config.amountPresets
  const mode: GiftDeliveryMode = config.deliveryModes[0] ?? 'digital'
  const [amount, setAmount] = useState<number | null>(amounts[0] ?? null)
  const [added, setAdded] = useState(false)

  if (amounts.length === 0 || amount == null) return null

  const priceLabel = formatGiftPrice(amount, config.currency)

  const add = () => {
    addLine(
      {
        variantId: `gift:${amount}:${mode}`,
        productId: 'giftcard',
        productName: `Presentkort ${priceLabel}`,
        variantName: GIFT_DELIVERY_LABELS[mode],
        priceCents: amount * 100, // ENBART rendering i korgen; servern re-summerar
        currency: config.currency,
        imageUrl: null,
        maxQty: null,
        kind: 'giftcard',
        giftAmount: amount,
        giftDeliveryMode: mode,
      },
      1,
    )
    setAdded(true)
  }

  return (
    <div className={styles.avGiftWrap}>
      <div className={styles.avGiftCard}>
        <p className={styles.avGiftMark}>{tenantName}</p>
        <p className={styles.avGiftKind}>gåvobrev</p>
        <p className={styles.avGiftAmount}>{priceLabel}</p>
        <p className={styles.avGiftNote}>gäller tolv månader — inlöses mot valfritt verk</p>
      </div>

      <div className={styles.avGiftChips} role="group" aria-label="välj belopp">
        {amounts.map((a) => (
          <button
            key={a}
            type="button"
            className={a === amount ? `${styles.avChip} ${styles.avChipOn}` : styles.avChip}
            aria-pressed={a === amount}
            onClick={() => {
              setAmount(a)
              setAdded(false)
            }}
          >
            {formatGiftPrice(a, config.currency)}
          </button>
        ))}
      </div>

      <button type="button" className={styles.avGiftBuy} onClick={add}>
        {added ? `i korgen ✓ — ${priceLabel}` : `+ lägg i korgen — ${priceLabel}`}
      </button>
    </div>
  )
}

/** Anmälnings-submit, nästlad för useFormStatus. */
function KursSubmit() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={styles.avSolidWide} disabled={pending}>
      {pending ? 'anmäler…' : 'anmäl'}
    </button>
  )
}

/**
 * SEMINARIE-ANMÄLAN (onsite) — filens seminarier antar korg-köp, men en kund som tar
 * betalt PÅ PLATS (config.payment='onsite') behöver ett anmälningsformulär. Det renderas
 * i mallens grammatik (hårlinjefält, gemener) i stället för de delade boxade fälten.
 *
 * FUNKTIONEN är modulens: submitEventRegistration, samma fältkontrakt som KursAnmalanForm
 * (event_id, name, email, phone, party_size, message). Bara formen är mallens.
 */
export function AteljeVinterKursForm({ eventId, maxParty }: { eventId: string; maxParty: number }) {
  const [state, formAction] = useActionState<KursSubmitState, FormData>(
    submitEventRegistration,
    KURS_SUBMIT_INITIAL,
  )

  if (state.phase === 'done') {
    return (
      <p role="status" className={styles.avFormDone}>
        anmäld — en bekräftelse skickas till din e-post.
      </p>
    )
  }

  const seats = Array.from({ length: Math.max(1, Math.min(8, maxParty)) }, (_, i) => i + 1)

  return (
    <form action={formAction} className={styles.avKursForm}>
      <input type="hidden" name="event_id" value={eventId} />

      <div className={styles.avFormRow}>
        <div>
          <label className={styles.avFieldLabel} htmlFor={`av-kurs-name-${eventId}`}>
            namn
          </label>
          <input
            id={`av-kurs-name-${eventId}`}
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={120}
            placeholder="för- och efternamn"
            className={styles.avField}
          />
        </div>
        <div>
          <label className={styles.avFieldLabel} htmlFor={`av-kurs-email-${eventId}`}>
            e-post
          </label>
          <input
            id={`av-kurs-email-${eventId}`}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={160}
            placeholder="namn@adress.se"
            className={styles.avField}
          />
        </div>
      </div>

      <div className={styles.avFormRow}>
        <div>
          <label className={styles.avFieldLabel} htmlFor={`av-kurs-phone-${eventId}`}>
            telefon (valfritt)
          </label>
          <input
            id={`av-kurs-phone-${eventId}`}
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            placeholder="07x…"
            className={styles.avField}
          />
        </div>
        <div>
          <label className={styles.avFieldLabel} htmlFor={`av-kurs-party-${eventId}`}>
            antal platser
          </label>
          <select
            id={`av-kurs-party-${eventId}`}
            name="party_size"
            defaultValue="1"
            className={styles.avField}
          >
            {seats.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.avFormField}>
        <label className={styles.avFieldLabel} htmlFor={`av-kurs-message-${eventId}`}>
          meddelande (valfritt)
        </label>
        <textarea
          id={`av-kurs-message-${eventId}`}
          name="message"
          rows={3}
          maxLength={2000}
          className={styles.avTextarea}
        />
      </div>

      {state.phase === 'error' ? (
        <p role="alert" className={styles.avFormError}>
          {state.message}
        </p>
      ) : null}

      <KursSubmit />
    </form>
  )
}
