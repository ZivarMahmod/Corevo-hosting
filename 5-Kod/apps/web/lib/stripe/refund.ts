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
    await stripe.refunds.create(
      { payment_intent: payment.stripe_payment_intent_id },
      { stripeAccount: tenant.stripe_account_id },
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
