import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  warn: vi.fn(),
  sendBookingReminder: vi.fn(),
  parseGuestEmail: vi.fn(),
  parseGuestPhone: vi.fn(),
  getEnabledNotifications: vi.fn(),
  getSmsEnabled: vi.fn(),
}))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))
vi.mock('@/lib/observability', () => ({ logger: { info: vi.fn(), warn: mocks.warn } }))
vi.mock('./booking', () => ({
  sendBookingReminder: mocks.sendBookingReminder,
  parseGuestEmail: mocks.parseGuestEmail,
}))
vi.mock('./sms', () => ({ sendSms: vi.fn(), parseGuestPhone: mocks.parseGuestPhone }))
vi.mock('./settings', () => ({
  getEnabledNotifications: mocks.getEnabledNotifications,
  getSmsEnabled: mocks.getSmsEnabled,
}))

import { sendDueReminders } from './reminders'

const reminderRow = {
  id: 'booking-1',
  tenant_id: 'tenant-1',
  start_ts: '2030-01-01T10:00:00.000Z',
  note: 'guest',
  customer_profile_id: null,
  services: { name: 'Klippning' },
  tenants: { name: 'Salongen' },
  locations: { timezone: 'Europe/Stockholm' },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.parseGuestEmail.mockReturnValue('kund@example.com')
  mocks.parseGuestPhone.mockReturnValue(null)
  mocks.getEnabledNotifications.mockResolvedValue({ reminder: true })
  mocks.sendBookingReminder.mockResolvedValue({ ok: true })
})

describe('sendDueReminders', () => {
  it('kastar claimfel i stället för att låtsas att körningen var grön', async () => {
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'database unavailable' } }),
    })

    await expect(sendDueReminders()).rejects.toThrow('reminders_claim_failed')
    expect(mocks.warn).toHaveBeenCalled()
  })

  it('kastar queryfel efter claim i stället för att rapportera en falsk nollkörning', async () => {
    const releasedIds: unknown[][] = []
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      eq: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.in.mockReturnValue(query)
    query.eq.mockResolvedValue({ data: null, error: { message: 'database unavailable' } })
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: ['booking-1'], error: null }),
      from: vi.fn(() => ({
        select: query.select,
        update: () => {
          const release = {
            in(_column: string, ids: unknown[]) {
              releasedIds.push(ids)
              return release
            },
            eq: async () => ({ error: null }),
          }
          return release
        },
      })),
    })

    await expect(sendDueReminders()).rejects.toThrow('reminders_query_failed')
    expect(mocks.warn).toHaveBeenCalled()
    expect(releasedIds).toEqual([['booking-1']])
  })

  it('claimar före transport och finaliserar endast med samma claim-token', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: ['booking-1'], error: null })
    const updatePatches: Record<string, unknown>[] = []
    const updateFilters: Array<[string, unknown]> = []
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      eq: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.in.mockReturnValue(query)
    query.eq.mockResolvedValue({ data: [reminderRow], error: null })

    const client = {
      rpc,
      from: vi.fn(() => ({
        select: query.select,
        update: (patch: Record<string, unknown>) => {
          updatePatches.push(patch)
          const chain = {
            eq(column: string, value: unknown) {
              updateFilters.push([column, value])
              return chain
            },
            select: () => chain,
            maybeSingle: async () => ({ data: { id: 'booking-1' }, error: null }),
          }
          return chain
        },
      })),
    }
    mocks.createServiceClient.mockReturnValue(client)

    await expect(sendDueReminders()).resolves.toEqual({ scanned: 1, sent: 1, skipped: 0 })
    const claim = rpc.mock.calls[0][1].p_claim
    expect(claim).toEqual(expect.any(String))
    expect(mocks.sendBookingReminder).toHaveBeenCalledOnce()
    expect(updatePatches).toEqual([
      {
        reminded_at: expect.any(String),
        reminder_claim_token: null,
        reminder_claimed_at: null,
      },
    ])
    expect(updateFilters).toContainEqual(['reminder_claim_token', claim])
  })

  it('släpper claimen när e-posttransporten inte bekräftar leverans', async () => {
    mocks.sendBookingReminder.mockResolvedValue({ ok: false, error: 'relay_down' })
    const updates: Record<string, unknown>[] = []
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      eq: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.in.mockReturnValue(query)
    query.eq.mockResolvedValue({ data: [reminderRow], error: null })
    const release = {
      in: vi.fn(),
      eq: vi.fn(),
      then: (resolve: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(resolve),
    }
    release.in.mockReturnValue(release)
    release.eq.mockReturnValue(release)
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: ['booking-1'], error: null }),
      from: vi.fn(() => ({
        select: query.select,
        update: (patch: Record<string, unknown>) => {
          updates.push(patch)
          return release
        },
      })),
    })

    await expect(sendDueReminders()).resolves.toEqual({ scanned: 1, sent: 0, skipped: 1 })
    expect(updates).toEqual([{ reminder_claim_token: null, reminder_claimed_at: null }])
  })

  it('släpper senare oprocessade claims men bevarar raden vars leveransutfall är okänt', async () => {
    const secondRow = { ...reminderRow, id: 'booking-2' }
    mocks.sendBookingReminder.mockRejectedValueOnce(new Error('relay connection reset'))
    const releasedIds: unknown[][] = []
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      eq: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.in.mockReturnValue(query)
    query.eq.mockResolvedValue({ data: [reminderRow, secondRow], error: null })
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: ['booking-1', 'booking-2'], error: null }),
      from: vi.fn(() => ({
        select: query.select,
        update: () => {
          const release = {
            in(_column: string, ids: unknown[]) {
              releasedIds.push(ids)
              return release
            },
            eq: async () => ({ error: null }),
          }
          return release
        },
      })),
    })

    await expect(sendDueReminders()).rejects.toThrow('relay connection reset')
    expect(releasedIds).toEqual([['booking-2']])
  })

  it('kastar när claim-release fallerar så cron inte rapporterar falsk framgång', async () => {
    mocks.parseGuestEmail.mockReturnValue(null)
    const query = {
      select: vi.fn(),
      in: vi.fn(),
      eq: vi.fn(),
    }
    query.select.mockReturnValue(query)
    query.in.mockReturnValue(query)
    query.eq.mockResolvedValue({ data: [reminderRow], error: null })
    mocks.createServiceClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: ['booking-1'], error: null }),
      from: vi.fn(() => ({
        select: query.select,
        update: () => {
          const release = {
            in: () => release,
            eq: async () => ({ error: { message: 'write failed' } }),
          }
          return release
        },
      })),
    })

    await expect(sendDueReminders()).rejects.toThrow('reminders_release_failed')
    expect(mocks.warn).toHaveBeenCalledWith('reminders.release_failed', {
      bookingIds: ['booking-1'],
      error: 'write failed',
    })
  })
})
