import { readFileSync } from 'node:fs'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createServiceClient: vi.fn(),
}))

vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/platform/service', () => ({ createServiceClient: mocks.createServiceClient }))

import {
  getPortalBooking,
  getPortalSessionSnapshot,
  listPortalBookings,
} from './data'

const originalKey = process.env.CUSTOMER_PORTAL_HMAC_KEY
const firstSession = '123e4567-e89b-42d3-a456-426614174000'
const secondSession = '223e4567-e89b-42d3-a456-426614174000'
const bookingId = '323e4567-e89b-42d3-a456-426614174000'
const secondBookingId = '423e4567-e89b-42d3-a456-426614174000'
const firstSecret = 'A'.repeat(43)
const secondSecret = 'B'.repeat(43)

const validBooking = {
  id: bookingId,
  startTs: '2026-08-01T10:00:00.000Z',
  endTs: '2026-08-01T10:30:00.000Z',
  status: 'confirmed',
  serviceName: 'Klippning',
  durationMinutes: 30,
  staffTitle: 'Sam',
  location: {
    name: 'Corevo Studio',
    address: 'Testgatan 1',
    phone: null,
    mapUrl: null,
    timezone: 'Europe/Stockholm',
  },
  priceCents: 32900,
  currency: 'SEK',
  canCancel: true,
  cancelDeadline: '2026-07-31T10:00:00.000Z',
  publicRebookUrl: 'https://freshcut.corevo.se/boka',
}

function setCookie(sessionPublicId = firstSession, secret = firstSecret) {
  mocks.cookies.mockResolvedValue({
    get: vi.fn((name: string) =>
      name === '__Host-corevo-portal'
        ? { value: `v1.${sessionPublicId}.${secret}` }
        : undefined,
    ),
  })
}

afterAll(() => {
  if (originalKey === undefined) delete process.env.CUSTOMER_PORTAL_HMAC_KEY
  else process.env.CUSTOMER_PORTAL_HMAC_KEY = originalKey
})

describe('customer portal server DAL', () => {
  const rpc = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
    setCookie()
    mocks.createServiceClient.mockReturnValue({ rpc })
  })

  it('fails closed as expired for a missing or malformed cookie without touching DB', async () => {
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => undefined) })
    await expect(getPortalSessionSnapshot()).resolves.toEqual({ outcome: 'expired' })
    await expect(listPortalBookings({ scope: 'upcoming' })).resolves.toEqual({ outcome: 'expired' })
    await expect(getPortalBooking(bookingId)).resolves.toEqual({ outcome: 'expired' })

    setCookie(firstSession, 'short')
    await expect(getPortalSessionSnapshot()).resolves.toEqual({ outcome: 'expired' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('fails neutrally when the service client or dedicated HMAC key is unavailable', async () => {
    mocks.createServiceClient.mockReturnValue(null)
    await expect(getPortalSessionSnapshot()).resolves.toEqual({ outcome: 'unavailable' })

    mocks.createServiceClient.mockReturnValue({ rpc })
    delete process.env.CUSTOMER_PORTAL_HMAC_KEY
    await expect(listPortalBookings({ scope: 'history' })).resolves.toEqual({ outcome: 'unavailable' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reads a validated snapshot using only session public id + digest', async () => {
    rpc.mockResolvedValue({
      data: [{
        outcome: 'ok',
        snapshot: {
          tenantSlug: 'freshcut',
          tenantName: 'FreshCut',
          logoUrl: 'https://cdn.corevo.se/freshcut/logo.png',
          verticalLabel: 'Frisörsalong',
          phone: '+46 70 000 00 00',
          address: 'Testgatan 1',
          mapUrl: null,
          bookingOrigin: 'https://freshcut.corevo.se',
          timezone: 'Europe/Stockholm',
          locale: 'sv-SE',
          defaultCountry: 'SE',
          currency: 'SEK',
          cancellationCutoffHours: 24,
          customerName: 'Zivar',
          lastSeenAt: '2026-07-22T12:00:00.000Z',
          absoluteExpiresAt: '2027-07-22T12:00:00.000Z',
        },
      }],
      error: null,
    })

    await expect(getPortalSessionSnapshot()).resolves.toEqual({
      outcome: 'ok',
      snapshot: {
        tenantSlug: 'freshcut',
        tenantName: 'FreshCut',
        logoUrl: 'https://cdn.corevo.se/freshcut/logo.png',
        verticalLabel: 'Frisörsalong',
        phone: '+46 70 000 00 00',
        address: 'Testgatan 1',
        mapUrl: null,
        bookingOrigin: 'https://freshcut.corevo.se',
        timezone: 'Europe/Stockholm',
        locale: 'sv-SE',
        defaultCountry: 'SE',
        currency: 'SEK',
        cancellationCutoffHours: 24,
        customerName: 'Zivar',
        lastSeenAt: '2026-07-22T12:00:00.000Z',
        absoluteExpiresAt: '2027-07-22T12:00:00.000Z',
      },
    })
    expect(rpc).toHaveBeenCalledWith('customer_portal_session_snapshot', {
      p_session_public_id: firstSession,
      p_secret_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(firstSecret)
    expect(JSON.stringify(rpc.mock.calls)).not.toContain('freshcut')
  })

  it('does not cache or mix two sessions and their tenant snapshots', async () => {
    rpc.mockImplementation(async (_name: string, args: { p_session_public_id: string }) => ({
      data: [{
        outcome: 'ok',
        snapshot: {
          tenantSlug: args.p_session_public_id === firstSession ? 'tenant-one' : 'tenant-two',
          tenantName: args.p_session_public_id === firstSession ? 'Tenant One' : 'Tenant Two',
          logoUrl: null,
          verticalLabel: null,
          phone: null,
          address: null,
          mapUrl: null,
          bookingOrigin: args.p_session_public_id === firstSession
            ? 'https://tenant-one.corevo.se'
            : 'https://tenant-two.corevo.se',
          timezone: 'Europe/Stockholm',
          locale: 'sv-SE',
          defaultCountry: 'SE',
          currency: 'SEK',
          cancellationCutoffHours: 24,
          customerName: 'Kund',
          lastSeenAt: '2026-07-22T12:00:00.000Z',
          absoluteExpiresAt: '2027-07-22T12:00:00.000Z',
        },
      }],
      error: null,
    }))

    const first = await getPortalSessionSnapshot()
    setCookie(secondSession, secondSecret)
    const second = await getPortalSessionSnapshot()

    expect(first).toMatchObject({ outcome: 'ok', snapshot: { tenantSlug: 'tenant-one' } })
    expect(second).toMatchObject({ outcome: 'ok', snapshot: { tenantSlug: 'tenant-two' } })
    expect(rpc.mock.calls.map((call) => call[1].p_session_public_id)).toEqual([
      firstSession,
      secondSession,
    ])
    expect(rpc.mock.calls[0][1].p_secret_digest).not.toBe(rpc.mock.calls[1][1].p_secret_digest)
  })

  it('maps expired, RPC errors and malformed snapshots to neutral outcomes', async () => {
    rpc.mockResolvedValueOnce({ data: [{ outcome: 'expired', snapshot: null }], error: null })
    await expect(getPortalSessionSnapshot()).resolves.toEqual({ outcome: 'expired' })

    rpc.mockResolvedValueOnce({ data: null, error: { message: 'db unavailable' } })
    await expect(getPortalSessionSnapshot()).resolves.toEqual({ outcome: 'unavailable' })

    rpc.mockResolvedValueOnce({ data: [{ outcome: 'ok', snapshot: { tenantSlug: 'bad slug' } }], error: null })
    await expect(getPortalSessionSnapshot()).resolves.toEqual({ outcome: 'unavailable' })

    rpc.mockResolvedValueOnce({
      data: [{
        outcome: 'ok',
        snapshot: {
          tenantSlug: 'freshcut', tenantName: 'FreshCut', customerName: 'Kund',
          logoUrl: 'javascript:alert(1)', verticalLabel: null, phone: null, address: null,
          mapUrl: null, bookingOrigin: 'https://freshcut.corevo.se',
          timezone: 'Europe/Stockholm', locale: 'sv-SE', defaultCountry: 'SE', currency: 'SEK',
          cancellationCutoffHours: 24, lastSeenAt: '2026-07-22T12:00:00.000Z',
          absoluteExpiresAt: '2027-07-22T12:00:00.000Z',
        },
      }],
      error: null,
    })
    await expect(getPortalSessionSnapshot()).resolves.toEqual({ outcome: 'unavailable' })
  })

  it('clamps list page size, forwards a stable cursor and exposes a next cursor', async () => {
    rpc.mockImplementation(async (_name: string, args: { p_page_size: number; p_scope: string }) => ({
      data: {
        outcome: 'ok',
        scope: args.p_scope,
        pageSize: args.p_page_size,
        items: [validBooking],
        hasMore: false,
        nextCursor: null,
      },
      error: null,
    }))

    const first = await listPortalBookings({ scope: 'history', pageSize: 0 })
    expect(first).toMatchObject({
      outcome: 'ok',
      scope: 'history',
      nextCursor: null,
    })
    expect(rpc).toHaveBeenLastCalledWith('customer_portal_list_bookings', {
      p_session_public_id: firstSession,
      p_secret_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_scope: 'history',
      p_cursor_start: null,
      p_cursor_id: null,
      p_page_size: 1,
    })

    await listPortalBookings({
      scope: 'history',
      pageSize: 99,
      cursor: { startTs: validBooking.startTs, id: bookingId },
    })
    expect(rpc).toHaveBeenLastCalledWith('customer_portal_list_bookings', expect.objectContaining({
      p_scope: 'history',
      p_cursor_start: validBooking.startTs,
      p_cursor_id: bookingId,
      p_page_size: 20,
    }))
  })

  it('accepts only the server cursor that exactly matches a full visible page', async () => {
    rpc.mockResolvedValue({
      data: {
        outcome: 'ok', scope: 'upcoming', pageSize: 1, items: [validBooking], hasMore: true,
        nextCursor: { startTs: validBooking.startTs, id: validBooking.id },
      },
      error: null,
    })

    await expect(listPortalBookings({ scope: 'upcoming', pageSize: 1 })).resolves.toMatchObject({
      outcome: 'ok',
      hasMore: true,
      nextCursor: { startTs: validBooking.startTs, id: validBooking.id },
    })
  })

  it('keeps an unknown runtime status but maps it to neutral presentation with no action rights', async () => {
    rpc.mockResolvedValue({
      data: {
        outcome: 'ok',
        scope: 'history',
        pageSize: 20,
        items: [{
          ...validBooking,
          status: 'awaiting_review',
          canCancel: false,
          cancelDeadline: null,
        }],
        hasMore: false,
        nextCursor: null,
      },
      error: null,
    })

    const result = await listPortalBookings({ scope: 'history' })
    expect(result).toMatchObject({
      outcome: 'ok',
      items: [{ status: 'awaiting_review', presentationStatus: 'unknown' }],
    })
    if (result.outcome === 'ok') expect(result.items[0]?.canCancel).toBe(false)
  })

  it('fails closed for invalid scope/cursor and malformed list projections', async () => {
    await expect(listPortalBookings({ scope: 'other' as 'history' })).resolves.toEqual({ outcome: 'unavailable' })
    await expect(listPortalBookings({
      scope: 'history',
      cursor: { startTs: 'not-a-date', id: bookingId },
    })).resolves.toEqual({ outcome: 'unavailable' })
    expect(rpc).not.toHaveBeenCalled()

    rpc.mockResolvedValue({ data: { outcome: 'ok', scope: 'history', pageSize: 20, items: [{ id: 'bad' }], hasMore: false, nextCursor: null }, error: null })
    await expect(listPortalBookings({ scope: 'history' })).resolves.toEqual({ outcome: 'unavailable' })

    rpc.mockResolvedValue({
      data: {
        outcome: 'ok',
        scope: 'history',
        pageSize: 20,
        items: [{ ...validBooking, startTs: '2026-02-30T10:00:00.000Z' }],
        hasMore: false,
        nextCursor: null,
      },
      error: null,
    })
    await expect(listPortalBookings({ scope: 'history' })).resolves.toEqual({ outcome: 'unavailable' })
  })

  it('rejects inconsistent server pagination and adversarial URLs', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        outcome: 'ok', scope: 'history', pageSize: 20, items: [validBooking],
        hasMore: true, nextCursor: null,
      },
      error: null,
    })
    await expect(listPortalBookings({ scope: 'history' })).resolves.toEqual({ outcome: 'unavailable' })

    rpc.mockResolvedValueOnce({
      data: {
        outcome: 'ok', scope: 'history', pageSize: 20, items: [validBooking], hasMore: false,
        nextCursor: { startTs: validBooking.startTs, id: validBooking.id },
      },
      error: null,
    })
    await expect(listPortalBookings({ scope: 'history' })).resolves.toEqual({ outcome: 'unavailable' })

    rpc.mockResolvedValueOnce({
      data: {
        outcome: 'ok', scope: 'history', pageSize: 20,
        items: [{ ...validBooking, publicRebookUrl: 'javascript:alert(1)' }],
        hasMore: false, nextCursor: null,
      },
      error: null,
    })
    await expect(listPortalBookings({ scope: 'history' })).resolves.toEqual({ outcome: 'unavailable' })

    rpc.mockResolvedValueOnce({
      data: {
        outcome: 'ok', scope: 'history', pageSize: 20,
        items: [{
          ...validBooking,
          location: { ...validBooking.location, mapUrl: 'data:text/html,attack' },
        }],
        hasMore: false, nextCursor: null,
      },
      error: null,
    })
    await expect(listPortalBookings({ scope: 'history' })).resolves.toEqual({ outcome: 'unavailable' })
  })

  it('returns an owned detail and keeps invalid/foreign ids observably neutral', async () => {
    rpc.mockResolvedValueOnce({ data: { outcome: 'ok', booking: validBooking }, error: null })
    await expect(getPortalBooking(bookingId)).resolves.toMatchObject({
      outcome: 'ok',
      booking: { id: bookingId, presentationStatus: 'confirmed' },
    })
    expect(rpc).toHaveBeenLastCalledWith('customer_portal_get_booking', {
      p_session_public_id: firstSession,
      p_secret_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      p_booking_public_id: bookingId,
    })

    rpc.mockResolvedValueOnce({ data: { outcome: 'not_found' }, error: null })
    await expect(getPortalBooking(secondBookingId)).resolves.toEqual({ outcome: 'not_found' })

    rpc.mockClear()
    await expect(getPortalBooking('not-a-uuid')).resolves.toEqual({ outcome: 'not_found' })
    expect(rpc).not.toHaveBeenCalled()

    rpc.mockResolvedValueOnce({
      data: { outcome: 'ok', booking: { ...validBooking, id: secondBookingId } },
      error: null,
    })

    await expect(getPortalBooking(bookingId)).resolves.toEqual({ outcome: 'not_found' })
  })

  it('uses only the three portal RPCs and contains no direct table query or shared cache', async () => {
    const source = readFileSync(new URL('./data.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/\.from\s*\(/)
    expect(source).not.toMatch(/\b(?:cache|unstable_cache)\s*\(/)
    expect(source.match(/'customer_portal_[a-z_]+'/g)?.sort()).toEqual([
      "'customer_portal_get_booking'",
      "'customer_portal_list_bookings'",
      "'customer_portal_session_snapshot'",
    ])
  })
})
