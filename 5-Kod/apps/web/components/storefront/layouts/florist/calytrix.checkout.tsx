'use client'

// CALYTRIX ÄGER SIN KASSA (goal-62, Zivars lag: mallen äger ALLT som syns).
//
// FLORISTENS ORDERBLOCK: kassan är inte en grå blankett — det är butikens eget
// ordersblock som ligger på det mörka plommonbordet (samma bord som varukorgens
// packlista i calytrix.cart.tsx). Varorna står som kvittorader överst, summeringen
// prickas av som en plocklista, och fälten är blanketter med etiketten TRYCKT på
// fältkanten. Onyx, mina eller zigge får ALDRIG den här scenen.
//
// Uiverse-anatomier (4-Dokument-Underlag/uiverse-komponentbibliotek.md) — ANATOMIN
// lånad, ALDRIG koden/hexarna:
//   · rad 15416 ".container" (Checkout-kort med glidande kort) → huvudscenen:
//     ett lyft "dokument" på en mörk yta, skuggan gör kortet till hjälte.
//   · rad 15908 ".add-card" (betalkortsblankett) → fältens anatomi: etiketten
//     sitter PÅ inputens överkant och färgskiftar vid fokus. Corevo tar INTE
//     kortnummer i detta steg (betalning vid leverans/upphämtning) — bara
//     blankett-gesten är lånad, aldrig kortfälten.
//   · rad 5170 ".cir-checks" → summeringens rader som avprickad plocklista:
//     fyrkantig ruta (calytrix radie = 0) med ritad bock.
//   · rad 15785 ".order-wrapper" (lastbilen kör → "Order Delivered") → submit-
//     knappens resa: efter lyckad beställning kör budbilen över knappen innan
//     redirecten. prefers-reduced-motion → resan hoppas över helt.
//
// FUNKTIONEN ÄR ORÖRD OCH DELAD (vektor-regeln): exakt samma server actions
// (reserveOrder/confirmOrder/cancelOrder/startShopCheckout), samma fält, samma
// valideringar, samma reserve-vid-mount + cancel-vid-lämning, samma
// CheckoutLoader-overlay och samma dubbelklick-vakt som app/butik/kassa/
// CheckoutForm.tsx. Byter kunden mall imorgon följer köpet med — bara scenen byts.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/components/storefront/shop/CartProvider'
import { CheckoutLoader } from '@/components/storefront/shop/CheckoutLoader'
import { formatShopPrice, type ShopFulfilment } from '@/lib/storefront/shop/types'
import { reserveOrder, confirmOrder, cancelOrder, startShopCheckout } from '@/app/butik/actions'
import s from './calytrix-checkout.module.css'

export function CalytrixCheckout({ fulfilment }: { fulfilment: ShopFulfilment }) {
  const { lines, token, subtotalCents, clear } = useCart()
  const router = useRouter()

  const [orderId, setOrderId] = useState<string | null>(null)
  const [reserving, setReserving] = useState(true)
  const [reserveError, setReserveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // "sent" = beställningen ÄR bekräftad, budbilen kör över knappen innan redirect.
  // submitting förblir true under resan — cleanup-effekten nedan cancel:ar annars
  // en redan BEKRÄFTAD order när sidan navigerar bort (villkoret !submitting).
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fields, setFields] = useState({ name: '', email: '', phone: '', address: '', note: '' })
  const didReserve = useRef(false)
  // Dubbelbetalnings-vakt: samma synkrona ref som delade kassan — state är asynkront,
  // två snabba klick kan annars skicka två confirmOrder. Dubbelbetalning = riktig bugg.
  const inFlight = useRef(false)

  const currency = lines[0]?.currency ?? 'SEK'
  const needsAddress = fulfilment === 'ship'

  // Reservera ordern EN gång vid mount (håller lagret medan kunden fyller i).
  useEffect(() => {
    if (didReserve.current || !token || lines.length === 0) return
    didReserve.current = true
    setReserving(true)
    reserveOrder({ items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), token })
      .then((r) => {
        if (r.ok) setOrderId(r.orderId)
        else setReserveError(r.message)
      })
      .catch(() => setReserveError('Något gick fel. Försök igen.'))
      .finally(() => setReserving(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Släpp lager-holdet om kunden lämnar kassan utan att slutföra.
  useEffect(() => {
    return () => {
      if (orderId && token && !submitting) {
        void cancelOrder(orderId, token)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  if (lines.length === 0 && !orderId) {
    // Tomt block: inget att skriva upp. Samma villkor som delade kassan.
    return (
      <div className={s.table}>
        <div className={`${s.pad} ${s.padEmpty}`}>
          <p className={s.emptyKicker}>Orderblocket är tomt</p>
          <p className={s.emptyText}>Din varukorg är tom — buketterna väntar i butiken.</p>
          <Link href="/shop" className={s.emptyCta}>
            In i butiken
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlight.current) return // dubbelklick-vakt (synkron, till skillnad från state)
    setFormError(null)
    const name = fields.name.trim()
    const email = fields.email.trim()
    const phone = fields.phone.trim()
    if (!name || !email || !phone) return setFormError('Fyll i namn, e-post och telefon.')
    if (!/.+@.+\..+/.test(email)) return setFormError('Kontrollera e-postadressen.')
    if (needsAddress && !fields.address.trim()) return setFormError('Fyll i leveransadress.')
    if (!orderId) return setFormError('Beställningen är inte redo — ladda om sidan.')

    inFlight.current = true
    setSubmitting(true)
    const res = await confirmOrder({
      orderId,
      token,
      name,
      email,
      phone,
      shipAddress: needsAddress ? fields.address.trim() : undefined,
      note: fields.note.trim() || undefined,
    })
    if (!res.ok) {
      inFlight.current = false
      setSubmitting(false)
      setFormError(res.message)
      return
    }
    // Betalning krävs (Fas 3, bakom payments_enabled) → Stripe DIREKT, ingen bilresa —
    // pengasteget får aldrig vänta på en animation. Samma fall-igenom som delade kassan.
    // inFlight släpps ALDRIG efter lyckat köp: knappen förblir låst under redirecten.
    if (res.requiresPayment) {
      const co = await startShopCheckout(res.orderId)
      if (co.ok) {
        clear()
        window.location.href = co.url
        return
      }
    }
    // Ordern är bekräftad → budbilen kör (uiverse rad 15785, komprimerad till ~2s).
    // reduced-motion: hoppa resan helt, redirecta direkt (samma beteende som delad kassa).
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      clear()
      router.push(`/bekraftelse/${res.orderId}`)
      return
    }
    setSent(true)
    window.setTimeout(() => {
      // clear() först HÄR — töms korgen tidigare försvinner kvittoraderna mitt i resan.
      clear()
      router.push(`/bekraftelse/${res.orderId}`)
    }, 2100)
  }

  // v1: total = delsumma (frakt/moms additivt senare). Full kostnad visas FÖRE köp.
  const totalCents = subtotalCents
  const pending = submitting || reserving || !orderId
  const itemCount = lines.reduce((a, l) => a + l.quantity, 0)

  return (
    <div className={s.table}>
      {/* Orderblocket: ett lyft papper på plommonbordet (scen-anatomin ur uiverse
          rad 15416 — dokumentet är hjälten, bordet är mörkret bakom). */}
      <div className={s.pad}>
        <header className={s.padHead}>
          <p className={s.padKicker}>Orderblock</p>
          <p className={s.padNo} aria-hidden="true">
            Nr {orderId ? orderId.slice(0, 6).toUpperCase() : '——'}
          </p>
        </header>

        {/* ── Kvittoraderna: varorna överst, som handskrivna rader med prickad
               ledare fram till priset. ── */}
        <ol className={s.rows} aria-label="Din beställning">
          {lines.map((l, i) => (
            <li key={l.variantId} className={s.row}>
              <span className={s.rowNo} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={s.rowName}>
                {l.productName}
                {l.variantName && l.variantName !== 'Standard' ? ` (${l.variantName})` : ''} × {l.quantity}
              </span>
              <span className={s.rowLeader} aria-hidden="true" />
              <span className={s.rowPrice}>{formatShopPrice(l.priceCents * l.quantity, l.currency)}</span>
            </li>
          ))}
        </ol>

        {/* ── Avprickad plocklista (uiverse rad 5170 .cir-checks): summeringens
               rader bockas av som att floristen redan plockat allt. Rutorna är
               dekor (aria-hidden) — raderna är läsbar text. ── */}
        <div className={s.picked}>
          <div className={s.pickedRow}>
            <span className={s.pickedBox} aria-hidden="true" />
            <span className={s.pickedLabel}>
              {itemCount} {itemCount === 1 ? 'vara' : 'varor'} plockade
            </span>
            <span className={s.rowLeader} aria-hidden="true" />
            <span className={s.pickedValue}>{formatShopPrice(subtotalCents, currency)}</span>
          </div>
          <div className={s.pickedRow}>
            <span className={s.pickedBox} aria-hidden="true" />
            <span className={s.pickedLabel}>Betalas vid leverans/upphämtning</span>
          </div>
        </div>

        {/* Full kostnad synlig FÖRE köp-knappen (samma Baymard-regel som delade kassan). */}
        <div className={s.total}>
          <span className={s.totalLabel}>Att betala</span>
          <span className={s.totalValue}>{formatShopPrice(totalCents, currency)}</span>
        </div>

        {reserveError ? (
          <p role="alert" className={s.alert}>
            {reserveError}{' '}
            <Link href="/" className={s.alertLink}>
              Tillbaka till butiken
            </Link>
          </p>
        ) : null}

        {/* ── Blanketterna: samma fält, samma ordning, samma fieldset-grupper som
               delade kassan ("Dina uppgifter" / "Leverans"). Etikett-anatomin ur
               uiverse rad 15908: titeln sitter PÅ fältets överkant som ett tryck. ── */}
        <form onSubmit={onSubmit} className={s.form} noValidate>
          <fieldset className={s.group}>
            <legend className={s.legend}>Dina uppgifter</legend>
            <PadField id="name" label="Namn" value={fields.name} onChange={(v) => setFields((f) => ({ ...f, name: v }))} autoComplete="name" required />
            <PadField id="email" label="E-post" type="email" value={fields.email} onChange={(v) => setFields((f) => ({ ...f, email: v }))} autoComplete="email" required />
            <PadField id="phone" label="Telefon" type="tel" value={fields.phone} onChange={(v) => setFields((f) => ({ ...f, phone: v }))} autoComplete="tel" required />
          </fieldset>

          <fieldset className={s.group}>
            <legend className={s.legend}>{needsAddress ? 'Leverans' : 'Till beställningen'}</legend>
            {needsAddress ? (
              <PadField id="address" label="Leveransadress" value={fields.address} onChange={(v) => setFields((f) => ({ ...f, address: v }))} autoComplete="street-address" required />
            ) : null}
            <PadField id="note" label="Meddelande (valfritt)" value={fields.note} onChange={(v) => setFields((f) => ({ ...f, note: v }))} />
          </fieldset>

          {formError ? (
            <p role="alert" className={s.alert}>
              {formError}
            </p>
          ) : null}

          {/* Samma overlay som delade kassan under confirmOrder — men INTE under
              bilresan (då är ordern redan i hamn, overlayen skulle täcka bilen). */}
          {submitting && !sent ? <CheckoutLoader /> : null}

          {/* SUBMIT = BUDBILENS RESA (uiverse rad 15785). Vilande: vanlig knapp.
              sent: texten viker undan, bilen kör över vägen, bocken ritas.
              aria-live-status i .sentMsg berättar samma sak för skärmläsare. */}
          <button
            type="submit"
            className={s.submit}
            disabled={pending || sent}
            aria-busy={submitting || reserving}
            data-sent={sent ? '' : undefined}
          >
            <span className={s.submitLabel}>
              {sent
                ? ' '
                : submitting
                  ? 'Slutför…'
                  : reserving
                    ? 'Förbereder…'
                    : 'Slutför beställning'}
            </span>
            <span className={s.ride} aria-hidden="true">
              <span className={s.road} />
              {/* Budbil ritad inline (CSP: inga fjärr-assets), calytrix egna toner. */}
              <svg className={s.truck} viewBox="0 0 52 26" width="52" height="26">
                <rect x="1" y="4" width="30" height="14" fill="currentColor" />
                <path d="M31 8h10l6 6v4H31V8Z" fill="currentColor" opacity="0.8" />
                <rect x="33.5" y="10" width="6" height="4.5" fill="var(--color-primary-d, #4a0e2e)" />
                <circle cx="10" cy="20" r="4" fill="var(--color-primary-d, #4a0e2e)" stroke="currentColor" strokeWidth="2" />
                <circle cx="40" cy="20" r="4" fill="var(--color-primary-d, #4a0e2e)" stroke="currentColor" strokeWidth="2" />
              </svg>
            </span>
            <span className={s.sentMsg} role="status" aria-live="polite">
              {sent ? (
                <>
                  <svg viewBox="0 0 12 10" width="14" height="12" aria-hidden="true" className={s.sentCheck}>
                    <polyline points="1.5 6 4.5 9 10.5 1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Beställningen är på väg
                </>
              ) : null}
            </span>
          </button>
          <p className={s.trust}>🔒 Dina uppgifter används bara för denna beställning.</p>
        </form>
      </div>
    </div>
  )
}

// Blankettfält: etiketten TRYCKT på fältets överkant (anatomin ur uiverse rad 15908
// .add-card — struktur och fokus-skifte lånade, aldrig hexar/kortfält). Etiketten är
// en riktig <label> (htmlFor) — trycket är sceneri, kopplingen är på riktigt.
function PadField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  required = false,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoComplete?: string
  required?: boolean
}) {
  return (
    <div className={s.fieldWrap}>
      <label htmlFor={id} className={s.fieldTitle}>
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={s.field}
      />
    </div>
  )
}
