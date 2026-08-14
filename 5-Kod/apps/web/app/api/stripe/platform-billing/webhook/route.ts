import Stripe from 'stripe'
import {
  getPlatformBillingMode,
  getPlatformBillingStripe,
  getPlatformBillingWebhookSecret,
} from '@/lib/stripe/platform-billing'
import { createServiceClient } from '@/lib/platform/service'

export const dynamic = 'force-dynamic'

const BILLING_EVENTS = new Set([
  'invoice.created',
  'invoice.updated',
  'invoice.finalized',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.voided',
  'invoice.marked_uncollectible',
  'invoice.deleted',
])

export async function POST(req: Request): Promise<Response> {
  const stripe = getPlatformBillingStripe()
  const secret = getPlatformBillingWebhookSecret()
  if (!stripe || !secret) return new Response('Webhook configuration unavailable', { status: 503 })
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  if (event.account || !BILLING_EVENTS.has(event.type)) {
    return Response.json({ received: true, ignored: true })
  }
  const expectedLivemode = getPlatformBillingMode() === 'draft'
  const objectId = (event.data.object as { id?: unknown }).id
  if (
    typeof objectId !== 'string'
    || !objectId.startsWith('in_')
    || typeof event.livemode !== 'boolean'
    || event.livemode !== expectedLivemode
  ) {
    return new Response('Invalid invoice event', { status: 400 })
  }
  const service = createServiceClient()
  if (!service) return new Response('Webhook service unavailable', { status: 503 })
  const { data, error } = await service.rpc('record_platform_billing_event_and_enqueue', {
    p_event_id: event.id,
    p_event_type: event.type,
    p_object_id: objectId,
    p_livemode: event.livemode,
  })
  if (error) return new Response('Webhook persistence unavailable', { status: 503 })
  return Response.json({ received: true, queued: data === true })
}
