import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  requestOrigin: vi.fn(),
}))

vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/url', () => ({ requestOrigin: mocks.requestOrigin }))
vi.mock('@/lib/observability', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }))

import {
  bookingEventKey,
  queueBookingEvent,
  type BookingNotificationEvent,
} from './booking-events'

const base: BookingNotificationEvent = {
  tenantId: '10000000-0000-4000-8000-000000000001',
  bookingId: '20000000-0000-4000-8000-000000000001',
  type: 'booking_confirmation',
  occurredAt: '2030-01-01T09:00:00.000Z',
}

function serviceWithTenantOrigin(rpc: ReturnType<typeof vi.fn>) {
  const tenantQuery = {
    select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  }
  tenantQuery.select.mockReturnValue(tenantQuery)
  tenantQuery.eq.mockReturnValue(tenantQuery)
  tenantQuery.maybeSingle.mockResolvedValue({ data: { slug: 'demo' }, error: null })
  const domainQuery = {
    select: vi.fn(), eq: vi.fn(),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  }
  domainQuery.select.mockReturnValue(domainQuery)
  domainQuery.eq.mockReturnValue(domainQuery)
  return {
    rpc,
    from: vi.fn((table: string) => table === 'tenants' ? tenantQuery : domainQuery),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requestOrigin.mockResolvedValue('https://demo.corevo.se')
})

describe('bookingEventKey', () => {
  it('uses separate one-shot keys for a received request, confirmation and cancellation', () => {
    expect(bookingEventKey({ ...base, type: 'booking_request_received' })).toBe(
      `booking:${base.bookingId}:request-received`,
    )
    expect(bookingEventKey({ ...base, type: 'booking_confirmation' })).toBe(
      `booking:${base.bookingId}:confirmation`,
    )
    expect(bookingEventKey({ ...base, type: 'booking_cancelled' })).toBe(
      `booking:${base.bookingId}:cancelled`,
    )
  })

  it('routes a pending request as received, never as confirmed', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: '3', status: 'queued', chosen_channel: 'email', skip_reason: null, inserted: true }],
      error: null,
    })
    mocks.createServiceClient.mockReturnValue({ rpc })

    await queueBookingEvent({ ...base, type: 'booking_request_received' })

    expect(rpc).toHaveBeenCalledWith('route_booking_notification', expect.objectContaining({
      p_event_type: 'booking_request_received',
      p_event_key: `booking:${base.bookingId}:request-received`,
      p_expected_statuses: ['pending'],
      p_category: 'transactional',
    }))
  })

  it('includes the new start snapshot for rebook and reminder idempotence', () => {
    const start = '2030-01-02T10:15:00.000Z'
    expect(bookingEventKey({ ...base, type: 'booking_rebooked', startISO: start })).toBe(
      `booking:${base.bookingId}:rebook:${start}`,
    )
    expect(bookingEventKey({ ...base, type: 'booking_reminder', startISO: start })).toBe(
      `booking:${base.bookingId}:reminder:${start}`,
    )
  })
})

describe('queueBookingEvent', () => {
  it('routes through one tenant-safe database RPC and returns queued truthfully', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        id: '30000000-0000-4000-8000-000000000001',
        status: 'queued',
        chosen_channel: 'email',
        skip_reason: null,
        inserted: true,
      }],
      error: null,
    })
    mocks.createServiceClient.mockReturnValue({ rpc })

    await expect(queueBookingEvent({ ...base, startISO: '2030-01-01T10:00:00.000Z' }))
      .resolves.toEqual({ state: 'queued', channel: 'email', inserted: true })

    expect(rpc).toHaveBeenCalledWith('route_booking_notification', expect.objectContaining({
      p_tenant: base.tenantId,
      p_booking: base.bookingId,
      p_event_type: 'booking_confirmation',
      p_event_key: `booking:${base.bookingId}:confirmation`,
      p_expected_statuses: ['confirmed'],
      p_category: 'transactional',
      p_allow: true,
    }))
  })

  it('records actor choice none as skipped instead of pretending a send', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: '3', status: 'skipped', chosen_channel: null, skip_reason: 'actor_opted_out', inserted: true }],
      error: null,
    })
    mocks.createServiceClient.mockReturnValue({ rpc })

    await expect(queueBookingEvent({ ...base, allow: false, skipReason: 'actor_opted_out' }))
      .resolves.toEqual({ state: 'skipped', reason: 'actor_opted_out', inserted: true })
    expect(rpc).toHaveBeenCalledWith('route_booking_notification', expect.objectContaining({
      p_allow: false,
      p_skip_reason: 'actor_opted_out',
    }))
  })

  it('keeps a successful booking separate from an enqueue failure', async () => {
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'db down' } }),
    })
    await expect(queueBookingEvent(base)).resolves.toEqual({ state: 'error', reason: 'enqueue_failed' })
  })

  it('turns a thrown RPC/network failure into an explicit result after the mutation', async () => {
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockRejectedValue(new Error('network down')),
    })
    await expect(queueBookingEvent(base)).resolves.toEqual({ state: 'error', reason: 'enqueue_failed' })
  })

  it('never persists a backoffice host as a customer link origin', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: '3', status: 'queued', chosen_channel: 'email', skip_reason: null, inserted: true }],
      error: null,
    })
    mocks.createServiceClient.mockReturnValue(serviceWithTenantOrigin(rpc))

    await queueBookingEvent({
      ...base,
      includeManageLink: true,
      origin: 'https://booking.corevo.se',
    })

    const args = rpc.mock.calls[0]?.[1] as { p_payload: { origin: string } }
    expect(args.p_payload.origin).toBe('https://demo.boka.corevo.se')
  })

  it('never persists a raw account-claim or cancellation token in the outbox payload', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: '3', status: 'queued', chosen_channel: 'push', skip_reason: null, inserted: true }],
      error: null,
    })
    mocks.createServiceClient.mockReturnValue(serviceWithTenantOrigin(rpc))

    await queueBookingEvent({ ...base, includeAccountClaim: true, includeManageLink: true })
    const args = rpc.mock.calls[0]?.[1] as Record<string, unknown>
    const payload = JSON.stringify(args.p_payload)
    expect(payload).toContain('include_account_claim')
    expect(payload).toContain('include_manage_link')
    expect(payload).not.toMatch(/\/konto\/koppla\//)
    expect(payload).not.toMatch(/[?&]t=/)
    expect(payload).not.toContain('token')
  })

  it('resolves the pre-existing completion routing row without fabricating consent', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: 'existing', status: 'skipped', chosen_channel: null, skip_reason: 'no_consent', inserted: false }],
      error: null,
    })
    mocks.createServiceClient.mockReturnValue({ rpc })

    await expect(queueBookingEvent({
      ...base,
      type: 'booking_completed',
      outboxId: 'existing',
    })).resolves.toEqual({ state: 'skipped', reason: 'no_consent', inserted: false })

    expect(rpc).toHaveBeenCalledWith('route_booking_notification', expect.objectContaining({
      p_outbox_id: 'existing',
      p_category: 'marketing',
      p_type_opt_in: 'recommendations',
      p_expected_statuses: ['completed'],
    }))
  })
})
