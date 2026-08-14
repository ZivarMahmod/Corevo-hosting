import { beforeEach, describe, it, expect, vi } from 'vitest'
import { billingUnderlag, platformMonth, monthRangeUtc, platformOverview } from './metrics'

const platformCtxMock = vi.fn()
vi.mock('./guard', () => ({
  platformCtx: () => platformCtxMock(),
  platformAdminCtx: () => platformCtxMock(),
}))

function queryResult(result: { data?: unknown; count?: number | null; error: { message: string } | null }) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    lt: () => chain,
    order: () => chain,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  return chain
}

beforeEach(() => vi.clearAllMocks())

// The Översikt "denna månad" window is resolved in Europe/Stockholm, not the
// server's UTC, so the month flips at LOCAL midnight and the booking count lines
// up with billingUnderlag's bounds. These pin the timezone edge.

describe('platformMonth', () => {
  it('resolves the calendar month in Europe/Stockholm', () => {
    // 2026-06-15 12:00 UTC is solidly inside June in Stockholm.
    expect(platformMonth(new Date('2026-06-15T12:00:00Z'))).toEqual({ year: 2026, month: 6 })
  })
  it('a UTC instant just before local midnight still reads the local month', () => {
    // 2026-06-30 23:30 UTC = 2026-07-01 01:30 CEST → July locally, not June.
    expect(platformMonth(new Date('2026-06-30T23:30:00Z'))).toEqual({ year: 2026, month: 7 })
  })
  it('handles the December → January year rollover', () => {
    // 2026-12-31 23:30 UTC = 2027-01-01 00:30 CET → January 2027 locally.
    expect(platformMonth(new Date('2026-12-31T23:30:00Z'))).toEqual({ year: 2027, month: 1 })
  })
})

describe('monthRangeUtc (overview window)', () => {
  it('June 2026 spans the local-midnight UTC bounds', () => {
    const { fromUtc, toUtc } = monthRangeUtc(2026, 6)
    // CEST (UTC+2) in June → local midnight is 22:00 UTC the prior day.
    expect(fromUtc).toBe('2026-05-31T22:00:00.000Z')
    expect(toUtc).toBe('2026-06-30T22:00:00.000Z')
  })
})

describe('platform metrics fail closed', () => {
  it('uses the database aggregate instead of a truncatable booking row list', async () => {
    const client = {
      from: () => queryResult({
        data: [{
          id: 'tenant-1',
          slug: 'salong',
          name: 'Salong',
          status: 'active',
          tenant_settings: {
            billing_model: 'per_booking',
            per_booking_fee_cents: 500,
            flat_monthly_fee_cents: 0,
            setup_fee_cents: 0,
            settings: {},
          },
        }],
        error: null,
      }),
      rpc: () => Promise.resolve({
        data: { 'tenant-1': 1001 },
        error: null,
      }),
    }
    platformCtxMock.mockResolvedValue({ supabase: client })

    const result = await billingUnderlag(2026, 7)
    expect(result.rows[0]).toMatchObject({ completedBookings: 1001, feeCents: 500500 })
  })

  it('throws instead of showing a zero invoice total when bookings fail', async () => {
    const client = {
      from: () => queryResult({ data: [], error: null }),
      rpc: () => Promise.resolve({ data: null, error: { message: 'bookings offline' } }),
    }
    platformCtxMock.mockResolvedValue({ supabase: client })

    await expect(billingUnderlag(2026, 8)).rejects.toThrow(
      'billingUnderlag bookings: bookings offline',
    )
  })

  it('throws instead of showing zero overview metrics when a count fails', async () => {
    const tenantResults = [
      { count: null, error: { message: 'tenants offline' } },
      { count: 0, error: null },
      { count: 0, error: null },
      { data: [], error: null },
    ]
    const bookingResults = [
      { count: 0, error: null },
      { data: [], error: null },
    ]
    const client = {
      from: (table: string) => queryResult(
        (table === 'tenants' ? tenantResults.shift() : bookingResults.shift()) ?? {
          data: [],
          error: null,
        },
      ),
      rpc: () => Promise.resolve({ data: {}, error: null }),
    }
    platformCtxMock.mockResolvedValue({ supabase: client })

    await expect(platformOverview(new Date('2026-08-02T12:00:00Z'))).rejects.toThrow(
      'platformOverview tenants total: tenants offline',
    )
  })
})
