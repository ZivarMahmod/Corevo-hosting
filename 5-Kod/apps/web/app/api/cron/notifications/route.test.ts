import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dispatchNotificationOutbox: vi.fn(),
  dispatchPortalRecoveryOutbox: vi.fn(),
  deliverImmediateOffertOutbox: vi.fn(),
  deliverImmediateBookingOutbox: vi.fn(),
  deliverClaimedSmsOutbox: vi.fn(),
}))
vi.mock('@/lib/notifications/outbox', () => ({
  dispatchNotificationOutbox: mocks.dispatchNotificationOutbox,
}))
vi.mock('@/lib/notifications/sms', () => ({
  deliverClaimedSmsOutbox: mocks.deliverClaimedSmsOutbox,
}))
vi.mock('@/lib/notifications/booking-immediate', () => ({
  deliverImmediateBookingOutbox: mocks.deliverImmediateBookingOutbox,
}))
vi.mock('@/lib/admin/offert/reply-delivery', () => ({
  deliverImmediateOffertOutbox: mocks.deliverImmediateOffertOutbox,
}))
vi.mock('@/lib/customer-portal/recovery-delivery', () => ({
  dispatchPortalRecoveryOutbox: mocks.dispatchPortalRecoveryOutbox,
}))

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
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    delete process.env.SMS_DELIVERY_MODE
    mocks.dispatchPortalRecoveryOutbox.mockResolvedValue({
      claimed: 0, sent: 0, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0,
    })
  })

  it('rejects unauthenticated callers without dispatching', async () => {
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications'))
    expect(response.status).toBe(401)
    expect(mocks.dispatchNotificationOutbox).not.toHaveBeenCalled()
    expect(mocks.dispatchPortalRecoveryOutbox).not.toHaveBeenCalled()
  })

  it('routes queued email to its existing delivery owner while SMS transport is off', async () => {
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
      recovery: { claimed: 0, sent: 0, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0 },
    })
    expect(mocks.dispatchPortalRecoveryOutbox).toHaveBeenCalledWith(5)
    const [[{ deliver }]] = mocks.dispatchNotificationOutbox.mock.calls
    await deliver({ event_type: 'offert_reply' })
    await deliver({ event_type: 'booking_confirmation' })
    expect(mocks.deliverImmediateOffertOutbox).toHaveBeenCalledWith({ event_type: 'offert_reply' })
    expect(mocks.deliverImmediateBookingOutbox).toHaveBeenCalledWith({ event_type: 'booking_confirmation' })
  })

  it('delivers email and separately gated SMS when the transport is explicitly enabled', async () => {
    process.env.SMS_DELIVERY_MODE = 'dry_run'
    mocks.dispatchNotificationOutbox.mockResolvedValue({
      claimed: 0, sent: 0, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0,
    })
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(200)
    expect(mocks.dispatchNotificationOutbox).toHaveBeenNthCalledWith(1, {
      deliver: expect.any(Function),
    })
    expect(mocks.dispatchNotificationOutbox).toHaveBeenNthCalledWith(2, {
      channel: 'sms',
      deliver: mocks.deliverClaimedSmsOutbox,
    })
    expect(mocks.dispatchPortalRecoveryOutbox).toHaveBeenCalledWith(5)
  })

  it('returns 500 so the scheduler can alert on database failure', async () => {
    mocks.dispatchNotificationOutbox.mockRejectedValue(new Error('claim_failed'))
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'cron_failed' })
  })

  it('returns 500 so the scheduler can alert on recovery failure', async () => {
    mocks.dispatchPortalRecoveryOutbox.mockRejectedValue(new Error('recovery_claim_failed'))
    mocks.dispatchNotificationOutbox.mockResolvedValue({
      claimed: 0, sent: 0, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0,
    })
    const response = await GET(new Request('https://booking.corevo.se/api/cron/notifications', {
      headers: { authorization: 'Bearer test-secret' },
    }))
    expect(response.status).toBe(500)
    expect(mocks.dispatchNotificationOutbox).toHaveBeenCalledOnce()
    expect(mocks.dispatchPortalRecoveryOutbox).toHaveBeenCalledWith(5)
    await expect(response.json()).resolves.toEqual({ error: 'cron_failed' })
  })
})
