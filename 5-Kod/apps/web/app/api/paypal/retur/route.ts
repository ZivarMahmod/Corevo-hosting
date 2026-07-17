import { NextResponse } from 'next/server'
import { capturePaypalOrder, paypalReady, refundPaypalCapture } from '@/lib/payments/paypal'
import { recordShopOrderRefunded, settleShopOrderPaid } from '@/lib/payments/settle'
import { captureException } from '@/lib/observability'

// PAYPAL — RETUREN (goal-64). Kunden har godkänt betalningen hos PayPal och skickas
// hit. Vi CAPTURE:ar (tar pengarna), markerar ordern betald och skickar kunden vidare
// till bekräftelsen i mallens egna skal.
//
// SANNINGEN LIGGER I CAPTURE-SVARET, INTE I QUERY-PARAMETRARNA. En besökare kan skriva
// vad som helst i ?order= — därför läser vi vilken order som betalades ur PayPals
// `custom_id` (som VI satte när ordern skapades) och ignorerar query-värdet för allt
// utom vart kunden ska landa.
//
// IDEMPOTENT: capturePaypalOrder tål en re-capture (PayPal svarar ORDER_ALREADY_CAPTURED
// → vi läser upp ordern i stället), och settleShopOrderPaid är no-op på en redan betald
// order. Returen och webhooken kan alltså krocka utan att något dubbelbokförs.

export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const paypalOrderId = url.searchParams.get('token') // PayPal lägger själv på ?token=<order-id>
  const backTo = url.searchParams.get('order') ?? ''

  // PayPal av (nycklar saknas) eller ingen token → skicka tillbaka kunden utan att låtsas.
  if (!paypalReady() || !paypalOrderId) {
    return NextResponse.redirect(new URL(`/bekraftelse/${backTo}?avbruten=1`, url.origin))
  }

  try {
    const cap = await capturePaypalOrder(paypalOrderId)
    // CAPTURE-NIVÅNS status kollas också (CodeRabbit-fynd): en COMPLETED order kan
    // bära en PENDING capture (eCheck-liknande) — då är pengarna INTE tagna än och
    // webhooken (capture-nivå-event) blir sanningen när den landar.
    if (
      !cap ||
      cap.status !== 'COMPLETED' ||
      (cap.captureStatus != null && cap.captureStatus !== 'COMPLETED') ||
      !cap.reference
    ) {
      // Inte fångad = inte betald. Kunden landar på bekräftelsen med obetald order
      // (som visar sitt "väntar på betalning"-läge) — vi ljuger aldrig om ett kvitto.
      return NextResponse.redirect(new URL(`/bekraftelse/${backTo}?avbruten=1`, url.origin))
    }

    // cap.reference = vår shop_orders.id (custom_id), satt av oss vid order-skapandet.
    const settled = await settleShopOrderPaid({
      orderId: cap.reference,
      amountCents: cap.amountCents,
      currency: cap.currency,
      providerRef: cap.captureId ?? paypalOrderId,
    })
    if (
      !settled.ok &&
      ['terminal_order', 'amount_mismatch', 'unknown_order'].includes(settled.reason ?? '')
    ) {
      const refunded = cap.captureId ? await refundPaypalCapture(cap.captureId) : false
      const persisted =
        refunded &&
        (settled.reason === 'unknown_order'
          ? true
          : await recordShopOrderRefunded(cap.reference))
      if (!refunded || !persisted) {
        throw new Error(`paypal auto-refund failed: ${settled.reason}`)
      }
    }
    const target = settled.ok
      ? `/bekraftelse/${cap.reference}?betald=1`
      : `/bekraftelse/${cap.reference}?avbruten=1`
    return NextResponse.redirect(new URL(target, url.origin))
  } catch (e) {
    await captureException(e, { where: 'paypal.retur', paypalOrderId })
    return NextResponse.redirect(new URL(`/bekraftelse/${backTo}?avbruten=1`, url.origin))
  }
}
