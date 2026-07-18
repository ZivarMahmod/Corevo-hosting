import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { runPrimaryScheduler } from './primary-scheduler.mjs'

const env = {
  CRON_SECRET: 'cron-secret',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
}

describe('primary reminder scheduler', () => {
  it('records start/success and only queues reminders through the secret-gated app route', async () => {
    const heartbeat = []
    const appRequests = []
    const fetchImpl = async (request) => {
      heartbeat.push(await request.json())
      return new Response(JSON.stringify(true), { status: 200 })
    }
    const appFetch = async (request) => {
      appRequests.push(request)
      return new Response(JSON.stringify({ ok: true, queued: 2 }), { status: 200 })
    }

    await runPrimaryScheduler({
      env,
      appFetch,
      fetchImpl,
      runId: '00000000-0000-4000-8000-000000000001',
      now: () => new Date('2026-07-18T10:00:00Z'),
    })

    assert.equal(appRequests.length, 1)
    assert.equal(new URL(appRequests[0].url).pathname, '/api/cron/reminders')
    assert.equal(appRequests[0].headers.get('authorization'), 'Bearer cron-secret')
    assert.deepEqual(heartbeat.map((entry) => entry.p_phase), ['started', 'succeeded'])
  })

  it('records a closed failure code and rejects the scheduled run on a non-2xx app response', async () => {
    const heartbeat = []
    await assert.rejects(() => runPrimaryScheduler({
      env,
      appFetch: async () => new Response('failed', { status: 500 }),
      fetchImpl: async (request) => {
        heartbeat.push(await request.json())
        return new Response(JSON.stringify(true), { status: 200 })
      },
      runId: '00000000-0000-4000-8000-000000000002',
      now: () => new Date('2026-07-18T10:00:00Z'),
    }), /primary_scheduler_route_failed/)

    assert.deepEqual(heartbeat.map((entry) => entry.p_phase), ['started', 'failed'])
    assert.equal(heartbeat[1].p_error_code, 'route_failed')
  })

  it('fails before any app call when a required secret is missing', async () => {
    let called = false
    await assert.rejects(() => runPrimaryScheduler({
      env: { ...env, CRON_SECRET: '' },
      appFetch: async () => {
        called = true
        return new Response(null, { status: 200 })
      },
      fetchImpl: async () => new Response(null, { status: 200 }),
    }), /primary_scheduler_configuration_missing/)
    assert.equal(called, false)
  })
})
