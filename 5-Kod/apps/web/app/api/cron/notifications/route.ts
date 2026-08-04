import { dispatchNotificationOutbox, type ClaimedNotificationOutboxRow } from '@/lib/notifications/outbox'
import { dispatchPortalRecoveryOutbox } from '@/lib/customer-portal/recovery-delivery'
import { deliverImmediateOffertOutbox } from '@/lib/admin/offert/reply-delivery'
import { deliverImmediateBookingOutbox } from '@/lib/notifications/booking-immediate'
import { deliverClaimedSmsOutbox } from '@/lib/notifications/sms'
import { parseSmsDeliveryMode } from '@/lib/notifications/settings'
import { authorizedCronRequest } from '@/lib/security/cron-auth'

export const dynamic = 'force-dynamic'

const RECOVERY_BATCH_LIMIT = 5

function deliverScheduledEmailOutbox(row: ClaimedNotificationOutboxRow) {
  return row.event_type === 'offert_reply'
    ? deliverImmediateOffertOutbox(row)
    : deliverImmediateBookingOutbox(row)
}

async function run(req: Request): Promise<Response> {
  if (!(await authorizedCronRequest(req))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const smsMode = parseSmsDeliveryMode(process.env.SMS_DELIVERY_MODE)
    const email = await dispatchNotificationOutbox({
      deliver: deliverScheduledEmailOutbox,
    })
    const sms = smsMode === 'off'
      ? null
      : await dispatchNotificationOutbox({ channel: 'sms', deliver: deliverClaimedSmsOutbox })
    const result = sms
      ? {
          claimed: email.claimed + sms.claimed,
          sent: email.sent + sms.sent,
          simulated: email.simulated + sms.simulated,
          skipped: email.skipped + sms.skipped,
          retried: email.retried + sms.retried,
          failed: email.failed + sms.failed,
          stale: email.stale + sms.stale,
        }
      : email

    const recovery = await dispatchPortalRecoveryOutbox(RECOVERY_BATCH_LIMIT)

    return Response.json({
      ok: true,
      ...result,
      recovery,
    })
  } catch {
    return Response.json({ error: 'cron_failed' }, { status: 500 })
  }
}

export async function GET(req: Request): Promise<Response> {
  return run(req)
}

export async function POST(req: Request): Promise<Response> {
  return run(req)
}
