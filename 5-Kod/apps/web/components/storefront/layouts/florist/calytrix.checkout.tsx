'use client'

// CALYTRIX — KASSAN (goal-64). 3-STEGSKASSAN ÄR MALLENS IDENTITET.
//
// EXAKT KOPIA av `showKassa` i "Calytrix - E-handel.dc.html": "Kassan" i 56px serif,
// "Säker betalning · N artiklar", sedan 1.7fr/1fr — de tre vita kantade stegkorten till
// vänster (1. Leveransuppgifter · 2. Leveranssätt · 3. Betalsätt, var och en med sin
// plommonfärgade siffra i serif) och den STICKY ordersammanfattningen till höger
// (kvittorader med 48×60-miniatyrer, delsumma, totalt, "SLUTFÖR KÖP — {total}").
//
// FUNKTIONEN ÄR ORÖRD OCH DELAD (vektor-regeln): exakt samma server actions
// (reserveOrder / confirmOrder / cancelOrder / startShopCheckout), samma fält, samma
// valideringar, samma reserve-vid-mount + cancel-vid-lämning, samma CheckoutLoader och
// samma synkrona dubbelklick-vakt som app/butik/kassa/CheckoutForm.tsx.
//
// AVVIKELSER (medvetna — formen är filens, löftena är motorns):
//   · STEG 2: filen listar tre valbara leveranssätt (bud 79 kr / express 149 kr / hämta
//     fritt). Motorn har EN fulfilment per butik (tenant_modules.config) och ingen
//     frakt-modell — tre valbara priser hade varit påhittade. Steget behåller filens
//     radform men visar butikens FAKTISKA leveranssätt, förvalt.
//   · STEG 3: filen listar Kort/Swish/Klarna/PayPal/Apple Pay med kortfält. Betal-rälsen
//     är Stripe (eller betalning vid leverans) — vi renderar aldrig kortfält vi inte tar
//     emot, och listar aldrig betalsätt butiken inte har.
// Ett steg som ljuger är värre än ett steg som saknas: det är i kassan kunden betalar.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/components/storefront/shop/CartProvider'
import { CheckoutLoader } from '@/components/storefront/shop/CheckoutLoader'
import { formatShopPrice, SHOP_FULFILMENT_LABELS } from '@/lib/storefront/shop/types'
import { reserveOrder, confirmOrder, cancelOrder, startShopCheckout } from '@/app/butik/actions'
import type { ThemeCheckoutViewProps } from './types'
import s from './calytrix-checkout.module.css'

export function CalytrixCheckout({ fulfilment }: ThemeCheckoutViewProps) {
  const { lines, token, subtotalCents, clear } = useCart()
  const router = useRouter()

  const [orderId, setOrderId] = useState<string | null>(null)
  const [reserving, setReserving] = useState(true)
  const [reserveError, setReserveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fields, setFields] = useState({ name: '', email: '', phone: '', address: '', note: '' })
  const didReserve = useRef(false)
  // Dubbelbetalnings-vakt: synkron ref (state är asynkront — två snabba klick kan annars
  // skicka två confirmOrder). Dubbelbetalning = riktig bugg.
  const inFlight = useRef(false)

  const currency = lines[0]?.currency ?? 'SEK'
  const needsAddress = fulfilment === 'ship'
  const label = SHOP_FULFILMENT_LABELS[fulfilment]

  // Reservera ordern EN gång vid mount (håller lagret medan kunden fyller i).
  useEffect(() => {
    if (didReserve.current || !token || lines.length === 0) return
    didReserve.current = true
    setReserving(true)
    reserveOrder({
      items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      token,
    })
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
    return (
      <section className={s.cxCheckout}>
        <h1 className={s.cxTitle}>Kassan</h1>
        <div className={s.cxEmpty}>
          <p className={s.cxEmptyTitle}>Korgen är tom — än så länge.</p>
          <p className={s.cxEmptyText}>Någon där ute förtjänar blommor idag.</p>
          <Link href="/shop" className={s.cxBtn}>
            Till butiken
          </Link>
        </div>
      </section>
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
    // Betalning krävs (bakom payments_enabled) → Stripe. inFlight släpps ALDRIG efter
    // lyckat köp: knappen förblir låst under redirecten.
    if (res.requiresPayment) {
      const co = await startShopCheckout(res.orderId)
      if (co.ok) {
        clear()
        window.location.href = co.url
        return
      }
    }
    clear()
    router.push(`/bekraftelse/${res.orderId}`)
  }

  // v1: total = delsumma (frakt/moms additivt senare). Full kostnad visas FÖRE köp.
  const pending = submitting || reserving || !orderId
  const itemCount = lines.reduce((a, l) => a + l.quantity, 0)

  return (
    <section className={s.cxCheckout}>
      <h1 className={s.cxTitle}>Kassan</h1>
      <p className={s.cxLede}>
        Säker betalning · {itemCount} {itemCount === 1 ? 'artikel' : 'artiklar'}
      </p>

      <form onSubmit={onSubmit} className={s.cxGrid} noValidate>
        <div className={s.cxSteps}>
          {/* ── STEG 1 — LEVERANSUPPGIFTER ── */}
          <fieldset className={s.cxStep}>
            <legend className={s.cxStepHead}>
              <span className={s.cxStepNo} aria-hidden="true">
                1.
              </span>
              <span className={s.cxStepTitle}>Leveransuppgifter</span>
            </legend>
            <div className={s.cxFields}>
              <Field
                id="cx-name"
                label="Mottagarens namn"
                placeholder="För- och efternamn"
                value={fields.name}
                onChange={(v) => setFields((f) => ({ ...f, name: v }))}
                autoComplete="name"
                required
              />
              <Field
                id="cx-phone"
                label="Telefon"
                type="tel"
                placeholder="07x-xxx xx xx"
                value={fields.phone}
                onChange={(v) => setFields((f) => ({ ...f, phone: v }))}
                autoComplete="tel"
                required
              />
              <Field
                id="cx-email"
                label="E-post"
                type="email"
                placeholder="namn@mail.se"
                value={fields.email}
                onChange={(v) => setFields((f) => ({ ...f, email: v }))}
                autoComplete="email"
                required
                wide={!needsAddress}
              />
              {needsAddress ? (
                <Field
                  id="cx-address"
                  label="Adress"
                  placeholder="Gata och nummer"
                  value={fields.address}
                  onChange={(v) => setFields((f) => ({ ...f, address: v }))}
                  autoComplete="street-address"
                  required
                />
              ) : null}
              <div className={`${s.cxField} ${s.cxFieldWide}`}>
                <label htmlFor="cx-note" className={s.cxLabel}>
                  Hälsning på kortet (valfritt)
                </label>
                <textarea
                  id="cx-note"
                  rows={2}
                  placeholder="Skrivs för hand av floristen…"
                  className={s.cxTextarea}
                  value={fields.note}
                  onChange={(e) => setFields((f) => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
          </fieldset>

          {/* ── STEG 2 — LEVERANSSÄTT (butikens faktiska, förvalt) ── */}
          <div className={s.cxStep}>
            <p className={s.cxStepHead}>
              <span className={s.cxStepNo} aria-hidden="true">
                2.
              </span>
              <span className={s.cxStepTitle}>Leveranssätt</span>
            </p>
            <div className={s.cxOption} data-selected="">
              <span className={s.cxDot} aria-hidden="true" />
              <span className={s.cxOptionBody}>
                <span className={s.cxOptionName}>{label}</span>
                <span className={s.cxOptionDesc}>
                  {needsAddress
                    ? 'Vi skickar beställningen till adressen du fyllt i ovan.'
                    : 'Vi hör av oss när beställningen är redo att hämtas i butiken.'}
                </span>
              </span>
            </div>
          </div>

          {/* ── STEG 3 — BETALSÄTT ── */}
          <div className={s.cxStep}>
            <p className={s.cxStepHead}>
              <span className={s.cxStepNo} aria-hidden="true">
                3.
              </span>
              <span className={s.cxStepTitle}>Betalsätt</span>
            </p>
            <div className={s.cxOption} data-selected="">
              <span className={s.cxDot} aria-hidden="true" />
              <span className={s.cxOptionBody}>
                <span className={s.cxOptionName}>Betala vid leverans eller upphämtning</span>
                <span className={s.cxOptionDesc}>
                  Kräver butiken förskottsbetalning skickas du vidare till den säkra
                  betalsidan när du slutför köpet.
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* ── ORDERSAMMANFATTNING (sticky) ── */}
        <aside className={s.cxSummary} aria-label="Din beställning">
          <h2 className={s.cxSummaryTitle}>Din beställning</h2>

          <ul className={s.cxRows}>
            {lines.map((l) => (
              <li key={l.variantId} className={s.cxRow}>
                <span
                  className={s.cxRowPhoto}
                  aria-hidden="true"
                  style={l.imageUrl ? { backgroundImage: `url(${l.imageUrl})` } : undefined}
                />
                <span className={s.cxRowBody}>
                  <span className={s.cxRowName}>{l.productName}</span>
                  <span className={s.cxRowQty}>{l.quantity} st</span>
                </span>
                <span className={s.cxRowPrice}>
                  {formatShopPrice(l.priceCents * l.quantity, l.currency)}
                </span>
              </li>
            ))}
          </ul>

          <div className={s.cxSumRow}>
            <span className={s.cxSumLabel}>Delsumma</span>
            <span className={s.cxSumValue}>{formatShopPrice(subtotalCents, currency)}</span>
          </div>
          <div className={s.cxSumTotal}>
            <span>Totalt</span>
            <span className={s.cxSumTotalValue}>{formatShopPrice(subtotalCents, currency)}</span>
          </div>

          {reserveError ? (
            <p role="alert" className={s.cxAlert}>
              {reserveError}{' '}
              <Link href="/shop" className={s.cxAlertLink}>
                Tillbaka till butiken
              </Link>
            </p>
          ) : null}
          {formError ? (
            <p role="alert" className={s.cxAlert}>
              {formError}
            </p>
          ) : null}

          {submitting ? <CheckoutLoader /> : null}

          <button
            type="submit"
            className={s.cxCta}
            disabled={pending}
            aria-busy={submitting || reserving}
          >
            {submitting
              ? 'Slutför…'
              : reserving
                ? 'Förbereder…'
                : `Slutför köp — ${formatShopPrice(subtotalCents, currency)}`}
          </button>
          <p className={s.cxFine}>🔒 Dina uppgifter används bara för denna beställning.</p>
        </aside>
      </form>
    </section>
  )
}

/** Fältet: filens etikett i versal mikrotext ovanför en 2px-inramad input. */
function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  required = false,
  wide = false,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  autoComplete?: string
  required?: boolean
  wide?: boolean
}) {
  return (
    <div className={`${s.cxField} ${wide ? s.cxFieldWide : ''}`}>
      <label htmlFor={id} className={s.cxLabel}>
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={s.cxInput}
      />
    </div>
  )
}
