import { dispatchGenericJobs } from '@/lib/jobs/generic-jobs'
import { authorizedCronRequest } from '@/lib/security/cron-auth'

export const dynamic = 'force-dynamic'

async function run(req: Request): Promise<Response> {
  if (!(await authorizedCronRequest(req))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    // Stripe Billing installs the only V1 handler in the next engine phase. Until
    // then no producer exists, and any manually queued valid job remains retryable.
    const result = await dispatchGenericJobs({})
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
