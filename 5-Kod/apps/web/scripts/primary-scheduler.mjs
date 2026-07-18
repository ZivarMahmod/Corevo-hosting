const SCHEDULER_NAME = 'cloudflare-reminders-primary'
const REMINDER_URL = 'https://booking.corevo.se/api/cron/reminders'

function required(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

async function recordHeartbeat({ env, fetchImpl, runId, phase, errorCode, observedAt }) {
  const response = await fetchImpl(new Request(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/record_scheduler_heartbeat`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        p_scheduler_name: SCHEDULER_NAME,
        p_run_id: runId,
        p_phase: phase,
        p_error_code: errorCode ?? null,
        p_observed_at: observedAt,
      }),
    },
  ))
  if (!response.ok) throw new Error('primary_scheduler_heartbeat_failed')
}

export async function runPrimaryScheduler({
  env,
  appFetch,
  fetchImpl = fetch,
  runId = crypto.randomUUID(),
  now = () => new Date(),
}) {
  const cronSecret = required(env?.CRON_SECRET)
  const supabaseUrl = required(env?.NEXT_PUBLIC_SUPABASE_URL)
  const serviceRole = required(env?.SUPABASE_SERVICE_ROLE_KEY)
  if (!cronSecret || !supabaseUrl || !serviceRole) {
    throw new Error('primary_scheduler_configuration_missing')
  }
  const safeEnv = {
    ...env,
    CRON_SECRET: cronSecret,
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl.replace(/\/$/, ''),
    SUPABASE_SERVICE_ROLE_KEY: serviceRole,
  }
  const startedAt = now().toISOString()
  await recordHeartbeat({
    env: safeEnv,
    fetchImpl,
    runId,
    phase: 'started',
    errorCode: null,
    observedAt: startedAt,
  })

  try {
    const response = await appFetch(new Request(REMINDER_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${cronSecret}` },
    }))
    if (!response.ok) throw new Error('primary_scheduler_route_failed')
    await recordHeartbeat({
      env: safeEnv,
      fetchImpl,
      runId,
      phase: 'succeeded',
      errorCode: null,
      observedAt: now().toISOString(),
    })
  } catch (error) {
    try {
      await recordHeartbeat({
        env: safeEnv,
        fetchImpl,
        runId,
        phase: 'failed',
        errorCode: error instanceof Error && error.message === 'primary_scheduler_route_failed'
          ? 'route_failed'
          : 'scheduler_failed',
        observedAt: now().toISOString(),
      })
    } catch {
      // The missing success heartbeat is itself observable by the independent
      // watchdog. Never mask the original closed scheduler failure.
    }
    throw error
  }
}
