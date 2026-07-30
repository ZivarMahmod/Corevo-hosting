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
  eventId?: string
  tenantId?: string
  orderId?: string
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

export type ShopPaymentEventType =
  | 'payment_succeeded'
  | 'payment_failed'
  | 'checkout_expired'
  | 'refund_succeeded'

export type ShopPaymentEventInput = {
  provider: 'stripe' | 'paypal'
  accountScope: string
  providerEventId: string
  eventType: ShopPaymentEventType
  orderId: string | null
  tenantId?: string | null
  amountCents: number | null
  currency?: string | null
  providerRef: string
  source: 'webhook' | 'return'
}

/** Register after signature verification, then settle through one DB-owned boundary. */
export async function settleShopPaymentEvent(
  args: ShopPaymentEventInput,
): Promise<SettleResult> {
  const admin = createServiceClient()
  if (!admin) return { ok: false, reason: 'no_service_client' }

  const { data: registered, error: registerError } = await admin.rpc(
    'register_shop_payment_event',
    {
      p_provider: args.provider,
      p_account_scope: args.accountScope,
      p_provider_event_id: args.providerEventId,
      p_event_type: args.eventType,
      p_tenant: args.tenantId ?? null,
      p_order: args.orderId,
      p_provider_reference_id: args.providerRef,
      p_amount_cents: args.amountCents,
      p_currency: args.currency ?? null,
      p_payload: { source: args.source },
    },
  )
  const eventId = (registered as { event_id?: string } | null)?.event_id
  if (registerError || !eventId) {
    await captureException(registerError ?? new Error('payment event id missing'), {
      where: 'payments.settle.event_register',
      orderId: args.orderId,
      provider: args.provider,
      providerEventId: args.providerEventId,
    })
    return { ok: false, reason: 'event_register_failed' }
  }

  const { data: settled, error: settleError } = await admin.rpc(
    'settle_shop_payment_event',
    { p_event: eventId },
  )
  if (settleError) {
    // Registration already committed in the preceding RPC. Record the failed
    // processing attempt when the database is reachable; provider 5xx still
    // remains the authoritative retry trigger if this best-effort write fails.
    await admin.rpc('complete_shop_payment_event', {
      p_event: eventId,
      p_outcome: 'retryable',
      p_error_code: 'settlement_rpc_failed',
    })
    await captureException(settleError, {
      where: 'payments.settle.event_process',
      orderId: args.orderId,
      provider: args.provider,
      eventId,
    })
    return { ok: false, reason: 'event_settle_failed', eventId }
  }

  const row = settled as {
    outcome?: string
    tenant_id?: string
    order_id?: string
  } | null
  const outcome = row?.outcome ?? 'unknown'
  const tenantId = row?.tenant_id
  const orderId = row?.order_id ?? args.orderId ?? undefined
  const ok = [
    'succeeded',
    'already_succeeded',
    'failed',
    'expired',
    'refunded',
  ].includes(outcome)

  if (
    args.eventType === 'payment_succeeded'
    && ok
    && outcome !== 'refunded'
    && tenantId
    && orderId
  ) {
    const delivered = await deliverGiftCardsAfterSettlement(admin, tenantId, orderId)
    return {
      ok: true,
      eventId,
      tenantId,
      orderId,
      ...(delivered ? {} : { giftDeliveryPending: true }),
    }
  }

  return {
    ok,
    ...(ok ? {} : { reason: outcome }),
    eventId,
    ...(tenantId ? { tenantId } : {}),
    ...(orderId ? { orderId } : {}),
  }
}

export async function settleShopOrderPaid(
  args: Omit<ShopPaymentEventInput, 'eventType' | 'orderId'> & { orderId: string },
): Promise<SettleResult> {
  return settleShopPaymentEvent({ ...args, eventType: 'payment_succeeded' })
}

export async function completeShopPaymentEvent(
  eventId: string,
  outcome: 'refunded' | 'retryable' | 'ignored',
  errorCode?: string,
): Promise<boolean> {
  const admin = createServiceClient()
  if (!admin) return false
  const { error } = await admin.rpc('complete_shop_payment_event', {
    p_event: eventId,
    p_outcome: outcome,
    p_error_code: errorCode,
  })
  if (error) {
    await captureException(error, {
      where: 'payments.settle.event_complete',
      eventId,
      outcome,
    })
    return false
  }
  return true
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
