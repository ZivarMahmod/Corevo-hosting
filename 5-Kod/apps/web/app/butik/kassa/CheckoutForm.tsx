'use client'

// Webshop-kassa-formulär (köp-räls, goal-49). Gäst-checkout mest framträdande
// (konto EFTER köp), ≤8 fält, FULL KOSTNAD synlig FÖRE köp-knappen, adaptiv
// inline-validering, trust-rad. Reserverar ordern vid mount (håller lager under
// ifyllnad, 30-min TTL); bekräftar vid submit. Betal-rails pausade → "betala vid
// leverans/upphämtning" (Stripe-steget tänds i Fas 3 bakom payments_enabled).
//
// goal-60: styling flyttad till checkout-form.module.css (inline kunde inte bära
// :focus/:hover/:invalid och ingen mall kunde nå in — sista steget i köpet var dömt
// att bli en grå blankett). Betalknappen har nu ett ÄKTA pending-läge: spinner +
// dubbelklick-vakt. FORMEN flyttade, FUNKTIONEN (validering, server actions,
// felmeddelanden, lager-hold) står orörd.

import { useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/components/storefront/shop/CartProvider'
import { CheckoutLoader } from '@/components/storefront/shop/CheckoutLoader'
import { useCheckout } from '@/components/storefront/shop/useCheckout'
import {
  formatShopPrice,
  formatShippingPrice,
  paymentMethodSpec,
  type ShippingOption,
  type ShopFulfilment,
  type ShopPaymentMethod,
} from '@/lib/storefront/shop/types'
import s from './checkout-form.module.css'

export function CheckoutForm({
  fulfilment,
  // goal-64: kundens leveransval + de betalsätt som FAKTISKT är kopplade. Tomma listor
  // = dagens beteende (inget val-steg, "betalas vid leverans/upphämtning").
  shippingOptions = [],
  paymentMethods = [],
}: {
  fulfilment: ShopFulfilment
  shippingOptions?: ShippingOption[]
  paymentMethods?: ShopPaymentMethod[]
}) {
  const { lines } = useCart()

  // FUNKTIONEN är delad (useCheckout): reserve-vid-mount, lager-hold-släpp, dubbelklick-
  // vakt, server-validerad frakt/betalsätt och betal-routingen. Formen är denna sidas.
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
      <div>
        <p className={s.emptyText}>Din varukorg är tom.</p>
        <Link href="/" className={s.alertLink}>
          ← Tillbaka till butiken
        </Link>
      </div>
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

  return (
    <div className={s.wrap}>
      {/* Ordersammanfattning — synlig FÖRE köp-knappen (Baymard: full kostnad först). */}
      <div className={s.summary}>
        <h2 className={s.summaryTitle}>Din beställning</h2>
        {lines.map((l) => (
          <div key={l.variantId} className={s.item}>
            <span>
              {l.productName}
              {l.variantName && l.variantName !== 'Standard' ? ` (${l.variantName})` : ''} × {l.quantity}
            </span>
            <span className={s.money}>{formatShopPrice(l.priceCents * l.quantity, l.currency)}</span>
          </div>
        ))}
        {/* SUMMERINGEN (goal-64): delsumma + frakt − rabatt + moms = totalt. Fraktraden
            visas bara när butiken HAR leveransval — annars vore den en tom rad om ingenting.
            Rabatt/moms visas bara när de är satta (rabattkoder byggs senare; fältet finns). */}
        <div className={s.rule}>
          <Row label="Delsumma" value={formatShopPrice(totals.subtotalCents, currency)} />
          {shippingOptions.length > 0 ? (
            <Row label="Leverans" value={formatShippingPrice(totals.shippingCents, currency)} />
          ) : null}
          {totals.discountCents > 0 ? (
            <Row label="Rabatt" value={`−${formatShopPrice(totals.discountCents, currency)}`} />
          ) : null}
          {totals.taxCents > 0 ? (
            <Row label="Moms" value={formatShopPrice(totals.taxCents, currency)} />
          ) : null}
        </div>
        <div className={s.total}>
          <span>Att betala</span>
          <span className={s.money}>{formatShopPrice(totals.totalCents, currency)}</span>
        </div>
        {paymentMethods.length === 0 ? (
          <p className={s.fine}>Betalas vid leverans/upphämtning.</p>
        ) : null}
      </div>

      {reserveError ? (
        <p role="alert" className={s.alert}>
          {reserveError}{' '}
          <Link href="/" className={s.alertLink}>
            Tillbaka till butiken
          </Link>
        </p>
      ) : null}

      {/* Gäst-checkout (konto efter köp). ≤8 fält. */}
      <form onSubmit={onSubmit} className={s.form} noValidate>
        {/* goal-62 E5: fem fält låg i EN oavbruten radda — kassan läste som ett formulär
            att beta av, inte som två frågor ("vem är du?" / "vart ska det?"). Grupperade
            i fieldset+legend: samma fält, samma ordning, men steg-känslan kommer gratis
            och skärmläsaren annonserar gruppen. */}
        <fieldset className={s.group}>
          <legend className={s.legend}>Dina uppgifter</legend>
          <Field id="name" label="Namn" value={fields.name} onChange={(v) => setFields((f) => ({ ...f, name: v }))} autoComplete="name" required />
          <Field id="email" label="E-post" type="email" value={fields.email} onChange={(v) => setFields((f) => ({ ...f, email: v }))} autoComplete="email" required />
          <Field id="phone" label="Telefon" type="tel" value={fields.phone} onChange={(v) => setFields((f) => ({ ...f, phone: v }))} autoComplete="tel" required />
        </fieldset>

        <fieldset className={s.group}>
          <legend className={s.legend}>{needsAddress ? 'Leverans' : 'Till beställningen'}</legend>
          {needsAddress ? (
            <Field id="address" label="Leveransadress" value={fields.address} onChange={(v) => setFields((f) => ({ ...f, address: v }))} autoComplete="street-address" required />
          ) : null}
          <Field id="note" label="Meddelande (valfritt)" value={fields.note} onChange={(v) => setFields((f) => ({ ...f, note: v }))} />
        </fieldset>

        {/* LEVERANSSÄTT (goal-64) — kundens egna val, med kundens egna priser. Butiken
            har inga val → hela steget uteblir (vi hittar aldrig på ett alternativ). */}
        {shippingOptions.length > 0 ? (
          <fieldset className={s.group}>
            <legend className={s.legend}>Leveranssätt</legend>
            {shippingOptions.map((o) => (
              <label key={o.id} htmlFor={`ship-${o.id}`} className={s.label}>
                <span className={s.labelText}>
                  <input
                    id={`ship-${o.id}`}
                    type="radio"
                    name="shipping"
                    value={o.id}
                    checked={shippingId === o.id}
                    onChange={() => setShippingId(o.id)}
                  />{' '}
                  {o.name} — {formatShippingPrice(o.costCents, currency)}
                  {o.description ? <span className={s.fine}> {o.description}</span> : null}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {/* BETALSÄTT (goal-64) — BARA de som är påslagna OCH kopplade. Hinttexten är
            designens, verbatim (SHOP_PAYMENT_METHODS). Inga betalsätt → inget steg. */}
        {paymentMethods.length > 0 ? (
          <fieldset className={s.group}>
            <legend className={s.legend}>Betalsätt</legend>
            {paymentMethods.map((m) => {
              const spec = paymentMethodSpec(m)
              if (!spec) return null
              return (
                <label key={m} htmlFor={`pay-${m}`} className={s.label}>
                  <span className={s.labelText}>
                    <input
                      id={`pay-${m}`}
                      type="radio"
                      name="payment"
                      value={m}
                      checked={paymentMethod === m}
                      onChange={() => setPaymentMethod(m)}
                    />{' '}
                    {spec.label}
                    <span className={s.fine}> {spec.hint}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>
        ) : null}

        {formError ? (
          <p role="alert" className={s.alert}>
            {formError}
          </p>
        ) : null}

        {/* goal-61: köpets mest nervösa sekund (uppgifterna skickade, svaret i luften)
            hade köp-rälsens minsta signal — en 13px-spinner. Nu en overlay som berättar
            VAD som händer. Bara under submitting: reserving sker vid mount och är snabb,
            där räcker knapptexten. */}
        {submitting ? <CheckoutLoader /> : null}

        <button type="submit" className={s.submit} disabled={pending} aria-busy={submitting || reserving}>
          {submitting ? (
            <>
              <span className={s.spinner} aria-hidden="true" />
              Slutför…
            </>
          ) : reserving ? (
            <>
              <span className={s.spinner} aria-hidden="true" />
              Förbereder…
            </>
          ) : (
            'Slutför beställning'
          )}
        </button>
        <p className={s.trust}>🔒 Dina uppgifter används bara för denna beställning.</p>
      </form>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <span className={s.money}>{value}</span>
    </div>
  )
}

function Field({
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
    <label htmlFor={id} className={s.label}>
      <span className={s.labelText}>
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={s.field}
      />
    </label>
  )
}
