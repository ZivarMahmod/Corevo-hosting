const SCHEDULER_NAME = 'cloudflare-reminders-primary'
const DEFAULT_ROUTE_TIMEOUT_MS = 60_000
const ROUTE_PATHS = [
  '/api/cron/reminders',
  '/api/cron/notifications',
  '/api/cron/payment-refunds',
  '/api/cron/media-cleanup',
  '/api/cron/generic-jobs',
]

function required(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function schedulerOrigin(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.origin === value.replace(/\/$/, '') ? url.origin : null
  } catch {
    return null
  }
}

async function fetchWithTimeout({ fetchImpl, request, timeoutMs, timeoutError }) {
  const controller = new AbortController()
  let timeoutId
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      reject(new Error(timeoutError))
    }, timeoutMs)
  })
  try {
    return await Promise.race([
      fetchImpl(new Request(request, { signal: controller.signal })),
      timeout,
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}

async function runRoute({ appFetch, cronSecret, routeTimeoutMs, url }) {
  return fetchWithTimeout({
    fetchImpl: appFetch,
    request: new Request(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${cronSecret}` },
    }),
    timeoutMs: routeTimeoutMs,
    timeoutError: 'primary_scheduler_route_timeout',
  })
}

async function recordHeartbeat({ env, fetchImpl, runId, phase, errorCode, observedAt, timeoutMs }) {
  const response = await fetchWithTimeout({
    fetchImpl,
    request: new Request(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/record_scheduler_heartbeat`, {
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
    }),
    timeoutMs,
    timeoutError: 'primary_scheduler_heartbeat_timeout',
  })
  if (!response.ok) throw new Error('primary_scheduler_heartbeat_failed')
}

export async function runPrimaryScheduler({
  env,
  appFetch,
  fetchImpl = fetch,
  runId = crypto.randomUUID(),
  now = () => new Date(),
  routeTimeoutMs = DEFAULT_ROUTE_TIMEOUT_MS,
}) {
  const cronSecret = required(env?.CRON_SECRET)
  const supabaseUrl = required(env?.NEXT_PUBLIC_SUPABASE_URL)
  const serviceRole = required(env?.SUPABASE_SERVICE_ROLE_KEY)
  const siteOrigin = schedulerOrigin(required(env?.NEXT_PUBLIC_SITE_URL))
  if (!cronSecret || !supabaseUrl || !serviceRole || !siteOrigin) {
    throw new Error('primary_scheduler_configuration_missing')
  }
  const safeRouteTimeoutMs = Number.isFinite(routeTimeoutMs) && routeTimeoutMs > 0
    ? routeTimeoutMs
    : DEFAULT_ROUTE_TIMEOUT_MS
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
    timeoutMs: safeRouteTimeoutMs,
  })

  try {
    let routeFailed = false
    for (const path of ROUTE_PATHS) {
      try {
        const response = await runRoute({
          appFetch,
          cronSecret,
          routeTimeoutMs: safeRouteTimeoutMs,
          url: new URL(path, siteOrigin),
        })
        routeFailed ||= !response.ok
      } catch {
        routeFailed = true
      }
    }
    if (routeFailed) throw new Error('primary_scheduler_route_failed')
    await recordHeartbeat({
      env: safeEnv,
      fetchImpl,
      runId,
      phase: 'succeeded',
      errorCode: null,
      observedAt: now().toISOString(),
      timeoutMs: safeRouteTimeoutMs,
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
        timeoutMs: safeRouteTimeoutMs,
      })
    } catch {
      // The missing success heartbeat is itself observable by the independent
      // watchdog. Never mask the original closed scheduler failure.
    }
    throw error
  }
}
