'use client'

// ATELJÉ VINTER — KASSAN (goal-64 regression). EXAKT KOPIA av filens `showKassa`:
// eyebrow "kassa — N verk — {total}", tunn rubrik "slutför", två sektioner delade av
// en mikrotext-rad mot hårlinje ("i — leverans", "ii — betalning"), leverans- och
// betalfälten som PRICKADE hårlinjerader (svart prick när valt, transparent annars),
// filens payHint under, och den fyllda "betala {total}"-knappen (block, 100%, spärrad
// 0.24em). Filens egna kortnummer/mm-åå/cvc-fält finns INTE här — se noten vid
// betalsätts-sektionen: riktig kortdata samlas på Stripes hostade sida.
//
// FUNKTIONEN ÄR ORÖRD OCH DELAD (vektor-regeln): useCheckout äger reserve-vid-mount,
// lager-hold-släppet, dubbelklicksvakten, den server-validerade frakten/betalsättet
// och betal-routingen. Mallen äger FORMEN, aldrig funktionen.
//
// Butiken har inga leveransval/kopplade betalsätt → den listan renderas inte alls;
// vi hittar aldrig på ett alternativ eller ett pris (samma regel som Calytrix).

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '../../shop/CartProvider'
import { useCheckout } from '../../shop/useCheckout'
import {
  formatShopPrice,
  formatShippingPrice,
  paymentMethodSpec,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { ThemeCheckoutViewProps } from './types'
import styles from './ateljevinter.module.css'

export function AteljeVinterCheckout({
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
  const count = lines.reduce((a, l) => a + l.quantity, 0)

  if (lines.length === 0 && !orderId) {
    return (
      <section className={styles.avPageNarrow}>
        <p className={styles.avEyebrow}>kassa</p>
        <h1 className={styles.avPageTitle}>slutför</h1>
        <div className={styles.avCartEmpty}>
          <p className={styles.avCartEmptyText}>korgen är tom.</p>
          <Link href="/shop" className={styles.avUnderline}>
            till samlingen →
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
    if (!name || !phone) return setFormError('fyll i namn och telefon.')
    if (needsAddress && !fields.address.trim()) return setFormError('fyll i leveransadress.')

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

  return (
    <section className={styles.avPageNarrow}>
      <p className={styles.avEyebrow}>
        kassa — {count} {count === 1 ? 'verk' : 'verk'} — {formatShopPrice(totals.totalCents, currency)}
      </p>
      <h1 className={styles.avPageTitle}>slutför</h1>

      <form onSubmit={onSubmit} noValidate>
        <p className={styles.avSubLabel}>i — leverans</p>
        <div className={styles.avFormRow}>
          <div>
            <label className={styles.avFieldLabel} htmlFor="av-kassa-name">
              mottagare
            </label>
            <input
              id="av-kassa-name"
              type="text"
              autoComplete="name"
              placeholder="namn"
              value={fields.name}
              onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
              className={styles.avField}
            />
          </div>
          <div>
            <label className={styles.avFieldLabel} htmlFor="av-kassa-phone">
              telefon
            </label>
            <input
              id="av-kassa-phone"
              type="tel"
              autoComplete="tel"
              placeholder="07x…"
              value={fields.phone}
              onChange={(e) => setFields((f) => ({ ...f, phone: e.target.value }))}
              className={styles.avField}
            />
          </div>
          {needsAddress ? (
            <div className={styles.avFormSpan2}>
              <label className={styles.avFieldLabel} htmlFor="av-kassa-address">
                adress
              </label>
              <input
                id="av-kassa-address"
                type="text"
                autoComplete="street-address"
                placeholder="gata, postnummer, ort"
                value={fields.address}
                onChange={(e) => setFields((f) => ({ ...f, address: e.target.value }))}
                className={styles.avField}
              />
            </div>
          ) : null}
        </div>

        <div className={styles.avOptionList}>
          {shippingOptions.length > 0 ? (
            shippingOptions.map((o) => {
              const selected = shippingId === o.id
              return (
                <label key={o.id} className={styles.avOptionRow}>
                  <input
                    type="radio"
                    name="av-shipping"
                    value={o.id}
                    checked={selected}
                    onChange={() => setShippingId(o.id)}
                    className={styles.avOptionInput}
                  />
                  <span className={styles.avOptionDot} data-on={selected ? 'true' : undefined} />
                  <span className={styles.avOptionName}>{o.name}</span>
                  <span className={styles.avOptionPrice}>
                    {formatShippingPrice(o.costCents, currency)}
                  </span>
                </label>
              )
            })
          ) : (
            <p className={styles.avOptionFallback}>{SHOP_FULFILMENT_LABELS[fulfilment]}</p>
          )}
        </div>

        <p className={styles.avSubLabel}>ii — betalning</p>
        <div className={styles.avOptionList}>
          {paymentMethods.length > 0 ? (
            paymentMethods.map((m) => {
              const spec = paymentMethodSpec(m)
              if (!spec) return null
              const selected = paymentMethod === m
              return (
                <label key={m} className={styles.avOptionRow}>
                  <input
                    type="radio"
                    name="av-payment"
                    value={m}
                    checked={selected}
                    onChange={() => setPaymentMethod(m)}
                    className={styles.avOptionInput}
                  />
                  <span className={styles.avOptionDot} data-on={selected ? 'true' : undefined} />
                  <span className={styles.avOptionName}>{spec.label}</span>
                  <span className={styles.avOptionNote}>{spec.mark}</span>
                </label>
              )
            })
          ) : (
            <p className={styles.avOptionFallback}>betala vid leverans eller upphämtning</p>
          )}
        </div>

        {/* Filens kort-fält (kortnummer/mm-åå/cvc) finns INTE här: riktig kortdata
            samlas på Stripes egen hostade sida efter startShopCheckout-redirecten,
            aldrig i vårt formulär. Ett fält som inte skickar något vore dött UI —
            samma regel som Calytrix, som inte heller ritar dem. */}
        {paymentMethods.length > 0 && paymentMethod ? (
          <p className={styles.avPayHint}>{paymentMethodSpec(paymentMethod)?.hint}</p>
        ) : null}

        {reserveError ? <p className={styles.avFormError}>{reserveError}</p> : null}
        {formError ? <p className={styles.avFormError}>{formError}</p> : null}

        <button type="submit" className={styles.avSolidWide} disabled={pending}>
          {submitting
            ? 'betalar…'
            : reserving
              ? 'förbereder…'
              : `betala ${formatShopPrice(totals.totalCents, currency)}`}
        </button>
        <p className={styles.avPaySafe}>krypterad betalning — verket binds först efter bekräftelse</p>
      </form>
    </section>
  )
}
