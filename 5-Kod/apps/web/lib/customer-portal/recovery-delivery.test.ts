import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaimedNotificationOutboxRow } from '@/lib/notifications/outbox'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  dispatchNotificationOutboxById: vi.fn(),
  sendGiadaMessage: vi.fn(),
  sendEmail: vi.fn(),
}))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/notifications/outbox', async (load) => {
  const actual = await load<typeof import('@/lib/notifications/outbox')>()
  return { ...actual, dispatchNotificationOutboxById: mocks.dispatchNotificationOutboxById }
})
vi.mock('@/lib/notifications/giada', () => ({ sendGiadaMessage: mocks.sendGiadaMessage }))
vi.mock('@/lib/notifications/email', () => ({ sendEmail: mocks.sendEmail }))

import {
  deliverPortalRecoveryOutbox,
  dispatchPortalRecoveryOutbox,
  dispatchPortalRecoveryOutboxById,
} from './recovery-delivery'
import { bookingContactDigest } from '@/lib/booking/verification'
import { portalRecoveryContactDigest } from './crypto'

const outboxId = '223e4567-e89b-42d3-a456-426614174000'
const challengeId = '123e4567-e89b-42d3-a456-426614174000'
const row = {
  id: outboxId,
  tenant_id: '323e4567-e89b-42d3-a456-426614174000',
  event_type: 'customer_portal_recovery_code',
  event_key: `customer-portal-recovery:${challengeId}`,
  category: 'transactional',
  chosen_channel: 'sms',
  payload: { template: 'customer_portal_recovery_code', challenge_id: challengeId },
  status: 'attempting',
  lease_token: '423e4567-e89b-42d3-a456-426614174000',
  lease_expires_at: '2026-07-22T19:00:00.000Z',
} as ClaimedNotificationOutboxRow

describe('durable portal recovery delivery', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
    process.env.BOOKING_PIN_PEPPER = 'abcdef0123456789abcdef0123456789'
    mocks.createServiceClient.mockReturnValue({ rpc })
    mocks.sendGiadaMessage.mockResolvedValue({ ok: true, id: 7, created: true })
    mocks.sendEmail.mockResolvedValue({ ok: true, id: 'mail-7' })
  })

  it('generates PIN only after claim and delivers a currently verified target', async () => {
    const contactDigest = await portalRecoveryContactDigest('sms', '+46729408522')
    const bookingDigest = await bookingContactDigest('sms', '+46729408522')
    rpc
      .mockResolvedValueOnce({
        data: [{
          outcome: 'target', challenge_public_id: challengeId, channel: 'sms',
          delivery_destination: '+46729408522', contact_digest: contactDigest,
          booking_contact_digest: bookingDigest, tenant_name: 'FreshCut',
          expires_at: '2026-07-22T19:00:00.000Z',
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: 'ready', error: null })
      .mockResolvedValueOnce({ data: 'ok', error: null })

    await expect(deliverPortalRecoveryOutbox(row)).resolves.toEqual({
      status: 'sent', providerRef: 'giada:7',
    })
    expect(mocks.sendGiadaMessage).toHaveBeenCalledWith(expect.objectContaining({
      to: '+46729408522',
      message: expect.stringMatching(/kod.*\d{6}/i),
      idempotencyKey: `portal-recovery:${outboxId}`,
    }))
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'customer_portal_recovery_delivery_target',
      'customer_portal_prepare_recovery_delivery',
      'customer_portal_record_recovery_outbox_delivery',
    ])
    expect(row.payload).toEqual({
      template: 'customer_portal_recovery_code', challenge_id: challengeId,
    })
    expect(JSON.stringify(row.payload)).not.toContain('46729408522')
  })

  it('claims and terminalizes a decoy through the same DB path without provider traffic', async () => {
    rpc
      .mockResolvedValueOnce({
        data: [{
          outcome: 'target', challenge_public_id: challengeId, channel: 'sms',
          delivery_destination: null, contact_digest: 'a'.repeat(64),
          booking_contact_digest: null, tenant_name: 'FreshCut',
          expires_at: '2026-07-22T19:00:00.000Z',
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: 'decoy', error: null })
      .mockResolvedValueOnce({ data: 'ok', error: null })

    await expect(deliverPortalRecoveryOutbox(row)).resolves.toEqual({
      status: 'skipped', reason: 'no_recipient',
    })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'customer_portal_recovery_delivery_target',
      'customer_portal_prepare_recovery_delivery',
      'customer_portal_record_recovery_outbox_delivery',
    ])
    expect(mocks.sendGiadaMessage).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('leaves provider-unavailable delivery pending so the durable lease can retry', async () => {
    const contactDigest = await portalRecoveryContactDigest('sms', '+46729408522')
    const bookingDigest = await bookingContactDigest('sms', '+46729408522')
    rpc
      .mockResolvedValueOnce({
        data: [{
          outcome: 'target', challenge_public_id: challengeId, channel: 'sms',
          delivery_destination: '+46729408522', contact_digest: contactDigest,
          booking_contact_digest: bookingDigest, tenant_name: 'FreshCut',
          expires_at: '2026-07-22T19:00:00.000Z',
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: 'ready', error: null })
    mocks.sendGiadaMessage.mockResolvedValue({ ok: false, reason: 'offline' })

    await expect(deliverPortalRecoveryOutbox(row)).resolves.toEqual({
      status: 'retry', error: 'provider_unavailable',
    })
    expect(rpc).not.toHaveBeenCalledWith(
      'customer_portal_record_recovery_outbox_delivery', expect.anything(),
    )
  })

  it('routes a verified email target through the same dedicated worker', async () => {
    const emailRow = { ...row, chosen_channel: 'email' } as ClaimedNotificationOutboxRow
    const contactDigest = await portalRecoveryContactDigest('email', 'kund@example.se')
    const bookingDigest = await bookingContactDigest('email', 'kund@example.se')
    rpc
      .mockResolvedValueOnce({
        data: [{
          outcome: 'target', challenge_public_id: challengeId, channel: 'email',
          delivery_destination: 'kund@example.se', contact_digest: contactDigest,
          booking_contact_digest: bookingDigest, tenant_name: 'FreshCut',
          expires_at: '2026-07-22T19:00:00.000Z',
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: 'ready', error: null })
      .mockResolvedValueOnce({ data: 'ok', error: null })

    await expect(deliverPortalRecoveryOutbox(emailRow)).resolves.toEqual({
      status: 'sent', providerRef: 'email:mail-7',
    })
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'kund@example.se',
      subject: expect.stringContaining('FreshCut'),
      html: expect.stringMatching(/\d{6}/),
    }))
    expect(mocks.sendGiadaMessage).not.toHaveBeenCalled()
  })

  it('uses the exact outbox-id accelerator and a bounded claimable-only cron selector', async () => {
    mocks.dispatchNotificationOutboxById.mockResolvedValue({
      claimed: 1, sent: 1, simulated: 0, skipped: 0, retried: 0, failed: 0, stale: 0,
    })
    await dispatchPortalRecoveryOutboxById(outboxId)
    expect(mocks.dispatchNotificationOutboxById).toHaveBeenCalledWith(
      outboxId, deliverPortalRecoveryOutbox,
    )

    rpc.mockResolvedValueOnce({ data: [{ id: outboxId }], error: null })
    mocks.createServiceClient.mockReturnValue({ rpc })
    await expect(dispatchPortalRecoveryOutbox()).resolves.toMatchObject({ claimed: 1, sent: 1 })
    expect(rpc).toHaveBeenCalledWith('customer_portal_recovery_outbox_candidates', {
      p_now: expect.any(String), p_limit: 50,
    })
  })
})
