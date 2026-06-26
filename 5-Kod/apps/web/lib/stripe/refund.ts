import 'server-only'
import { getStripe } from './client'
import { createServiceClient } from '@/lib/platform/service'

// Refund vid avbokning (G09 step 5). Återbetalar en LYCKAD betalning för en bokning
// via Stripe. DIRECT charge ⇒ refunden görs PÅ salongens connected account
// ({ stripeAccount }). Caller har redan kontrollerat tenantens avbokningsregel.
//
// Idempotent nog för flödet: körs bara på status='succeeded'; charge.refunded-
// webhooken sätter (om)status='refunded' oavsett, och vi sätter den även här direkt.

export async function refundBookingPayment(bookingId: string, tenantId: string): Promise<void> {
  if (!bookingId || !tenantId) return
  const stripe = getStripe()
  const admin = createServiceClient()
  if (!stripe || !admin) return // ingen Stripe/secret → inget att återbetala (degrade)

  const { data: payment } = await admin
    .from('payments')
    .select('stripe_payment_intent_id, status')
    .eq('booking_id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!payment || payment.status !== 'succeeded' || !payment.stripe_payment_intent_id) return

  const { data: tenant } = await admin
    .from('tenants')
    .select('stripe_account_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant?.stripe_account_id) return

  try {
    // idempotencyKey (boknings-scopat, en betalning per bokning): om denna väg
    // körs två gånger för samma bokning dedupar Stripe inom sitt 24h-fönster →
    // ingen risk för dubbel återbetalning även om DB-guarden skulle missas.
    await stripe.refunds.create(
      { payment_intent: payment.stripe_payment_intent_id },
      { stripeAccount: tenant.stripe_account_id, idempotencyKey: `refund_${bookingId}` },
    )
    await admin
      .from('payments')
      .update({ status: 'refunded' })
      .eq('booking_id', bookingId)
      .eq('tenant_id', tenantId)
  } catch {
    // Tyst: charge.refunded-webhooken speglar lyckade refunds; en misslyckad
    // refund (redan återbetald etc.) ska inte blockera avbokningen.
  }
}

/**
 * Refund för en webshop-order (Fas 3). Speglar refundBookingPayment: DIRECT charge
 * ⇒ refund PÅ salongens connected account. Körs bara på status='succeeded';
 * idempotensKey order-scopad (Stripe 24h-dedupe). Sätter payments + shop_orders
 * payment_status='refunded'. Anropas från merchant-admin (refund-knapp).
 */
export async function refundShopOrder(orderId: string, tenantId: string): Promise<void> {
  if (!orderId || !tenantId) return
  const stripe = getStripe()
  const admin = createServiceClient()
  if (!stripe || !admin) return

  const { data: payment } = await admin
    .from('payments')
    .select('stripe_payment_intent_id, status')
    .eq('order_id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!payment || payment.status !== 'succeeded' || !payment.stripe_payment_intent_id) return

  const { data: tenant } = await admin
    .from('tenants')
    .select('stripe_account_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant?.stripe_account_id) return

  try {
    await stripe.refunds.create(
      { payment_intent: payment.stripe_payment_intent_id },
      { stripeAccount: tenant.stripe_account_id, idempotencyKey: `refund_order_${orderId}` },
    )
    await admin.from('payments').update({ status: 'refunded' }).eq('order_id', orderId).eq('tenant_id', tenantId)
    // Full refund → ta ordern ur fulfilment-kön (status cancelled) + payment_status refunded.
    await admin
      .from('shop_orders')
      .update({ payment_status: 'refunded', status: 'cancelled' })
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
  } catch {
    // Tyst: charge.refunded-webhooken speglar lyckade refunds.
  }
}
