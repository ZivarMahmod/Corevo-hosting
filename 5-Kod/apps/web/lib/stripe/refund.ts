import 'server-only'
import { getStripe } from './client'
import { createServiceClient } from '@/lib/platform/service'

/**
 * Refund för en webshop-order (Fas 3). DIRECT charge
 * ⇒ refund PÅ salongens connected account. Körs bara på status='succeeded';
 * idempotensKey order-scopad (Stripe 24h-dedupe). Sätter payments + shop_orders
 * payment_status='refunded'. Returvärdet är true först när provideranropet och
 * den atomiska lokala speglingen båda är bekräftade.
 */
export async function refundShopOrder(orderId: string, tenantId: string): Promise<boolean> {
  if (!orderId || !tenantId) return false
  const stripe = getStripe()
  const admin = createServiceClient()
  if (!stripe || !admin) return false

  const { data: payment } = await admin
    .from('payments')
    .select('stripe_payment_intent_id, status')
    .eq('order_id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!payment || payment.status !== 'succeeded' || !payment.stripe_payment_intent_id) return false

  const { data: tenant } = await admin
    .from('tenants')
    .select('stripe_account_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant?.stripe_account_id) return false

  try {
    await stripe.refunds.create(
      { payment_intent: payment.stripe_payment_intent_id },
      { stripeAccount: tenant.stripe_account_id, idempotencyKey: `refund_order_${orderId}` },
    )
    const mirrored = await admin.rpc('record_shop_order_refund', { p_order_id: orderId })
    return !mirrored.error && mirrored.data === true
  } catch {
    return false
  }
}
