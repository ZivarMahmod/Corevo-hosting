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
import { deliverIssuedGiftCards } from '@/lib/notifications/gift'

export type SettleResult = {
  ok: boolean
  reason?: string
  /** Betalningen är durabel men presentkortsleveransen behöver en webhook-retry. */
  giftDeliveryPending?: boolean
}

async function deliverGiftCardsAfterSettlement(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  tenantId: string,
  orderId: string,
): Promise<boolean> {
  try {
    // failed > 0 = retry-bara leveransmissar (claim släppt) → giftDeliveryPending →
    // PayPal-webhooken 500:ar och providern levererar om eventet (CodeRabbit-fynd:
    // tidigare returnerade deliver void och flaggan kunde aldrig bli sann).
    const result = await deliverIssuedGiftCards(admin, tenantId, orderId)
    return result.failed === 0
  } catch (error) {
    // Betalning/lager är redan durabelt. Ett transportfel får aldrig göra kundens
    // lyckade betalning "avbruten"; webhooken använder flaggan för att begära retry.
    await captureException(error, {
      where: 'payments.settle.gift_delivery',
      orderId,
    })
    return false
  }
}

/**
 * Markera en shop-order som betald. Tenant-fenced (ordern MÅSTE tillhöra tenanten),
 * beloppsverifierad, idempotent.
 *
 * @param providerRef Betalningens id hos leverantören, endast för spårbar
 *                    felrapportering tills payments har en provider-neutral kolumn.
 */
export async function settleShopOrderPaid(args: {
  orderId: string
  amountCents: number | null
  /** Capture-valutan (t.ex. 'SEK'). null = okänd → behandlas som mismatch. */
  currency?: string | null
  providerRef: string
}): Promise<SettleResult> {
  const admin = createServiceClient()
  if (!admin) return { ok: false, reason: 'no_service_client' }

  const { data: order, error: orderError } = await admin
    .from('shop_orders')
    .select('id, tenant_id, total_cents, currency, payment_status, status')
    .eq('id', args.orderId)
    .maybeSingle()
  if (orderError) {
    await captureException(orderError, {
      where: 'payments.settle.order_lookup',
      orderId: args.orderId,
    })
    return { ok: false, reason: 'order_lookup_failed' }
  }
  if (!order) return { ok: false, reason: 'unknown_order' }

  // En capture som hinner fram efter att holdet släppts får aldrig återuppliva
  // ordern eller utfärda värde. PayPal-routen återbetalar capture:n direkt.
  if (order.status === 'cancelled' || order.status === 'expired') {
    await captureException(new Error('payment captured for terminal order'), {
      where: 'payments.settle.terminal_order',
      orderId: args.orderId,
      providerRef: args.providerRef,
      status: order.status,
    })
    return { ok: false, reason: 'terminal_order' }
  }

  // Redan betald → betal-/lagerdelen är no-op, men leveransen kan saknas efter en
  // äldre callback eller ett tidigare mejlfel. Leveransfunktionen claimar villkorat
  // och är därför säker att försöka igen på varje PayPal-retry.
  if (order.payment_status === 'paid') {
    const delivered = await deliverGiftCardsAfterSettlement(admin, order.tenant_id, args.orderId)
    return delivered ? { ok: true } : { ok: true, giftDeliveryPending: true }
  }

  // BELOPPSGRIND (skärpt, CodeRabbit-fynd): en capture som inte täcker orderns total
  // får aldrig markera den betald — och ett SAKNAT belopp i provider-svaret är en
  // mismatch, inte ett frikort (tidigare hoppade null-belopp över hela grinden).
  if (args.amountCents == null || args.amountCents < (order.total_cents ?? 0)) {
    await captureException(new Error('paypal capture amount mismatch'), {
      where: 'payments.settle',
      orderId: args.orderId,
      captured: args.amountCents,
      expected: order.total_cents,
    })
    return { ok: false, reason: 'amount_mismatch' }
  }

  // VALUTAGRIND (CodeRabbit-fynd): 189 USD passerade tidigare för en 189 SEK-order.
  // Capture-valutan MÅSTE matcha orderns; okänd valuta behandlas som mismatch.
  const orderCurrency = (order.currency ?? '').toUpperCase()
  const capturedCurrency = (args.currency ?? '').toUpperCase()
  if (!capturedCurrency || (orderCurrency && capturedCurrency !== orderCurrency)) {
    await captureException(new Error('paypal capture currency mismatch'), {
      where: 'payments.settle',
      orderId: args.orderId,
      captured: capturedCurrency || null,
      expected: orderCurrency || null,
    })
    return { ok: false, reason: 'amount_mismatch' }
  }

  // OBS: PayPal-referensen skrivs MEDVETET inte in i payments.stripe_payment_intent_id.
  // Den kolumnen är Stripes, och refund-vägen (charge.refunded + refundShopOrder) slår
  // upp betalningar på just den — en PayPal-id där hade fått Stripe-refunden att peka på
  // ett PI som inte finns. Referensen loggas i stället; en egen provider-kolumn är rätt
  // hem för den, och den byggs när PayPal-kontot faktiskt finns.
  const { data: updatedPayment, error: paymentError } = await admin
    .from('payments')
    .update({ status: 'succeeded' })
    .eq('order_id', args.orderId)
    .eq('tenant_id', order.tenant_id)
    .neq('status', 'refunded') // en sen re-leverans får ALDRIG återuppliva en refund
    .select('id')
    .maybeSingle()
  if (paymentError) {
    await captureException(paymentError, {
      where: 'payments.settle.payment_update',
      orderId: args.orderId,
    })
    return { ok: false, reason: 'payment_update_failed' }
  }
  if (!updatedPayment) {
    await captureException(new Error('payment row missing or terminal'), {
      where: 'payments.settle.payment_not_updated',
      orderId: args.orderId,
    })
    return { ok: false, reason: 'payment_not_updated' }
  }

  // Committar lagret (stock_committed-latch → exakt en gång) + status pending/paid.
  const { error: commitError } = await admin.rpc('mark_shop_order_paid', {
    p_order_id: args.orderId,
  })
  if (commitError) {
    await captureException(commitError, {
      where: 'payments.settle.order_commit',
      orderId: args.orderId,
    })
    return { ok: false, reason: 'order_commit_failed' }
  }

  // RPC:n utfärdar presentkortet; först därefter finns en kod att leverera.
  const delivered = await deliverGiftCardsAfterSettlement(admin, order.tenant_id, args.orderId)
  return delivered ? { ok: true } : { ok: true, giftDeliveryPending: true }
}

/** Spegla en redan genomförd extern refund atomiskt i payment + order. */
export async function recordShopOrderRefunded(orderId: string): Promise<boolean> {
  const admin = createServiceClient()
  if (!admin) return false
  const { data, error } = await admin.rpc('record_shop_order_refund', { p_order_id: orderId })
  if (error || data !== true) {
    await captureException(error ?? new Error('refund status was not persisted'), {
      where: 'payments.settle.refund_persist',
      orderId,
    })
    return false
  }
  return true
}
