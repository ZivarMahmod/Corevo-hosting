'use client'

// KASSANS FUNKTION — EN gång, delad av alla mallar (goal-64, vektor-regeln).
//
// Mallen äger FORMEN på kassan (Calytrix tre kantade stegkort, Ateljé Vinters
// minimalism, Källas spa-lugn). FUNKTIONEN — reservera → välj leverans → välj betalsätt
// → bekräfta → betala — är EN och densamma, och bor här. En ny mall som bygger sin egen
// kassa ärver därmed lager-holden, dubbelklick-vakten, betal-routingen och den ärliga
// totalen utan att kunna tappa dem på vägen.
//
// HÅRDA REGLER som är inbyggda här:
//   • Klienten skickar bara ID:t på leveransvalet — ALDRIG ett belopp. Servern
//     (confirm_shop_order, 0058) slår upp priset ur DB och räknar om totalen.
//   • Totalen som visas räknas med SAMMA formel som servern (orderTotals) — den är en
//     spegling, inte en egen sanning.
//   • Ett betalsätt som inte står i `paymentMethods` kan inte väljas (och renderas inte).

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from './CartProvider'
import {
  orderTotals,
  shippingCostCents,
  cartLineToReserveItem,
  type OrderTotals,
  type ShippingOption,
  type ShopFulfilment,
  type ShopPaymentMethod,
} from '@/lib/storefront/shop/types'
import {
  reserveOrder,
  confirmOrder,
  cancelOrder,
  startShopCheckout,
  startPaypalCheckout,
} from '@/lib/storefront/shop/actions'

export type CheckoutCustomer = {
  name: string
  email: string
  phone: string
  shipAddress?: string
  note?: string
  /** Plan 003: varuköp på distans kräver aktivt godkännande av köpvillkor +
   *  ångerrättsinfo. Servern (confirmOrder) validerar — UI:t kan aldrig hoppa över. */
  acceptTerms?: boolean
}

export type UseCheckout = {
  orderId: string | null
  reserving: boolean
  reserveError: string | null
  submitting: boolean
  /** Valt leveranssätt (id). null = butiken har inga val → frakt 0. */
  shippingId: string | null
  setShippingId: (id: string) => void
  /** Valt betalsätt. null = butiken tar inte betalt online. */
  paymentMethod: ShopPaymentMethod | null
  setPaymentMethod: (m: ShopPaymentMethod) => void
  /** Delsumma · frakt · rabatt · moms · total — samma formel som servern. */
  totals: OrderTotals
  currency: string
  /** Slutför köpet. Returnerar ett felmeddelande, eller null när vi navigerar bort. */
  placeOrder: (customer: CheckoutCustomer) => Promise<string | null>
}

export function useCheckout(args: {
  fulfilment: ShopFulfilment
  shippingOptions: ShippingOption[]
  paymentMethods: ShopPaymentMethod[]
}): UseCheckout {
  const { fulfilment, shippingOptions, paymentMethods } = args
  const { lines, token, subtotalCents, clear } = useCart()
  const router = useRouter()

  const [orderId, setOrderId] = useState<string | null>(null)
  const [reserving, setReserving] = useState(true)
  const [reserveError, setReserveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Förval: butikens FÖRSTA leveransval (sort_order) — designen har alltid ett förvalt
  // alternativ. Inga val → null → inget val-steg, frakt 0 (dagens beteende).
  const [shippingId, setShippingId] = useState<string | null>(shippingOptions[0]?.id ?? null)
  const [paymentMethod, setPaymentMethod] = useState<ShopPaymentMethod | null>(
    paymentMethods[0] ?? null,
  )
  const [reserveRequestId] = useState(() => crypto.randomUUID())

  const didReserve = useRef(false)
  // Dubbelbetalnings-vakt: synkron ref (state är asynkront — två snabba klick kan annars
  // skicka två confirmOrder). Dubbelbetalning är en riktig bugg.
  const inFlight = useRef(false)
  const confirmedOrder = useRef<{ orderId: string; requiresPayment: boolean } | null>(null)

  const currency = lines[0]?.currency ?? 'SEK'

  // Reservera ordern EN gång vid mount (håller lagret medan kunden fyller i).
  useEffect(() => {
    if (didReserve.current || !token || lines.length === 0) return
    didReserve.current = true
    setReserving(true)
    // goal-64: korgen kan bära produkter, presentkort OCH kursplatser.
    // cartLineToReserveItem översätter raden till sitt VAL (variant / belopp / tillfälle) —
    // aldrig till ett pris. Servern (0059) slår upp priset och räknar totalen.
    reserveOrder({ items: lines.map(cartLineToReserveItem), token, reserveRequestId })
      .then((r) => {
        if (r.ok) setOrderId(r.orderId)
        else setReserveError(r.message)
      })
      .catch(() => setReserveError('Något gick fel. Försök igen.'))
      .finally(() => setReserving(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, reserveRequestId])

  // Släpp lager-holdet om kunden lämnar kassan utan att slutföra.
  useEffect(() => {
    return () => {
      // inFlight is synchronous and remains true across a successful provider
      // redirect. State captured when this effect was created would still say
      // submitting=false and could otherwise release the paid order's stock hold.
      if (orderId && token && !inFlight.current) void cancelOrder(orderId, token)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  // Frakten är DISPLAY: priset härleds ur det valda alternativets DB-värde som redan
  // laddats server-side. Servern slår upp det IGEN vid confirm — kan alltså inte fejkas.
  const totals = orderTotals({
    subtotalCents,
    shippingCents: shippingCostCents(shippingOptions, shippingId),
    // Rabattkoder är inte byggda än — men räkningen går genom fältet (goal-64).
    discountCents: 0,
    taxCents: 0,
  })

  const placeOrder = async (customer: CheckoutCustomer): Promise<string | null> => {
    if (inFlight.current) return null // dubbelklick-vakt (synkron, till skillnad från state)

    const name = customer.name.trim()
    const email = customer.email.trim()
    const phone = customer.phone.trim()
    const shipAddress = customer.shipAddress?.trim() || undefined
    const note = customer.note?.trim() || undefined
    if (!name || !email || !phone) return 'Fyll i namn, e-post och telefon.'
    if (!/.+@.+\..+/.test(email)) return 'Kontrollera e-postadressen.'
    if (fulfilment === 'ship' && !shipAddress) return 'Fyll i leveransadress.'
    if (customer.acceptTerms !== true) return 'Godkänn köpvillkoren för att slutföra köpet.'

    if (!orderId) return 'Beställningen är inte redo — ladda om sidan.'
    // Har butiken leveransval MÅSTE ett vara valt (servern kräver det också — 0058).
    if (shippingOptions.length > 0 && !shippingId) return 'Välj ett leveranssätt.'
    if (paymentMethods.length > 0 && !paymentMethod) return 'Välj ett betalsätt.'

    inFlight.current = true
    setSubmitting(true)

    try {
      let res = confirmedOrder.current
      if (!res) {
        const confirmation = await confirmOrder({
          orderId,
          token,
          name,
          email,
          phone,
          shipAddress,
          note,
          shippingOptionId: shippingId, // BARA id:t — priset är serverns
          paymentMethod,
          acceptTerms: true,
        })
        if (!confirmation.ok) {
          inFlight.current = false
          setSubmitting(false)
          return confirmation.message
        }
        confirmedOrder.current = confirmation
        res = confirmation
      }

      // BETAL-ROUTINGEN. inFlight släpps ALDRIG efter ett lyckat köp: knappen förblir
      // låst under redirecten (annars hinner ett andra klick in medan sidan byter).
      if (res.requiresPayment) {
        const checkout = paymentMethod === 'paypal'
          ? await startPaypalCheckout(res.orderId, token)
          : await startShopCheckout(res.orderId, token, paymentMethod)
        if (!checkout.ok) {
          inFlight.current = false
          setSubmitting(false)
          return checkout.message
        }
        clear()
        window.location.href = checkout.url
        return null
      }

      clear()
      router.push(`/bekraftelse/${res.orderId}`)
      return null
    } catch {
      inFlight.current = false
      setSubmitting(false)
      return 'Något gick fel. Försök igen.'
    }
  }

  return {
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
  }
}
