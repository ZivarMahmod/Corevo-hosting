import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  queueBookingEvent: vi.fn(),
  getEnabledNotifications: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('./booking-events', () => ({ queueBookingEvent: mocks.queueBookingEvent }))
vi.mock('./settings', () => ({ getEnabledNotifications: mocks.getEnabledNotifications }))
vi.mock('@/lib/observability', () => ({ logger: { info: vi.fn(), warn: mocks.warn } }))

import { sendDueReminders } from './reminders'

const row = {
  id: 'booking-1',
  tenant_id: 'tenant-1',
  start_ts: '2030-01-01T10:00:00.000Z',
}

function workingClient(rows = [row]) {
  const rpc = vi.fn().mockResolvedValue({ data: rows.map((item) => item.id), error: null })
  const updates: Record<string, unknown>[] = []
  const filters: Array<[string, unknown]> = []
  const from = vi.fn(() => ({
    select(columns: string) {
      if (columns === 'id, tenant_id, start_ts') {
        const query = {
          in: vi.fn(() => query),
          eq: vi.fn(async () => ({ data: rows, error: null })),
        }
        return query
      }
      const current = {
        eq: vi.fn(() => current),
        maybeSingle: vi.fn(async () => ({ data: { reminded_at: new Date().toISOString() }, error: null })),
      }
      return current
    },
    update(patch: Record<string, unknown>) {
      updates.push(patch)
      const query = {
        eq(column: string, value: unknown) {
          filters.push([column, value])
          return query
        },
        in: vi.fn(() => query),
        is: vi.fn(() => query),
        select: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({ data: { id: row.id }, error: null })),
        then(resolve: (value: { error: null }) => unknown) {
          return Promise.resolve({ error: null }).then(resolve)
        },
      }
      return query
    },
  }))
  return { client: { rpc, from }, rpc, from, updates, filters }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getEnabledNotifications.mockResolvedValue({ reminder: true })
  mocks.queueBookingEvent.mockResolvedValue({ state: 'queued', channel: 'email', inserted: true })
})

describe('sendDueReminders', () => {
  it('fails the cron when the atomic claim fails', async () => {
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'db unavailable' } }),
    })
    await expect(sendDueReminders()).rejects.toThrow('reminders_claim_failed')
  })

  it('fails and releases claimed rows when the follow-up read fails', async () => {
    const released: string[][] = []
    const query = { in: vi.fn(), eq: vi.fn() }
    query.in.mockReturnValue(query)
    query.eq.mockResolvedValue({ data: null, error: { message: 'read failed' } })
    const release = {
      in(_column: string, ids: string[]) { released.push(ids); return release },
      eq: async () => ({ error: null }),
    }
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: ['booking-1'], error: null }),
      from: vi.fn(() => ({
        select: () => query,
        update: () => release,
      })),
    })
    await expect(sendDueReminders()).rejects.toThrow('reminders_query_failed')
    expect(released).toEqual([['booking-1']])
  })

  it('queues one stable domain event and stamps only after durable acceptance', async () => {
    const { client, rpc, updates, filters } = workingClient()
    mocks.createServiceClient.mockReturnValue(client)

    await expect(sendDueReminders()).resolves.toEqual({ scanned: 1, queued: 1, skipped: 0 })
    const claim = rpc.mock.calls[0]?.[1].p_claim
    expect(mocks.queueBookingEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: row.tenant_id,
      bookingId: row.id,
      type: 'booking_reminder',
      startISO: row.start_ts,
    }))
    expect(updates).toEqual([{
      reminded_at: expect.any(String),
      reminder_claim_token: null,
      reminder_claimed_at: null,
    }])
    expect(filters).toContainEqual(['reminder_claim_token', claim])
  })

  it('stamps a durable terminal skip so missing contact is not rediscovered forever', async () => {
    mocks.queueBookingEvent.mockResolvedValue({ state: 'skipped', reason: 'no_channel', inserted: true })
    const { client } = workingClient()
    mocks.createServiceClient.mockReturnValue(client)
    await expect(sendDueReminders()).resolves.toEqual({ scanned: 1, queued: 0, skipped: 1 })
  })

  it('releases the discovery lease and returns a failing cron when enqueue fails', async () => {
    mocks.queueBookingEvent.mockResolvedValue({ state: 'error', reason: 'enqueue_failed' })
    const { client, updates } = workingClient()
    mocks.createServiceClient.mockReturnValue(client)
    await expect(sendDueReminders()).rejects.toThrow('reminders_enqueue_failed')
    expect(updates).toContainEqual({ reminder_claim_token: null, reminder_claimed_at: null })
  })

  it('keeps reminders discoverable when the tenant toggle is temporarily off', async () => {
    mocks.getEnabledNotifications.mockResolvedValue({ reminder: false })
    const { client, updates } = workingClient()
    mocks.createServiceClient.mockReturnValue(client)
    await expect(sendDueReminders()).resolves.toEqual({ scanned: 1, queued: 0, skipped: 1 })
    expect(mocks.queueBookingEvent).not.toHaveBeenCalled()
    expect(updates).toEqual([{ reminder_claim_token: null, reminder_claimed_at: null }])
  })

  it('fails instead of reporting green when releasing a claim fails', async () => {
    mocks.getEnabledNotifications.mockResolvedValue({ reminder: false })
    const query = { in: vi.fn(), eq: vi.fn() }
    query.in.mockReturnValue(query)
    query.eq.mockResolvedValue({ data: [row], error: null })
    const release = {
      in: () => release,
      eq: async () => ({ error: { message: 'write failed' } }),
    }
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: [row.id], error: null }),
      from: vi.fn(() => ({ select: () => query, update: () => release })),
    })
    await expect(sendDueReminders()).rejects.toThrow('reminders_release_failed')
  })
})
