import { verifyPaypalWebhook, paypalReady, refundPaypalCapture } from '@/lib/payments/paypal'
import { recordShopOrderRefunded, settleShopOrderPaid } from '@/lib/payments/settle'
import { captureException } from '@/lib/observability'

// PAYPAL — WEBHOOKEN (goal-64). Nätet under returen: stänger kunden webbläsaren mitt i
// redirecten blir ordern ändå betald här.
//
// SIGNATUREN VERIFIERAS ALLTID (verifyPaypalWebhook → PayPals verify-endpoint). Saknas
// PAYPAL_WEBHOOK_ID kan vi inte bevisa avsändaren → vi vägrar. Ett osignerat
// "betalt"-event får aldrig markera en order som betald; det vore en gratis-order-bugg.
//
// IDEMPOTENS (kravet): PayPal levererar om vid varje icke-200, och kan dubbel-leverera.
// settleShopOrderPaid är state-no-op på en redan betald order (men försöker
// idempotent backfilla presentkortsleveransen) och mark_shop_order_paid har en
// stock_committed-latch → dubbel leverans ger EXAKT en betal-/lagereffekt.
//
// Vi svarar 200 även på event vi inte bryr oss om (annars retry-loopar PayPal), men 500
// på internt fel — då VILL vi ha en retry.

export const dynamic = 'force-dynamic'

function ok(body: Record<string, unknown> = { received: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

export async function POST(req: Request): Promise<Response> {
  // Inte konfigurerat → acceptera tyst (degrade, ingen 5xx-loop). Samma mönster som
  // Stripe-webhooken när STRIPE_WEBHOOK_SECRET saknas.
  if (!paypalReady()) return ok({ skipped: 'paypal_not_configured' })

  // RÅ body FÖRST — signaturverifieringen sker mot exakt de bytes PayPal skickade.
  const rawBody = await req.text()

  const valid = await verifyPaypalWebhook(req.headers, rawBody)
  if (!valid) return new Response('Invalid signature', { status: 400 })

  try {
    const event = JSON.parse(rawBody) as {
      event_type?: string
      resource?: {
        id?: string
        custom_id?: string
        amount?: { value?: string; currency_code?: string }
        status?: string
      }
    }

    // Enda event som får flytta pengar i vår modell.
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const res = event.resource
      // custom_id = vår shop_orders.id, satt av oss i createPaypalOrder. Vi litar ALDRIG
      // på något annat fält för att avgöra vilken order som betalades.
      const orderId = res?.custom_id
      if (!orderId) return ok({ skipped: 'no_reference' })
      const amountCents = res?.amount?.value ? Math.round(Number(res.amount.value) * 100) : null
      const settled = await settleShopOrderPaid({
        orderId,
        amountCents,
        // Valutan valideras i settle (CodeRabbit-fynd: 189 USD ≠ 189 SEK).
        currency: res?.amount?.currency_code ?? null,
        providerRef: res?.id ?? 'paypal',
      })
      if (settled.ok && settled.giftDeliveryPending) {
        // Pengarna är redan korrekt speglade. Be PayPal leverera om eventet så den
        // idempotenta presentkortsclaimen får ett nytt leveransförsök.
        throw new Error('paypal gift-card delivery pending')
      }
      if (!settled.ok && ['terminal_order', 'amount_mismatch'].includes(settled.reason ?? '')) {
        if (!res?.id || !(await refundPaypalCapture(res.id))) {
          throw new Error(`paypal auto-refund failed: ${settled.reason}`)
        }
        if (!(await recordShopOrderRefunded(orderId))) {
          throw new Error(`paypal refund persistence failed: ${settled.reason}`)
        }
        return ok({ refunded: true })
      }
      if (!settled.ok && settled.reason === 'unknown_order') {
        if (!res?.id || !(await refundPaypalCapture(res.id))) {
          throw new Error('paypal unknown-order auto-refund failed')
        }
        return ok({ refunded: true })
      }
      if (!settled.ok) {
        // Ett verifierat pengar-event får inte kvitteras förrän vår egen status är
        // durabel. Kasta in i befintlig 500-väg så PayPal levererar om eventet.
        throw new Error(`paypal settlement failed: ${settled.reason ?? 'unknown'}`)
      }
    }
    // Övriga event-typer ignoreras tyst (200 → PayPal slutar leverera om).
    return ok()
  } catch (e) {
    await captureException(e, { where: 'paypal.webhook' })
    return new Response('Webhook handler error', { status: 500 }) // → PayPal gör retry (idempotent)
  }
}
