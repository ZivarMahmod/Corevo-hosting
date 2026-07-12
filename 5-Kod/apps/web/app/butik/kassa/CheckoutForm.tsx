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

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/components/storefront/shop/CartProvider'
import { CheckoutLoader } from '@/components/storefront/shop/CheckoutLoader'
import { formatShopPrice, type ShopFulfilment } from '@/lib/storefront/shop/types'
import { reserveOrder, confirmOrder, cancelOrder, startShopCheckout } from '../actions'
import s from './checkout-form.module.css'

export function CheckoutForm({ fulfilment }: { fulfilment: ShopFulfilment }) {
  const { lines, token, subtotalCents, clear } = useCart()
  const router = useRouter()

  const [orderId, setOrderId] = useState<string | null>(null)
  const [reserving, setReserving] = useState(true)
  const [reserveError, setReserveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fields, setFields] = useState({ name: '', email: '', phone: '', address: '', note: '' })
  const didReserve = useRef(false)
  // Dubbelbetalnings-vakt. `disabled` + pointer-events är den VISUELLA halvan; en ref
  // som sätts synkront är den riktiga — state-uppdateringar är asynkrona, så två snabba
  // klick (eller Enter + klick) kan annars hinna in i samma render och skicka två
  // confirmOrder. En dubbelbetalning är en riktig bugg.
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
    // Betalning krävs (Fas 3, bakom payments_enabled) → starta Stripe Checkout.
    // Misslyckas/otillgänglig → fall igenom till bekräftelsen (ordern står awaiting,
    // ärlig vy). Default (rälsen av) → requiresPayment=false → direkt bekräftelse.
    // inFlight släpps ALDRIG här: vi navigerar bort, och knappen ska förbli låst
    // under redirecten (annars kan kunden hinna klicka igen medan sidan byter).
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
  const totalCents = subtotalCents
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
        <div className={s.rule}>
          <Row label="Delsumma" value={formatShopPrice(subtotalCents, currency)} />
        </div>
        <div className={s.total}>
          <span>Att betala</span>
          <span className={s.money}>{formatShopPrice(totalCents, currency)}</span>
        </div>
        <p className={s.fine}>Betalas vid leverans/upphämtning.</p>
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
