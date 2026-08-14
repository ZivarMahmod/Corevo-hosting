import { dispatchGenericJobs } from '@/lib/jobs/generic-jobs'
import { authorizedCronRequest } from '@/lib/security/cron-auth'
import { reconcilePlatformBillingJob } from '@/lib/stripe/platform-billing'

export const dynamic = 'force-dynamic'

async function run(req: Request): Promise<Response> {
  if (!(await authorizedCronRequest(req))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await dispatchGenericJobs({
      'stripe.billing.reconcile': reconcilePlatformBillingJob,
    })
    if (result.retried > 0 || result.reviewRequired > 0) {
      return Response.json({ error: 'job_review_required', ...result }, { status: 503 })
    }
    return Response.json({ ok: true, ...result })
  } catch {
    return Response.json({ error: 'cron_failed' }, { status: 500 })
  }
}

export const GET = run
export const POST = run
