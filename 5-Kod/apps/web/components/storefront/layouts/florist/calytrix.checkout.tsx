'use client'

// CALYTRIX — KASSAN (goal-64). 3-STEGSKASSAN ÄR MALLENS IDENTITET.
//
// EXAKT KOPIA av `showKassa` i "Calytrix - E-handel.dc.html": "Kassan" i 56px serif,
// "Säker betalning · N artiklar", sedan 1.7fr/1fr — de tre vita kantade stegkorten till
// vänster (1. Leveransuppgifter · 2. Leveranssätt · 3. Betalsätt, var och en med sin
// plommonfärgade siffra i serif) och den STICKY ordersammanfattningen till höger
// (kvittorader med 48×60-miniatyrer, delsumma, LEVERANS, totalt, "SLUTFÖR KÖP — {total}").
//
// FUNKTIONEN ÄR ORÖRD OCH DELAD (vektor-regeln): useCheckout äger reserve-vid-mount,
// lager-hold-släppet vid lämning, den synkrona dubbelklick-vakten, den server-validerade
// frakten/betalsättet och betal-routingen. Mallen äger FORMEN, aldrig funktionen — en ny
// mall kan därför inte tappa köp-rälsen på vägen.
//
// AVVIKELSERNA ÄR BORTA — de var motorns luckor, aldrig designens fel:
//   · STEG 2 visade förr EN förvald fulfilment-rad, för motorn hade ingen frakt-modell och
//     shipping_cents var alltid 0 (totalen ljög så fort filen visade en fraktrad). Nu
//     VÄLJER kunden bland butikens EGNA leveransval (shop_shipping_options) och totalen
//     bär frakten. 0 kr skrivs "Fritt" — filens ord.
//   · STEG 3 sade "betala vid leverans", för betal-rälsen var pausad. Nu renderas de
//     betalsätt butiken FAKTISKT har (Kort · Swish · Klarna · PayPal · Apple Pay) med
//     filens hinttexter VERBATIM (SHOP_PAYMENT_METHODS).
//
// Regeln som styrde avvikelserna står kvar och gäller fortfarande: ett steg som ljuger är
// värre än ett steg som saknas. Har butiken inga leveransval / inga kopplade betalsätt
// renderas de listorna inte alls — vi hittar aldrig på ett alternativ eller ett pris.

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/components/storefront/shop/CartProvider'
import { CheckoutLoader } from '@/components/storefront/shop/CheckoutLoader'
import { useCheckout } from '@/components/storefront/shop/useCheckout'
import {
  formatShopPrice,
  formatShippingPrice,
  paymentMethodSpec,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { ThemeCheckoutViewProps } from './types'
import s from './calytrix-checkout.module.css'

export function CalytrixCheckout({
  fulfilment,
  shippingOptions,
  paymentMethods,
}: ThemeCheckoutViewProps) {
  const { lines } = useCart()

  const {
    orderId,
    reserving,
    reserveError,
    submitting,
    shippingId,
    setShippingId,
    paymentMethod,
    setPaymentMethod,
    totals,
    currency,
    placeOrder,
  } = useCheckout({ shippingOptions, paymentMethods })

  const [formError, setFormError] = useState<string | null>(null)
  const [fields, setFields] = useState({ name: '', email: '', phone: '', address: '', note: '' })

  const needsAddress = fulfilment === 'ship'

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
    setFormError(null)
    const name = fields.name.trim()
    const email = fields.email.trim()
    const phone = fields.phone.trim()
    if (!name || !email || !phone) return setFormError('Fyll i namn, e-post och telefon.')
    if (!/.+@.+\..+/.test(email)) return setFormError('Kontrollera e-postadressen.')
    if (needsAddress && !fields.address.trim()) return setFormError('Fyll i leveransadress.')

    const err = await placeOrder({
      name,
      email,
      phone,
      shipAddress: needsAddress ? fields.address.trim() : undefined,
      note: fields.note.trim() || undefined,
    })
    if (err) setFormError(err)
  }

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

          {/* ── STEG 2 — LEVERANSSÄTT (butikens EGNA val, butikens EGNA priser) ── */}
          <div className={s.cxStep}>
            <p className={s.cxStepHead}>
              <span className={s.cxStepNo} aria-hidden="true">
                2.
              </span>
              <span className={s.cxStepTitle}>Leveranssätt</span>
            </p>
            {shippingOptions.length > 0 ? (
              <div role="radiogroup" aria-label="Leveranssätt">
                {shippingOptions.map((o) => {
                  const selected = shippingId === o.id
                  return (
                    <label key={o.id} className={s.cxOptionRow}>
                      {/* Radion är den RIKTIGA kontrollen (tangentbord/skärmläsare);
                          pricken nedan är dess bild. */}
                      <input
                        type="radio"
                        name="cx-shipping"
                        className={s.cxRadio}
                        value={o.id}
                        checked={selected}
                        onChange={() => setShippingId(o.id)}
                      />
                      <span className={s.cxOption} data-selected={selected ? '' : 'false'}>
                        <span className={s.cxDot} aria-hidden="true" />
                        <span className={s.cxOptionBody}>
                          <span className={s.cxOptionName}>{o.name}</span>
                          {o.description ? (
                            <span className={s.cxOptionDesc}>{o.description}</span>
                          ) : null}
                        </span>
                        <span className={s.cxOptionPrice}>
                          {formatShippingPrice(o.costCents, currency)}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : (
              // Butiken har inga leveransval → visa dess fulfilment-löfte i stället för
              // att hitta på tre alternativ. Frakten är då 0 och totalen är fortfarande sann.
              <div className={s.cxOption} data-selected="">
                <span className={s.cxDot} aria-hidden="true" />
                <span className={s.cxOptionBody}>
                  <span className={s.cxOptionName}>{SHOP_FULFILMENT_LABELS[fulfilment]}</span>
                  <span className={s.cxOptionDesc}>
                    {needsAddress
                      ? 'Vi skickar beställningen till adressen du fyllt i ovan.'
                      : 'Vi hör av oss när beställningen är redo att hämtas i butiken.'}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* ── STEG 3 — BETALSÄTT (bara de butiken FAKTISKT har) ── */}
          <div className={s.cxStep}>
            <p className={s.cxStepHead}>
              <span className={s.cxStepNo} aria-hidden="true">
                3.
              </span>
              <span className={s.cxStepTitle}>Betalsätt</span>
            </p>
            {paymentMethods.length > 0 ? (
              <div role="radiogroup" aria-label="Betalsätt">
                {paymentMethods.map((m) => {
                  const spec = paymentMethodSpec(m)
                  if (!spec) return null
                  const selected = paymentMethod === m
                  return (
                    <label key={m} className={s.cxOptionRow}>
                      <input
                        type="radio"
                        name="cx-payment"
                        className={s.cxRadio}
                        value={m}
                        checked={selected}
                        onChange={() => setPaymentMethod(m)}
                      />
                      <span className={s.cxOption} data-selected={selected ? '' : 'false'}>
                        <span className={s.cxDot} aria-hidden="true" />
                        <span className={s.cxOptionBody}>
                          <span className={s.cxOptionName}>{spec.label}</span>
                          {/* Hinttexten är designens, verbatim ur alla 12 manifest. */}
                          <span className={s.cxOptionDesc}>{spec.hint}</span>
                        </span>
                        <span className={s.cxOptionPrice}>{spec.mark}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className={s.cxOption} data-selected="">
                <span className={s.cxDot} aria-hidden="true" />
                <span className={s.cxOptionBody}>
                  <span className={s.cxOptionName}>Betala vid leverans eller upphämtning</span>
                  <span className={s.cxOptionDesc}>
                    Butiken tar inte emot betalning online än.
                  </span>
                </span>
              </div>
            )}
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

          {/* Filens summering: Delsumma · Leverans · Totalt. Fraktraden fanns i designen
              men kunde inte renderas förrän motorn hade en frakt-modell (goal-64). */}
          <div className={s.cxSumRow}>
            <span className={s.cxSumLabel}>Delsumma</span>
            <span className={s.cxSumValue}>{formatShopPrice(totals.subtotalCents, currency)}</span>
          </div>
          {shippingOptions.length > 0 ? (
            <div className={s.cxSumRow}>
              <span className={s.cxSumLabel}>Leverans</span>
              <span className={s.cxSumValue}>
                {formatShippingPrice(totals.shippingCents, currency)}
              </span>
            </div>
          ) : null}
          {totals.discountCents > 0 ? (
            <div className={s.cxSumRow}>
              <span className={s.cxSumLabel}>Rabatt</span>
              <span className={s.cxSumValue}>
                −{formatShopPrice(totals.discountCents, currency)}
              </span>
            </div>
          ) : null}
          {totals.taxCents > 0 ? (
            <div className={s.cxSumRow}>
              <span className={s.cxSumLabel}>Moms</span>
              <span className={s.cxSumValue}>{formatShopPrice(totals.taxCents, currency)}</span>
            </div>
          ) : null}
          <div className={s.cxSumTotal}>
            <span>Totalt</span>
            <span className={s.cxSumTotalValue}>{formatShopPrice(totals.totalCents, currency)}</span>
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
                : `Slutför köp — ${formatShopPrice(totals.totalCents, currency)}`}
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
