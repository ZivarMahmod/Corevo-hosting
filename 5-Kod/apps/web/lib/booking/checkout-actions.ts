'use server'

import { createServiceClient } from '@/lib/platform/service'
import { getStripe } from '@/lib/stripe/client'
import { requestOrigin } from '@/lib/url'
import { commerceReleaseGate } from '@/lib/release/commerce'
import { verifyCancelToken } from '@/lib/booking/cancel-token'
import { getPublicBookingContext } from './public-context'

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'unavailable' | 'error'; message: string }

export async function startBookingCheckout(
  bookingId: string,
  confirmationToken: string,
): Promise<CheckoutResult> {
  if (!(await verifyCancelToken(bookingId, confirmationToken))) {
    return { ok: false, reason: 'error', message: 'Bokningen kunde inte verifieras.' }
  }
  const ctx = await getPublicBookingContext()
  if (!ctx) {
    return {
      ok: false,
      reason: 'error',
      message: 'Något gick fel — ladda om sidan och försök igen.',
    }
  }
  if (!bookingId) return { ok: false, reason: 'error', message: 'Saknar bokning.' }
  if (!commerceReleaseGate(ctx.tenantId).bookingPayment) {
    return { ok: false, reason: 'unavailable', message: 'Onlinebetalning är inte aktiverad.' }
  }

  const stripe = getStripe()
  const admin = createServiceClient()
  if (!stripe || !admin) {
    return { ok: false, reason: 'unavailable', message: 'Onlinebetalning är inte tillgänglig.' }
  }

  const [{ data: tenant }, { data: settings }] = await Promise.all([
    admin
      .from('tenants')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('id', ctx.tenantId)
      .maybeSingle(),
    admin
      .from('tenant_settings')
      .select('payments_enabled')
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle(),
  ])
  const canTakeOnline =
    (settings?.payments_enabled ?? false) && (tenant?.stripe_charges_enabled ?? false)
  if (!canTakeOnline || !tenant?.stripe_account_id) {
    return { ok: false, reason: 'unavailable', message: 'Onlinebetalning är inte tillgänglig.' }
  }

  const { data: booking } = await admin
    .from('bookings')
    .select('id, price_cents, status, services(name)')
    .eq('id', bookingId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (!booking) return { ok: false, reason: 'error', message: 'Bokningen hittades inte.' }
  const amount = booking.price_cents ?? 0
  if (amount <= 0) return { ok: false, reason: 'unavailable', message: 'Inget pris att betala.' }
  const serviceName = (booking.services as { name?: string } | null)?.name ?? 'Behandling'

  const origin = await requestOrigin()
  let session
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: ctx.currency.toLowerCase(),
              unit_amount: amount,
              product_data: { name: serviceName },
            },
          },
        ],
        payment_intent_data: { metadata: { booking_id: bookingId, tenant_id: ctx.tenantId } },
        metadata: { booking_id: bookingId, tenant_id: ctx.tenantId },
        success_url: `${origin}/boka/bekraftelse/${bookingId}?t=${encodeURIComponent(confirmationToken)}&betald=1`,
        cancel_url: `${origin}/boka/bekraftelse/${bookingId}?t=${encodeURIComponent(confirmationToken)}&avbruten=1`,
      },
      {
        stripeAccount: tenant.stripe_account_id,
        idempotencyKey: `booking_checkout_${bookingId}`,
      },
    )
  } catch {
    return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }
  }

  if (!session.url) {
    return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }
  }

  const { data: paymentPrepared, error: payErr } = await admin.rpc(
    'prepare_booking_checkout_payment',
    {
      p_booking: bookingId,
      p_tenant: ctx.tenantId,
      p_amount_cents: amount,
      p_currency: ctx.currency.toLowerCase(),
      p_checkout_session: session.id,
      p_connected_account: tenant.stripe_account_id,
    },
  )
  if (payErr || paymentPrepared !== true) {
    return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }
  }

  return { ok: true, url: session.url }
}
