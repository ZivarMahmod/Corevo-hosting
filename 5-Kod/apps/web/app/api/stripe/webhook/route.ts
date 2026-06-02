import Stripe from 'stripe'
import { getStripe, getWebhookSecret } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/platform/service'
import { sendPaymentReceipt, parseGuestEmail } from '@/lib/notifications/booking'
import { captureException } from '@/lib/observability'

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

type AdminClient = NonNullable<ReturnType<typeof createServiceClient>>

/**
 * SÄKERHET: bevisar att `event.account` (connected account-id) verkligen är det
 * konto som metadatans tenant är kopplad till. Stoppar cross-account-spoof där
 * salong B signerar ett event vars metadata pekar på salong A. Returnerar false
 * om account saknas, tenant inte hittas, eller stripe_account_id ej matchar.
 */
async function accountOwnsTenant(
  admin: AdminClient,
  account: string | null,
  tenantId: string,
): Promise<boolean> {
  if (!account) return false
  const { data } = await admin
    .from('tenants')
    .select('stripe_account_id')
    .eq('id', tenantId)
    .maybeSingle()
  return Boolean(data?.stripe_account_id) && data?.stripe_account_id === account
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

  // SÄKERHET (cross-account spoof): signaturen bevisar bara att eventet kom från
  // ETT giltigt connected account — inte vilket. En salong B styr sin egen PI-
  // metadata och kan sätta tenant_id som pekar på salong A; signaturen passerar
  // ändå. Eftersom writes går via service-role-klienten (RLS-bypass) MÅSTE vi
  // därför verifiera att `event.account` matchar den tenant metadatan pekar på,
  // INNAN någon write körs. Mismatch = logga + no-op (200), så Stripe inte
  // retry-loopar B:s äkta event; loggen avslöjar även en inaktuell
  // stripe_account_id-felkonfig som annars tystas.
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        const tenantId = pi.metadata?.tenant_id
        if (bookingId && tenantId) {
          // Account-fence: tenant (från metadata) MÅSTE äga `event.account`.
          if (!(await accountOwnsTenant(admin, account, tenantId))) {
            await captureException(new Error('stripe webhook account mismatch'), {
              where: 'webhook.account_guard',
              type: event.type,
              account,
              tenantId,
            })
            break
          }
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

          // Kvitto (G10) — gästkontakt rider på note (G04-sömmen). Best-effort.
          try {
            const { data: b } = await admin
              .from('bookings')
              .select('note, start_ts, services(name), tenants(name), locations(timezone)')
              .eq('id', bookingId)
              .eq('tenant_id', tenantId)
              .maybeSingle()
            const to = parseGuestEmail((b as { note?: string | null } | null)?.note)
            if (b && to) {
              const rel = b as unknown as {
                start_ts: string
                services: { name?: string } | null
                tenants: { name?: string } | null
                locations: { timezone?: string } | null
              }
              await sendPaymentReceipt(
                to,
                {
                  tenantName: rel.tenants?.name ?? 'Salongen',
                  serviceName: rel.services?.name ?? 'Behandling',
                  startISO: rel.start_ts,
                  timeZone: rel.locations?.timezone ?? 'Europe/Stockholm',
                  amountCents: pi.amount_received ?? pi.amount ?? 0,
                  currency: pi.currency ?? 'sek',
                },
                { supabase: admin, tenantId },
              )
            }
          } catch (e) {
            await captureException(e, { where: 'webhook.receipt', bookingId })
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        const tenantId = pi.metadata?.tenant_id
        if (bookingId && tenantId) {
          // Account-fence: tenant (från metadata) MÅSTE äga `event.account`.
          if (!(await accountOwnsTenant(admin, account, tenantId))) {
            await captureException(new Error('stripe webhook account mismatch'), {
              where: 'webhook.account_guard',
              type: event.type,
              account,
              tenantId,
            })
            break
          }
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
          // Ingen tenant_id i metadatan här → lös tenant via payment-raden (PI-id)
          // och hämta dess stripe_account_id i samma fråga. Account-fence FÖRE
          // write; saknas matchande payment-rad → no-op (blind-uppdatera ALDRIG
          // bara på PI-id, då ett spoofat konto kan ange ett annat tenants PI-id).
          const { data: pay } = await admin
            .from('payments')
            .select('tenant_id, tenants(stripe_account_id)')
            .eq('stripe_payment_intent_id', piId)
            .maybeSingle()
          const acctId = (pay as { tenants?: { stripe_account_id?: string | null } | null } | null)?.tenants
            ?.stripe_account_id
          if (!pay || !account || !acctId || acctId !== account) {
            await captureException(new Error('stripe webhook account mismatch'), {
              where: 'webhook.account_guard',
              type: event.type,
              account,
              piId,
            })
            break
          }
          // State-set: markera refunded. Matchar på PI-id (satt vid succeeded).
          await admin.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent_id', piId)
        }
        break
      }

      case 'account.updated': {
        const acct = event.data.object as Stripe.Account
        const acctId = acct.id ?? account
        // Account-fence: objektets konto MÅSTE vara `event.account`. Writet är
        // redan WHERE stripe_account_id = acctId, så denna check stänger cross-
        // account-DoS (annars kan ett spoofat event nolla ett annat tenants flaggor).
        if (acctId && account && acctId !== account) {
          await captureException(new Error('stripe webhook account mismatch'), {
            where: 'webhook.account_guard',
            type: event.type,
            account,
            acctId,
          })
          break
        }
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
  } catch (e) {
    // Intern fel → 500 så Stripe gör retry (idempotensen gör retry säker).
    await captureException(e, { where: 'webhook.handler', type: event.type })
    return new Response('Webhook handler error', { status: 500 })
  }

  return ok()
}
