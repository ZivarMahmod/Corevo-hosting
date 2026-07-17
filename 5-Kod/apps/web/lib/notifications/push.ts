import 'server-only'
import { createServiceClient } from '@/lib/platform/service'
import { logger } from '@/lib/observability'

// Web Push-transporten (plan 015). Sändningen bor i edge-funktionen `send-push`
// (VAPID-signering kräver crypto-primitiver som är enklast i Deno-runtimen —
// speglar send-email-mönstret). Denna modul är appens enda ingång: den anropar
// funktionen via service-klienten och degraderar TYST när funktionen/VAPID
// saknas — push är alltid best-effort, routern faller till e-post/SMS.

export type PushResult = { ok: boolean; skipped?: boolean; error?: string }

export async function sendPushToCustomer(args: {
  customerId: string
  title: string
  body: string
  /** Djuplänk som notificationclick öppnar, t.ex. /konto. */
  url?: string
}): Promise<PushResult> {
  const admin = createServiceClient()
  const relaySecret = process.env.EMAIL_RELAY_SECRET
  if (!admin || !relaySecret) {
    logger.info('push.skipped_transport_unconfigured')
    return { ok: false, skipped: true, error: 'transport_unavailable' }
  }
  try {
    const { data, error } = await admin.functions.invoke('send-push', {
      headers: { 'x-relay-secret': relaySecret },
      body: {
        customer_id: args.customerId,
        title: args.title,
        body: args.body,
        url: args.url ?? '/konto',
      },
    })
    if (error) {
      logger.info('push.send_failed', { error: error.message })
      return { ok: false, error: 'invoke_failed' }
    }
    const sent = (data as { sent?: number } | null)?.sent ?? 0
    if (sent < 1) return { ok: false, error: 'no_active_subscription' }
    logger.info('push.sent', { sent })
    return { ok: true }
  } catch (err) {
    logger.info('push.send_threw', { error: err instanceof Error ? err.message : String(err) })
    return { ok: false, error: 'exception' }
  }
}
