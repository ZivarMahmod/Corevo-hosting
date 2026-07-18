import { createServiceClient } from '@/lib/platform/service'
import { authorizedCronRequest } from '@/lib/security/cron-auth'

export const dynamic = 'force-dynamic'

type SchedulerHealth = {
  healthy: boolean
  status: string
  age_seconds: number | null
}

type SchedulerHealthRpc = (
  functionName: 'get_scheduler_health',
  args: {
    p_scheduler_name: string
    p_now: string
    p_max_age_seconds: number
  },
) => Promise<{ data: unknown; error: { message: string } | null }>

function unavailable(): Response {
  return Response.json(
    { healthy: false, status: 'unavailable', age_seconds: null },
    { status: 503 },
  )
}

export async function GET(request: Request): Promise<Response> {
  if (!(await authorizedCronRequest(request))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createServiceClient()
  if (!admin) return unavailable()

  // Heartbeat-kontraktet infördes i 0102. Keep this one local
  // signature until generated DB types are refreshed from the verified schema.
  const schedulerHealthRpc = admin.rpc as unknown as SchedulerHealthRpc
  const { data, error } = await schedulerHealthRpc('get_scheduler_health', {
    p_scheduler_name: 'cloudflare-reminders-primary',
    p_now: new Date().toISOString(),
    p_max_age_seconds: 35 * 60,
  })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return unavailable()

  const raw = data as Record<string, unknown>
  const health: SchedulerHealth = {
    healthy: raw.healthy === true,
    status: typeof raw.status === 'string' ? raw.status : 'unknown',
    age_seconds: typeof raw.age_seconds === 'number' ? raw.age_seconds : null,
  }
  return Response.json(health, { status: health.healthy ? 200 : 503 })
}
