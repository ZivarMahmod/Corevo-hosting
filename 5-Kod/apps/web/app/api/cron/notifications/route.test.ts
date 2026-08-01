import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dispatchNotificationOutbox: vi.fn(),
  dispatchPortalRecoveryOutbox: vi.fn(),
  deliverClaimedSmsOutbox: vi.fn(),
  after: vi.fn(),
}))
vi.mock('@/lib/notifications/outbox', () => ({
  dispatchNotificationOutbox: mocks.dispatchNotificationOutbox,
}))
vi.mock('@/lib/notifications/sms', () => ({
  deliverClaimedSmsOutbox: mocks.deliverClaimedSmsOutbox,
}))
vi.mock('@/lib/customer-portal/recovery-delivery', () => ({
  dispatchPortalRecoveryOutbox: mocks.dispatchPortalRecoveryOutbox,
}))
vi.mock('next/server', () => ({ after: mocks.after }))

import { GET } from './route'

const originalSecret = process.env.CRON_SECRET
const originalSmsMode = process.env.SMS_DELIVERY_MODE

afterAll(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = originalSecret
  if (originalSmsMode === undefined) delete process.env.SMS_DELIVERY_MODE
  else process.env.SMS_DELIVERY_MODE = originalSmsMode
})

describe('notification outbox cron', () => {
  const afterCallbacks: Array<() => Promise<void>> = []

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    delete process.env.SMS_DELIVERY_MODE
    mocks.dispatchPortalRecoveryOutbox.mockResolvedValue({
      claimed: 0, sent: 0, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0,
    })
    afterCallbacks.length = 0
    mocks.after.mockImplementation((callback: () => Promise<void>) => afterCallbacks.push(callback))
  })

  it('rejects unauthenticated callers without dispatching', async () => {
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications'))
    expect(response.status).toBe(401)
    expect(mocks.dispatchNotificationOutbox).not.toHaveBeenCalled()
    expect(mocks.dispatchPortalRecoveryOutbox).not.toHaveBeenCalled()
  })

  it('returns zero without claiming rows while SMS transport is off', async () => {
    mocks.dispatchNotificationOutbox.mockResolvedValue({
      claimed: 0,
      sent: 0,
      simulated: 0,
      skipped: 0,
      retried: 0,
      failed: 0,
      stale: 0,
    })
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      claimed: 0,
      sent: 0,
      simulated: 0,
      skipped: 0,
      retried: 0,
      failed: 0,
      stale: 0,
      recovery: {
        scheduled: true, limit: 5,
      },
    })
    expect(mocks.dispatchPortalRecoveryOutbox).not.toHaveBeenCalled()
    expect(afterCallbacks).toHaveLength(1)
    expect(mocks.dispatchNotificationOutbox).toHaveBeenCalledWith({})
  })

  it('wires the SMS-only adapter when the transport is explicitly enabled', async () => {
    process.env.SMS_DELIVERY_MODE = 'dry_run'
    mocks.dispatchNotificationOutbox.mockResolvedValue({
      claimed: 0, sent: 0, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0,
    })
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(200)
    expect(mocks.dispatchNotificationOutbox).toHaveBeenCalledWith({
      channel: 'sms',
      deliver: mocks.deliverClaimedSmsOutbox,
    })
    expect(mocks.dispatchPortalRecoveryOutbox).not.toHaveBeenCalled()
    expect(afterCallbacks).toHaveLength(1)
  })

  it('returns 500 so the scheduler can alert on database failure', async () => {
    mocks.dispatchNotificationOutbox.mockRejectedValue(new Error('claim_failed'))
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'cron_failed' })
  })

  it('keeps ordinary notifications successful when the deferred recovery batch rejects', async () => {
    mocks.dispatchPortalRecoveryOutbox.mockRejectedValue(new Error('recovery_claim_failed'))
    mocks.dispatchNotificationOutbox.mockResolvedValue({
      claimed: 0, sent: 0, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0,
    })
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(200)
    expect(mocks.dispatchNotificationOutbox).toHaveBeenCalledOnce()
    expect(mocks.dispatchPortalRecoveryOutbox).not.toHaveBeenCalled()
    await expect(afterCallbacks[0]!()).resolves.toBeUndefined()
    expect(mocks.dispatchPortalRecoveryOutbox).toHaveBeenCalledWith(5)
  })

  it('returns before a bounded recovery backlog can hang ordinary delivery', async () => {
    mocks.dispatchNotificationOutbox.mockResolvedValue({
      claimed: 1, sent: 1, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0,
    })
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(200)
    expect(mocks.dispatchNotificationOutbox).toHaveBeenCalledOnce()

    mocks.dispatchPortalRecoveryOutbox.mockReturnValue(new Promise(() => {}))
    void afterCallbacks[0]!()
    expect(mocks.dispatchPortalRecoveryOutbox).toHaveBeenCalledWith(5)
  })

  it('keeps ordinary notifications successful when deferred work cannot be registered', async () => {
    mocks.after.mockImplementation(() => {
      throw new Error('after_unavailable')
    })
    mocks.dispatchNotificationOutbox.mockResolvedValue({
      claimed: 1, sent: 1, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0,
    })

    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      sent: 1,
      recovery: { scheduled: false, limit: 5 },
    })
    expect(mocks.dispatchPortalRecoveryOutbox).not.toHaveBeenCalled()
  })
})
