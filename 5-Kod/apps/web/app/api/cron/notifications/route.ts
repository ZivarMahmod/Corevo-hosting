import { dispatchNotificationOutbox } from '@/lib/notifications/outbox'
import { authorizedCronRequest } from '@/lib/security/cron-auth'

export const dynamic = 'force-dynamic'

async function run(req: Request): Promise<Response> {
  if (!(await authorizedCronRequest(req))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const result = await dispatchNotificationOutbox()
    return Response.json({ ok: true, ...result })
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
