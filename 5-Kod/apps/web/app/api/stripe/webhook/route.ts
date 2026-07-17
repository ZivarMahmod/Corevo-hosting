import Stripe from 'stripe'
import { getStripe, getWebhookSecret } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/platform/service'
import { sendPaymentReceipt, parseGuestEmail } from '@/lib/notifications/booking'
import { refundBookingPayment, refundShopOrder } from '@/lib/stripe/refund'
import { deliverIssuedGiftCards } from '@/lib/notifications/gift'
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

function requireDbResult<T extends { error: unknown }>(result: T): T {
  if (result.error) throw result.error
  return result
}

async function requireRefundPersisted(
  admin: AdminClient,
  tenantId: string,
  ownerColumn: 'booking_id' | 'order_id',
  ownerId: string,
): Promise<void> {
  const { data } = requireDbResult(
    await admin.from('payments').select('status').eq(ownerColumn, ownerId).eq('tenant_id', tenantId).maybeSingle(),
  )
  if (data?.status !== 'refunded') throw new Error('stripe webhook refund was not persisted')
}

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
  const { data } = requireDbResult(
    await admin.from('tenants').select('stripe_account_id').eq('id', tenantId).maybeSingle(),
  )
  return Boolean(data?.stripe_account_id) && data?.stripe_account_id === account
}

export async function POST(req: Request): Promise<Response> {
  const stripe = getStripe()
  const secret = getWebhookSecret()
  if (!stripe || !secret) {
    // Kvittera aldrig ett faktiskt inkommande event när det inte kan verifieras.
    // 503 bevarar Stripes retry i stället för att permanent tappa betalhändelsen.
    return new Response('Webhook configuration unavailable', { status: 503 })
  }
  const admin = createServiceClient()
  // Stripe är aktivt men databasen kan inte nås: kvittera aldrig bort eventet.
  // 503 gör att Stripe försöker igen när service-konfigurationen är hel.
  if (!admin) return new Response('Webhook service unavailable', { status: 503 })

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
        const orderId = pi.metadata?.order_id
        const tenantId = pi.metadata?.tenant_id
        // Webshop-order (Fas 3): account-fence → markera payment succeeded →
        // mark_shop_order_paid committar lagret + status pending/paid (idempotent).
        if (orderId && tenantId) {
          if (!(await accountOwnsTenant(admin, account, tenantId))) {
            await captureException(new Error('stripe webhook account mismatch'), {
              where: 'webhook.account_guard',
              type: event.type,
              account,
              tenantId,
            })
            break
          }
          // Ownership: order_id MÅSTE tillhöra fenced tenant. accountOwnsTenant bevisar
          // bara tenant↔account; mark_shop_order_paid är tenant-blind → utan denna check
          // kan ett spoofat konto B committa ett OFFER-tenants order. Verifiera FÖRE RPC.
          const { data: ord } = requireDbResult(
            await admin
              .from('shop_orders')
              .select('id')
              .eq('id', orderId)
              .eq('tenant_id', tenantId)
              .maybeSingle(),
          )
          if (!ord) {
            await captureException(new Error('stripe webhook order/tenant mismatch'), {
              where: 'webhook.account_guard',
              type: event.type,
              account,
              tenantId,
            })
            break
          }
          const { data: updatedPayment } = requireDbResult(
            await admin
              .from('payments')
              .update({ status: 'succeeded', stripe_payment_intent_id: pi.id })
              .eq('order_id', orderId)
              .eq('tenant_id', tenantId)
              .neq('status', 'refunded')
              .select('status')
              .maybeSingle(),
          )
          if (!updatedPayment) {
            const { data: existingPayment } = requireDbResult(
              await admin
                .from('payments')
                .select('status')
                .eq('order_id', orderId)
                .eq('tenant_id', tenantId)
                .maybeSingle(),
            )
            // Ett sent/omlevererat succeeded-event får aldrig återuppliva en
            // redan återbetald order. Saknas raden helt är det däremot ett
            // behandlingsfel som Stripe ska försöka igen.
            if (existingPayment?.status === 'refunded') break
            throw new Error('stripe webhook payment row missing after succeeded update')
          }
          requireDbResult(await admin.rpc('mark_shop_order_paid', { p_order_id: orderId }))
          // goal-64: betalningen gick igenom → mark_shop_order_paid har UTFÄRDAT ordens
          // presentkort (gift_cards med kod + saldo) och skapat dess kursanmälningar,
          // exakt en gång (stock_committed-latchen + UNIQUE(order_item_id) i 0059). Kvar:
          // leverera koden. deliverIssuedGiftCards är själv idempotent (villkorat UPDATE på
          // emailed_at) → en omlevererad webhook mejlar ALDRIG samma kod två gånger.
          await deliverIssuedGiftCards(admin, tenantId, orderId)
          // Auto-refund-nät (spegla booking cancelled→refund): om ordern inte kunde
          // committas (redan cancelled/expired pga abandon-release) men betalningen gick
          // igenom → återbetala. Annars money-taken-no-fulfilment vid decline→retry.
          const { data: o2 } = requireDbResult(
            await admin.from('shop_orders').select('status').eq('id', orderId).maybeSingle(),
          )
          if (o2?.status === 'cancelled' || o2?.status === 'expired') {
            await refundShopOrder(orderId, tenantId)
            await requireRefundPersisted(admin, tenantId, 'order_id', orderId)
          }
          break
        }
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
          // Betalning + pending→confirmed är EN DB-transaktion. En retry är
          // idempotent och en redan refunded payment återupplivas aldrig.
          const { data: confirmation } = requireDbResult(
            await admin.rpc('confirm_booking_payment', {
              p_booking: bookingId,
              p_tenant: tenantId,
              p_payment_intent: pi.id,
            }),
          )
          const confirmationState = confirmation as {
            booking_status?: string
            payment_status?: string
          } | null
          const bookingStatus = confirmationState?.booking_status ?? null
          const paymentStatus = confirmationState?.payment_status ?? null

          // Sen betalning på en redan AVBOKAD bokning: confirm-UPDATE ovan no-oppade
          // (WHERE status='pending'), så bokningen står kvar cancelled. Återbetala
          // då pengarna (refundBookingPayment är idempotent — no-op om redan refunded).
          if (bookingStatus === 'cancelled' && paymentStatus === 'succeeded') {
            await refundBookingPayment(bookingId, tenantId)
            await requireRefundPersisted(admin, tenantId, 'booking_id', bookingId)
          }

          // Kvitto (G10) — gästkontakt rider på note (G04-sömmen). Best-effort.
          // Hoppas över för avbokade/återbetalda bokningar (inget kvitto då).
          if (bookingStatus !== 'cancelled' && paymentStatus === 'succeeded') {
            try {
              const { data: b } = requireDbResult(
                await admin
                  .from('bookings')
                  .select('note, start_ts, services(name), tenants(name), locations(timezone)')
                  .eq('id', bookingId)
                  .eq('tenant_id', tenantId)
                  .maybeSingle(),
              )
              const to = parseGuestEmail((b as { note?: string | null } | null)?.note)
              if (b && to) {
                const rel = b as unknown as {
                  start_ts: string
                  services: { name?: string } | null
                  tenants: { name?: string } | null
                  locations: { timezone?: string } | null
                }
                // Plan 003: org-nr + momssats ur settings.legal → kvittoraderna
                // (momslagen). Best-effort — saknade fält ger kvitto utan raderna.
                let orgNr: string | null = null
                let vatRate: number | null = null
                try {
                  const { data: ts } = await admin
                    .from('tenant_settings')
                    .select('settings')
                    .eq('tenant_id', tenantId)
                    .maybeSingle()
                  const legal = (ts?.settings as { legal?: { org_nr?: unknown; vat_rate?: unknown } } | null)
                    ?.legal
                  orgNr = typeof legal?.org_nr === 'string' && legal.org_nr.trim() ? legal.org_nr.trim() : null
                  const vr = legal?.vat_rate
                  vatRate = typeof vr === 'number' && vr >= 0 && vr <= 100 ? vr : null
                } catch {
                  /* kvitto utan juridikrader är bättre än inget kvitto */
                }
                await sendPaymentReceipt(
                  to,
                  {
                    tenantName: rel.tenants?.name ?? 'Företaget',
                    serviceName: rel.services?.name ?? 'Behandling',
                    startISO: rel.start_ts,
                    timeZone: rel.locations?.timezone ?? 'Europe/Stockholm',
                    amountCents: pi.amount_received ?? pi.amount ?? 0,
                    currency: pi.currency ?? 'sek',
                    orgNr,
                    vatRate,
                  },
                  { supabase: admin, tenantId },
                )
              }
            } catch (e) {
              await captureException(e, { where: 'webhook.receipt', bookingId })
            }
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        const orderId = pi.metadata?.order_id
        const tenantId = pi.metadata?.tenant_id
        // Webshop-order: account-fence → payment failed → release_shop_order frigör
        // det held:a lagret (reserved_qty) + status cancelled (service_role → utan token).
        if (orderId && tenantId) {
          if (!(await accountOwnsTenant(admin, account, tenantId))) {
            await captureException(new Error('stripe webhook account mismatch'), {
              where: 'webhook.account_guard',
              type: event.type,
              account,
              tenantId,
            })
            break
          }
          // failed är INTE terminal i Checkout (kort-decline → kund kan retry på samma
          // session → en senare succeeded committar). Släpp därför INTE lagret här
          // (annars money-taken-no-fulfilment vid retry); lämna 'awaiting_payment'.
          // Terminal release sker på checkout.session.expired. Guard: en sen/omlevererad
          // failed får ALDRIG klobbra en redan succeeded/refunded payment-rad.
          requireDbResult(
            await admin
              .from('payments')
              .update({ status: 'failed', stripe_payment_intent_id: pi.id })
              .eq('order_id', orderId)
              .eq('tenant_id', tenantId)
              .not('status', 'in', '("succeeded","refunded")'),
          )
          break
        }
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
          requireDbResult(
            await admin
              .from('payments')
              .update({ status: 'failed', stripe_payment_intent_id: pi.id })
              .eq('booking_id', bookingId)
              .eq('tenant_id', tenantId)
              .not('status', 'in', '("succeeded","refunded")'), // ej klobbra terminal status
          )
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
          const { data: pay } = requireDbResult(
            await admin
              .from('payments')
              .select('tenant_id, order_id, tenants(stripe_account_id)')
              .eq('stripe_payment_intent_id', piId)
              .maybeSingle(),
          )
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
          requireDbResult(
            await admin.from('payments').update({ status: 'refunded' }).eq('stripe_payment_intent_id', piId),
          )
          // Webshop-order: spegla payment_status → refunded OCH ta ordern ur fulfilment-
          // kön (status cancelled) så återbetalda ordrar inte skickas. Full refund (v1
          // har ingen delrefund).
          const orderId = (pay as { order_id?: string | null }).order_id
          if (orderId) {
            requireDbResult(
              await admin
                .from('shop_orders')
                .update({ payment_status: 'refunded', status: 'cancelled' })
                .eq('id', orderId),
            )
          }
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
          requireDbResult(
            await admin
              .from('tenants')
              .update({
                stripe_charges_enabled: acct.charges_enabled ?? false,
                stripe_payouts_enabled: acct.payouts_enabled ?? false,
                stripe_details_submitted: acct.details_submitted ?? false,
              })
              .eq('stripe_account_id', acctId),
          )
        }
        break
      }

      case 'checkout.session.expired': {
        // Terminal abandon (kunden nådde Checkout men betalade aldrig). Stripe garanterar
        // ingen vidare betalning på en utgången session → säkert att släppa det held:a
        // lagret. account-fence + ownership-check (order MÅSTE tillhöra fenced tenant).
        const session = event.data.object as Stripe.Checkout.Session
        const orderId = session.metadata?.order_id
        const tenantId = session.metadata?.tenant_id
        if (orderId && tenantId) {
          if (!(await accountOwnsTenant(admin, account, tenantId))) {
            await captureException(new Error('stripe webhook account mismatch'), {
              where: 'webhook.account_guard',
              type: event.type,
              account,
              tenantId,
            })
            break
          }
          const { data: ord } = requireDbResult(
            await admin
              .from('shop_orders')
              .select('id')
              .eq('id', orderId)
              .eq('tenant_id', tenantId)
              .maybeSingle(),
          )
          if (!ord) {
            await captureException(new Error('stripe webhook order/tenant mismatch'), {
              where: 'webhook.account_guard',
              type: event.type,
              account,
              tenantId,
            })
            break
          }
          requireDbResult(await admin.rpc('release_shop_order', { p_order_id: orderId, p_status: 'expired' }))
          requireDbResult(
            await admin
              .from('payments')
              .update({ status: 'failed' })
              .eq('order_id', orderId)
              .eq('tenant_id', tenantId)
              .not('status', 'in', '("succeeded","refunded")'),
          )
        }
        break
      }

      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        // Tvister bär ingen tenant-metadata → lös tenant via PI-id → payment-rad,
        // account-fence FÖRE write (samma mönster som charge.refunded). created =
        // upsert dispute-rad; closed = uppdatera status. Idempotens-nyckel =
        // stripe_dispute_id (unik). Gatad implicit av payments_enabled (inga
        // payment-rader → ingen dispute-rad att koppla).
        const dispute = event.data.object as Stripe.Dispute
        const piId = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : dispute.payment_intent?.id
        if (piId) {
          const { data: pay } = requireDbResult(
            await admin
              .from('payments')
              .select('id, tenant_id, tenants(stripe_account_id)')
              .eq('stripe_payment_intent_id', piId)
              .maybeSingle(),
          )
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
          const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id
          requireDbResult(
            await admin.from('payment_disputes').upsert(
              {
                tenant_id: pay.tenant_id,
                payment_id: pay.id,
                stripe_dispute_id: dispute.id,
                stripe_charge_id: chargeId ?? null,
                amount_cents: dispute.amount ?? null,
                currency: dispute.currency ?? 'sek',
                reason: dispute.reason ?? null,
                dispute_status: dispute.status ?? null,
              },
              { onConflict: 'stripe_dispute_id' },
            ),
          )
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
