import { runMediaCleanup } from '@/lib/media/cleanup'
import { createServiceClient } from '@/lib/platform/service'
import { authorizedCronRequest } from '@/lib/security/cron-auth'

export const dynamic = 'force-dynamic'

async function run(req: Request): Promise<Response> {
  if (!(await authorizedCronRequest(req))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createServiceClient()
  if (!admin) {
    return Response.json({ error: 'service_unavailable' }, { status: 503 })
  }

  try {
    const result = await runMediaCleanup(admin, 20)
    if (result.failed > 0 || result.retried > 0) {
      return Response.json({ error: 'media_cleanup_degraded', ...result }, { status: 503 })
    }
    return Response.json({ ok: true, ...result })
  } catch {
    return Response.json({ error: 'cron_failed' }, { status: 500 })
  }
}

export const GET = run
export const POST = run
