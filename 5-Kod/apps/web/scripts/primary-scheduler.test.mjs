import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { runPrimaryScheduler } from './primary-scheduler.mjs'

const env = {
  CRON_SECRET: 'cron-secret',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
  NEXT_PUBLIC_SITE_URL: 'https://isolated-staging.example.test',
}

describe('primary booking scheduler', () => {
  it('records start/success after retention, reminders and refunds succeed internally', async () => {
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

    assert.equal(appRequests.length, 5)
    assert.equal(new URL(appRequests[0].url).pathname, '/api/cron/pending-expiry')
    assert.equal(new URL(appRequests[1].url).pathname, '/api/cron/reminders')
    assert.equal(new URL(appRequests[2].url).pathname, '/api/cron/notifications')
    assert.equal(new URL(appRequests[3].url).pathname, '/api/cron/payment-refunds')
    assert.equal(new URL(appRequests[4].url).pathname, '/api/cron/media-cleanup')
    for (const request of appRequests) {
      assert.equal(request.method, 'POST')
      assert.equal(request.headers.get('authorization'), 'Bearer cron-secret')
      assert.equal(new URL(request.url).origin, 'https://isolated-staging.example.test')
      assert.notEqual(new URL(request.url).origin, 'https://booking.corevo.se')
    }
    assert.deepEqual(heartbeat.map((entry) => entry.p_phase), ['started', 'succeeded'])
  })

  it('records a closed failure code and rejects the scheduled run on a non-2xx app response', async () => {
    const heartbeat = []
    const paths = []
    await assert.rejects(() => runPrimaryScheduler({
      env,
      appFetch: async (request) => {
        paths.push(new URL(request.url).pathname)
        return new URL(request.url).pathname.endsWith('payment-refunds')
          ? new Response('failed', { status: 503 })
          : new Response('{}', { status: 200 })
      },
      fetchImpl: async (request) => {
        heartbeat.push(await request.json())
        return new Response(JSON.stringify(true), { status: 200 })
      },
      runId: '00000000-0000-4000-8000-000000000002',
      now: () => new Date('2026-07-18T10:00:00Z'),
    }), /primary_scheduler_route_failed/)

    assert.deepEqual(heartbeat.map((entry) => entry.p_phase), ['started', 'failed'])
    assert.equal(heartbeat[1].p_error_code, 'route_failed')
    assert.deepEqual(paths, [
      '/api/cron/pending-expiry',
      '/api/cron/reminders',
      '/api/cron/notifications',
      '/api/cron/payment-refunds',
      '/api/cron/media-cleanup',
    ])
  })

  it('attempts refunds even when reminders fail, then fails the composite heartbeat closed', async () => {
    const paths = []
    await assert.rejects(() => runPrimaryScheduler({
      env,
      appFetch: async (request) => {
        const path = new URL(request.url).pathname
        paths.push(path)
        return new Response('{}', { status: path.endsWith('/reminders') ? 500 : 200 })
      },
      fetchImpl: async () => new Response(JSON.stringify(true), { status: 200 }),
    }), /primary_scheduler_route_failed/)
    assert.deepEqual(paths, [
      '/api/cron/pending-expiry',
      '/api/cron/reminders',
      '/api/cron/notifications',
      '/api/cron/payment-refunds',
      '/api/cron/media-cleanup',
    ])
  })

  it('records a failed heartbeat when one route never settles', async () => {
    const heartbeat = []
    const paths = []
    await assert.rejects(() => runPrimaryScheduler({
      env,
      appFetch: async (request) => {
        const path = new URL(request.url).pathname
        paths.push(path)
        if (path.endsWith('/notifications')) return new Promise(() => {})
        return new Response('{}', { status: 200 })
      },
      fetchImpl: async (request) => {
        heartbeat.push(await request.json())
        return new Response(JSON.stringify(true), { status: 200 })
      },
      routeTimeoutMs: 1,
    }), /primary_scheduler_route_failed/)

    assert.deepEqual(heartbeat.map((entry) => entry.p_phase), ['started', 'failed'])
    assert.equal(heartbeat[1].p_error_code, 'route_failed')
    assert.deepEqual(paths, [
      '/api/cron/pending-expiry',
      '/api/cron/reminders',
      '/api/cron/notifications',
      '/api/cron/payment-refunds',
      '/api/cron/media-cleanup',
    ])
  })

  it('fails closed when the initial heartbeat never settles', async () => {
    let appCalled = false
    const result = await Promise.race([
      runPrimaryScheduler({
        env,
        appFetch: async () => {
          appCalled = true
          return new Response(null, { status: 200 })
        },
        fetchImpl: async () => new Promise(() => {}),
        routeTimeoutMs: 1,
      }).then(
        () => 'resolved',
        (error) => error instanceof Error ? error.message : String(error),
      ),
      new Promise((resolve) => setTimeout(() => resolve('timed_out'), 25)),
    ])

    assert.equal(result, 'primary_scheduler_heartbeat_timeout')
    assert.equal(appCalled, false)
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

  it('fails before any app call when the scheduler origin is invalid', async () => {
    let called = false
    await assert.rejects(() => runPrimaryScheduler({
      env: { ...env, NEXT_PUBLIC_SITE_URL: 'http://booking.corevo.se' },
      appFetch: async () => {
        called = true
        return new Response(null, { status: 200 })
      },
      fetchImpl: async () => new Response(null, { status: 200 }),
    }), /primary_scheduler_configuration_missing/)
    assert.equal(called, false)
  })
})
