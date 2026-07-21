import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClaimedNotificationOutboxRow } from './outbox'

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  sendGiada: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('./booking-delivery', () => ({ prepareBookingDelivery: mocks.prepare }))
vi.mock('./giada', () => ({ sendGiadaMessage: mocks.sendGiada }))
vi.mock('./email', () => ({ sendEmail: mocks.sendEmail }))

import { deliverImmediateBookingOutbox } from './booking-immediate'

const row = {
  id: '10000000-0000-4000-8000-000000000001',
  chosen_channel: 'sms',
} as ClaimedNotificationOutboxRow

describe('immediate verified booking delivery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses Giada with the outbox id as stable idempotency key', async () => {
    mocks.prepare.mockResolvedValue({ ok: true, channel: 'sms', to: '+46701234567', body: 'Demo: bokad', from: 'Demo' })
    mocks.sendGiada.mockResolvedValue({ ok: true, id: 42, created: true })

    await expect(deliverImmediateBookingOutbox(row)).resolves.toEqual({
      status: 'sent', providerRef: 'giada:42',
    })
    expect(mocks.sendGiada).toHaveBeenCalledWith({
      to: '+46701234567',
      message: 'Demo: bokad',
      idempotencyKey: `outbox:${row.id}`,
    })
  })

  it('retries a pre-acceptance Giada outage safely', async () => {
    mocks.prepare.mockResolvedValue({ ok: true, channel: 'sms', to: '+46701234567', body: 'Demo: bokad', from: 'Demo' })
    mocks.sendGiada.mockResolvedValue({ ok: false, reason: 'offline' })
    await expect(deliverImmediateBookingOutbox(row)).resolves.toEqual({
      status: 'retry', error: 'provider_unavailable',
    })
  })

  it('delivers email through the existing relay', async () => {
    mocks.prepare.mockResolvedValue({
      ok: true,
      channel: 'email',
      to: 'kund@example.com',
      subject: 'Bokad',
      html: '<p>Bokad</p>',
      from: 'Demo <booking@corevo.se>',
      replyTo: 'demo@example.com',
    })
    mocks.sendEmail.mockResolvedValue({ ok: true, id: 'mail-1' })

    await expect(deliverImmediateBookingOutbox({ ...row, chosen_channel: 'email' })).resolves.toEqual({
      status: 'sent', providerRef: 'email:mail-1',
    })
  })

  it('terminalizes uncertain email outcomes instead of duplicating them', async () => {
    mocks.prepare.mockResolvedValue({
      ok: true, channel: 'email', to: 'kund@example.com', subject: 'Bokad', html: '<p>Bokad</p>',
    })
    mocks.sendEmail.mockResolvedValue({ ok: false, error: 'exception' })
    await expect(deliverImmediateBookingOutbox({ ...row, chosen_channel: 'email' })).resolves.toEqual({
      status: 'failed', reason: 'delivery_uncertain',
    })
  })
})
