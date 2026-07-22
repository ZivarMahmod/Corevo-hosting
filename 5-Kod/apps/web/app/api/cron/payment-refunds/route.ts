import { dispatchPaymentRefundJobs, readPaymentRefundHealth } from '@/lib/payments/refund-outbox'
import { authorizedCronRequest } from '@/lib/security/cron-auth'

export const dynamic = 'force-dynamic'

async function run(req: Request): Promise<Response> {
  if (!(await authorizedCronRequest(req))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await dispatchPaymentRefundJobs(5)
    const health = await readPaymentRefundHealth()
    if (result.failed > 0 || result.stale > 0 || result.reviewRequired > 0 || result.retried > 0
      || health.reviewRequired > 0 || health.stuckProviderStarted > 0 || health.overduePending > 0) {
      return Response.json({ error: 'refund_review_required', ...result, health }, { status: 503 })
    }
    return Response.json({ ok: true, ...result, health })
  } catch {
    return Response.json({ error: 'cron_failed' }, { status: 500 })
  }
}

export const GET = run
export const POST = run
