'use client'

// Webshop-kassa-formulär (köp-räls, goal-49). Gäst-checkout mest framträdande
// (konto EFTER köp), ≤8 fält, FULL KOSTNAD synlig FÖRE köp-knappen, adaptiv
// inline-validering, trust-rad. Reserverar ordern vid mount (håller lager under
// ifyllnad, 30-min TTL); bekräftar vid submit. Betal-rails pausade → "betala vid
// leverans/upphämtning" (Stripe-steget tänds i Fas 3 bakom payments_enabled).

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart } from '@/components/storefront/shop/CartProvider'
import { formatShopPrice, type ShopFulfilment } from '@/lib/storefront/shop/types'
import { reserveOrder, confirmOrder, cancelOrder, startShopCheckout } from '../actions'

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
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 16 }}>Din varukorg är tom.</p>
        <Link href="/" style={{ color: 'var(--color-accent, #C8A24A)' }}>← Tillbaka till butiken</Link>
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
    if (!orderId) return setFormError('Beställningen är inte redo — ladda om sidan.')

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
      setSubmitting(false)
      setFormError(res.message)
      return
    }
    // Betalning krävs (Fas 3, bakom payments_enabled) → starta Stripe Checkout.
    // Misslyckas/otillgänglig → fall igenom till bekräftelsen (ordern står awaiting,
    // ärlig vy). Default (rälsen av) → requiresPayment=false → direkt bekräftelse.
    if (res.requiresPayment) {
      const co = await startShopCheckout(res.orderId)
      if (co.ok) {
        clear()
        window.location.href = co.url
        return
      }
    }
    clear()
    router.push(`/butik/bekraftelse/${res.orderId}`)
  }

  // v1: total = delsumma (frakt/moms additivt senare). Full kostnad visas FÖRE köp.
  const totalCents = subtotalCents

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {/* Ordersammanfattning — synlig FÖRE köp-knappen (Baymard: full kostnad först). */}
      <div
        style={{
          padding: 18,
          background: 'color-mix(in srgb, var(--color-fg, #232520) 3%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 10%, transparent)',
          borderRadius: 'calc(var(--radius, 4px) * 2)',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700 }}>Din beställning</h2>
        {lines.map((l) => (
          <div key={l.variantId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
            <span>
              {l.productName}
              {l.variantName && l.variantName !== 'Standard' ? ` (${l.variantName})` : ''} × {l.quantity}
            </span>
            <span>{formatShopPrice(l.priceCents * l.quantity, l.currency)}</span>
          </div>
        ))}
        <div style={{ marginTop: 10, borderTop: '1px solid color-mix(in srgb, var(--color-fg, #232520) 12%, transparent)', paddingTop: 10, fontSize: 14 }}>
          <Row label="Delsumma" value={formatShopPrice(subtotalCents, currency)} />
          <Row label="Frakt" value="0 kr" />
          <Row label="Moms" value="Ingår" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontWeight: 700, fontSize: 16 }}>
          <span>Att betala</span>
          <span>{formatShopPrice(totalCents, currency)}</span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.6 }}>Betalas vid leverans/upphämtning.</p>
      </div>

      {reserveError ? (
        <div role="alert" style={{ color: '#b00020', fontSize: 14 }}>
          {reserveError} <Link href="/" style={{ color: 'var(--color-accent, #C8A24A)' }}>Tillbaka till butiken</Link>
        </div>
      ) : null}

      {/* Gäst-checkout (konto efter köp). ≤8 fält. */}
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }} noValidate>
        <Field id="name" label="Namn" value={fields.name} onChange={(v) => setFields((f) => ({ ...f, name: v }))} autoComplete="name" required />
        <Field id="email" label="E-post" type="email" value={fields.email} onChange={(v) => setFields((f) => ({ ...f, email: v }))} autoComplete="email" required />
        <Field id="phone" label="Telefon" type="tel" value={fields.phone} onChange={(v) => setFields((f) => ({ ...f, phone: v }))} autoComplete="tel" required />
        {needsAddress ? (
          <Field id="address" label="Leveransadress" value={fields.address} onChange={(v) => setFields((f) => ({ ...f, address: v }))} autoComplete="street-address" required />
        ) : null}
        <Field id="note" label="Meddelande (valfritt)" value={fields.note} onChange={(v) => setFields((f) => ({ ...f, note: v }))} />

        {formError ? <div role="alert" style={{ color: '#b00020', fontSize: 14 }}>{formError}</div> : null}

        <button
          type="submit"
          disabled={submitting || reserving || !orderId}
          style={{
            marginTop: 4,
            padding: '14px 18px',
            fontFamily: 'var(--font-ui)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--color-bg, #fff)',
            background: 'var(--color-accent, #C8A24A)',
            border: 'none',
            borderRadius: 'var(--radius, 4px)',
            cursor: submitting || reserving || !orderId ? 'wait' : 'pointer',
            opacity: submitting || reserving || !orderId ? 0.7 : 1,
          }}
        >
          {submitting ? 'Slutför…' : reserving ? 'Förbereder…' : 'Slutför beställning'}
        </button>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.6, textAlign: 'center' }}>
          🔒 Dina uppgifter används bara för denna beställning.
        </p>
      </form>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      <span>{value}</span>
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
    <label htmlFor={id} style={{ display: 'grid', gap: 5, fontFamily: 'var(--font-ui)', fontSize: 13 }}>
      <span style={{ fontWeight: 600 }}>
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
        style={{
          padding: '11px 12px',
          fontSize: 15,
          fontFamily: 'var(--font-body)',
          color: 'var(--color-fg, #232520)',
          background: 'var(--color-bg, #fff)',
          border: '1px solid color-mix(in srgb, var(--color-fg, #232520) 20%, transparent)',
          borderRadius: 'var(--radius, 4px)',
        }}
      />
    </label>
  )
}
