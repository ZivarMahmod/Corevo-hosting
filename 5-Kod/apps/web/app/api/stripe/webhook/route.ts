import Stripe from 'stripe'
import { getStripe, getWebhookSecret } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/platform/service'

// Stripe Connect webhook (G09 step 4).
//
// ⚠️ Cloudflare Workers runtime: signaturen verifieras mot RÅ request-body. Vi
// läser `await req.text()` FÖRE all JSON-parse — annars bryts signaturen. Node-
// kryptot finns inte på Workers, så vi använder constructEventAsync +
// SubtleCryptoProvider (WebCrypto). Stripe-klienten kör fetch-http-client.
//
// Idempotens (DoD): varje handler är ett state-SET (UPDATE till målstatus), så
// dubbel-leverans ger EN effekt — ingen events-tabell behövs. Connect-events bär
// `event.account` (connected account-id) → mappas till rätt tenant.
//
// TODO (G10, bygg ej här): rate-limit på denna endpoint; Stripe-domäner i CSP;
// secrets-revision på Stripe-nyckeln.

export const dynamic = 'force-dynamic'

function ok(body: Record<string, unknown> = { received: true }) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

export async function POST(req: Request): Promise<Response> {
  const stripe = getStripe()
  const secret = getWebhookSecret()
  const admin = createServiceClient()
  if (!stripe || !secret || !admin) {
    // Ingen secret/Stripe konfigurerad → acceptera tyst (degrade, ingen 5xx-loop).
    return ok({ skipped: 'stripe_not_configured' })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing signature', { status: 400 })

  // RÅ body FÖRST (Workers-kravet).
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  // Connected account-id (Connect-events). null för plattforms-events.
  const account = event.account ?? null

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        const tenantId = pi.metadata?.tenant_id
        if (bookingId && tenantId) {
          // State-set: markera payment betald + spara PI-id (idempotent).
          await admin
            .from('payments')
            .update({ status: 'succeeded', stripe_payment_intent_id: pi.id })
            .eq('booking_id', bookingId)
            .eq('tenant_id', tenantId)
          // Bekräfta bokningen (bara från pending → confirmed; rör ej completed).
          await admin
            .from('bookings')
            .update({ status: 'confirmed' })
            .eq('id', bookingId)
            .eq('tenant_id', tenantId)
            .eq('status', 'pending')
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        const tenantId = pi.metadata?.tenant_id
        if (bookingId && tenantId) {
          await admin
            .from('payments')
            .update({ status: 'failed', stripe_payment_intent_id: pi.id })
            .eq('booking_id', bookingId)
            .eq('tenant_id', tenantId)
          // Bokningen lämnas pending → kund kan betala på plats / försöka igen.
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (piId) {
          // State-set: markera refunded. Matchar på PI-id (satt vid succeeded).
          await admin.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent_id', piId)
        }
        break
      }

      case 'account.updated': {
        const acct = event.data.object as Stripe.Account
        const acctId = acct.id ?? account
        if (acctId) {
          await admin
            .from('tenants')
            .update({
              stripe_charges_enabled: acct.charges_enabled ?? false,
              stripe_payouts_enabled: acct.payouts_enabled ?? false,
              stripe_details_submitted: acct.details_submitted ?? false,
            })
            .eq('stripe_account_id', acctId)
        }
        break
      }

      default:
        // Övriga event-typer ignoreras tyst (200 → Stripe slutar leverera om).
        break
    }
  } catch {
    // Intern fel → 500 så Stripe gör retry (idempotensen gör retry säker).
    return new Response('Webhook handler error', { status: 500 })
  }

  return ok()
}
