import { dispatchNotificationOutbox } from '@/lib/notifications/outbox'
import { dispatchPortalRecoveryOutbox } from '@/lib/customer-portal/recovery-delivery'
import { deliverClaimedSmsOutbox } from '@/lib/notifications/sms'
import { parseSmsDeliveryMode } from '@/lib/notifications/settings'
import { authorizedCronRequest } from '@/lib/security/cron-auth'
import { after } from 'next/server'

export const dynamic = 'force-dynamic'

const RECOVERY_BATCH_LIMIT = 5

async function run(req: Request): Promise<Response> {
  if (!(await authorizedCronRequest(req))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const smsMode = parseSmsDeliveryMode(process.env.SMS_DELIVERY_MODE)
    const result = await dispatchNotificationOutbox(smsMode === 'off'
      ? {}
      : { channel: 'sms', deliver: deliverClaimedSmsOutbox })

    let recoveryScheduled = true
    try {
      after(async () => {
        try {
          await dispatchPortalRecoveryOutbox(RECOVERY_BATCH_LIMIT)
        } catch {
          // The durable recovery outbox remains queued for the next cron run.
        }
      })
    } catch {
      recoveryScheduled = false
    }

    return Response.json({
      ok: true,
      ...result,
      recovery: { scheduled: recoveryScheduled, limit: RECOVERY_BATCH_LIMIT },
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
