import 'server-only'

// BETALD ORDER — EN väg in (goal-64).
//
// Både PayPal-returen (kunden kommer tillbaka från approve) och PayPal-webhooken
// (PAYMENT.CAPTURE.COMPLETED) kan landa för SAMMA betalning, i vilken ordning som
// helst, och webhooken kan dessutom levereras två gånger. Därför finns exakt EN
// funktion som markerar en order betald, och den är IDEMPOTENT hela vägen ner:
//
//   • payments-raden är UNIQUE(order_id) → uppdateras till 'succeeded' (aldrig från
//     'refunded' — en sen re-leverans får inte återuppliva en återbetald betalning).
//   • mark_shop_order_paid (0042) har en stock_committed-latch → lagret dras EXAKT
//     en gång, oavsett hur många gånger funktionen körs.
//
// Beloppet verifieras mot ordern INNAN något markeras: en capture på fel summa får
// aldrig göra ordern betald (det vore money-mismatch, inte en betalning).

import { createServiceClient } from '@/lib/platform/service'
import { captureException } from '@/lib/observability'

export type SettleResult = { ok: boolean; reason?: string }

/**
 * Markera en shop-order som betald. Tenant-fenced (ordern MÅSTE tillhöra tenanten),
 * beloppsverifierad, idempotent.
 *
 * @param providerRef Betalningens id hos leverantören (PayPal capture/order-id) — sparas
 *                    på payments-raden så en betalning alltid kan spåras tillbaka.
 */
export async function settleShopOrderPaid(args: {
  orderId: string
  amountCents: number | null
  providerRef: string
}): Promise<SettleResult> {
  const admin = createServiceClient()
  if (!admin) return { ok: false, reason: 'no_service_client' }

  const { data: order } = await admin
    .from('shop_orders')
    .select('id, tenant_id, total_cents, payment_status')
    .eq('id', args.orderId)
    .maybeSingle()
  if (!order) return { ok: false, reason: 'unknown_order' }

  // Redan betald → no-op. Detta ÄR idempotensen i praktiken (webhook + retur samtidigt).
  if (order.payment_status === 'paid') return { ok: true }

  // BELOPPSGRIND: en capture som inte täcker orderns total får aldrig markera den betald.
  if (args.amountCents != null && args.amountCents < (order.total_cents ?? 0)) {
    await captureException(new Error('paypal capture amount mismatch'), {
      where: 'payments.settle',
      orderId: args.orderId,
      captured: args.amountCents,
      expected: order.total_cents,
    })
    return { ok: false, reason: 'amount_mismatch' }
  }

  // OBS: PayPal-referensen skrivs MEDVETET inte in i payments.stripe_payment_intent_id.
  // Den kolumnen är Stripes, och refund-vägen (charge.refunded + refundShopOrder) slår
  // upp betalningar på just den — en PayPal-id där hade fått Stripe-refunden att peka på
  // ett PI som inte finns. Referensen loggas i stället; en egen provider-kolumn är rätt
  // hem för den, och den byggs när PayPal-kontot faktiskt finns.
  await admin
    .from('payments')
    .update({ status: 'succeeded' })
    .eq('order_id', args.orderId)
    .eq('tenant_id', order.tenant_id)
    .neq('status', 'refunded') // en sen re-leverans får ALDRIG återuppliva en refund

  // Committar lagret (stock_committed-latch → exakt en gång) + status pending/paid.
  await admin.rpc('mark_shop_order_paid', { p_order_id: args.orderId })
  return { ok: true }
}
