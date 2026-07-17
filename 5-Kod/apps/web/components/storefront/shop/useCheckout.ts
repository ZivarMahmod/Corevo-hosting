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
  type ShopPaymentMethod,
} from '@/lib/storefront/shop/types'
import {
  reserveOrder,
  confirmOrder,
  cancelOrder,
  startShopCheckout,
  startPaypalCheckout,
} from '@/app/butik/actions'

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
  shippingOptions: ShippingOption[]
  paymentMethods: ShopPaymentMethod[]
}): UseCheckout {
  const { shippingOptions, paymentMethods } = args
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

  const didReserve = useRef(false)
  // Dubbelbetalnings-vakt: synkron ref (state är asynkront — två snabba klick kan annars
  // skicka två confirmOrder). Dubbelbetalning är en riktig bugg.
  const inFlight = useRef(false)

  const currency = lines[0]?.currency ?? 'SEK'

  // Reservera ordern EN gång vid mount (håller lagret medan kunden fyller i).
  useEffect(() => {
    if (didReserve.current || !token || lines.length === 0) return
    didReserve.current = true
    setReserving(true)
    // goal-64: korgen kan bära produkter, presentkort OCH kursplatser.
    // cartLineToReserveItem översätter raden till sitt VAL (variant / belopp / tillfälle) —
    // aldrig till ett pris. Servern (0059) slår upp priset och räknar totalen.
    reserveOrder({ items: lines.map(cartLineToReserveItem), token })
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
      if (orderId && token && !submitting) void cancelOrder(orderId, token)
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
    if (!orderId) return 'Beställningen är inte redo — ladda om sidan.'
    // Har butiken leveransval MÅSTE ett vara valt (servern kräver det också — 0058).
    if (shippingOptions.length > 0 && !shippingId) return 'Välj ett leveranssätt.'

    inFlight.current = true
    setSubmitting(true)

    const res = await confirmOrder({
      orderId,
      token,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      shipAddress: customer.shipAddress,
      note: customer.note,
      shippingOptionId: shippingId, // BARA id:t — priset är serverns
      paymentMethod,
      acceptTerms: customer.acceptTerms === true,
    })
    if (!res.ok) {
      inFlight.current = false
      setSubmitting(false)
      return res.message
    }

    // BETAL-ROUTINGEN. inFlight släpps ALDRIG efter ett lyckat köp: knappen förblir låst
    // under redirecten (annars hinner ett andra klick in medan sidan byter).
    //
    // PayPal går sin egen väg (plattformens konto), oavsett Stripe-gaten. Kort/Swish/
    // Klarna/Apple Pay går via kundens Stripe och kräver att betal-gaten är på
    // (requiresPayment). Misslyckas en betalstart faller vi igenom till bekräftelsen —
    // ordern står kvar obetald och sidan säger det ärligt, i stället för en vit skärm.
    if (paymentMethod === 'paypal') {
      const pp = await startPaypalCheckout(res.orderId)
      if (pp.ok) {
        clear()
        window.location.href = pp.url
        return null
      }
    } else if (res.requiresPayment) {
      const co = await startShopCheckout(res.orderId, paymentMethod)
      if (co.ok) {
        clear()
        window.location.href = co.url
        return null
      }
    }

    clear()
    router.push(`/bekraftelse/${res.orderId}`)
    return null
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
