import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortalBookingProjection, PortalSessionSnapshot } from '@/lib/customer-portal/types'

const mocks = vi.hoisted(() => ({
  getPortalBooking: vi.fn(),
  getPortalSessionSnapshot: vi.fn(),
}))
vi.mock('@/lib/customer-portal/data', () => mocks)

import { dynamic, fetchCache, GET, revalidate } from './route'

const originalKey = process.env.CUSTOMER_PORTAL_HMAC_KEY
const bookingId = '123e4567-e89b-42d3-a456-426614174000'

const snapshot: PortalSessionSnapshot = {
  tenantSlug: 'freshcut', tenantName: 'FreshCut', logoUrl: null, verticalLabel: null,
  phone: null, address: 'Tenantvägen 9', mapUrl: null,
  bookingOrigin: 'https://freshcut.corevo.se', timezone: 'Europe/Stockholm', locale: 'sv-SE',
  defaultCountry: 'SE', currency: 'SEK', cancellationCutoffHours: 24, customerName: 'Hemlig Kund',
  lastSeenAt: '2026-07-22T10:00:00.000Z', absoluteExpiresAt: '2027-07-22T10:00:00.000Z',
}

const booking: PortalBookingProjection = {
  id: bookingId, startTs: '2026-08-01T10:00:00.000Z', endTs: '2026-08-01T10:30:00.000Z',
  status: 'confirmed', presentationStatus: 'confirmed', serviceName: 'Klippning', durationMinutes: 30,
  staffTitle: 'Hemlig Personal',
  location: { name: 'Studio Ett', address: 'Bokningsgatan 1', phone: null, mapUrl: null, timezone: 'Europe/Stockholm' },
  priceCents: 32900, currency: 'SEK', canCancel: true,
  cancelDeadline: '2026-07-31T10:00:00.000Z', publicRebookUrl: null,
}

const request = (url = `https://mina.corevo.se/api/customer-portal/bookings/${bookingId}/calendar`) =>
  new Request(url)
const context = (id = bookingId) => ({ params: Promise.resolve({ id }) })

afterAll(() => {
  if (originalKey === undefined) delete process.env.CUSTOMER_PORTAL_HMAC_KEY
  else process.env.CUSTOMER_PORTAL_HMAC_KEY = originalKey
})

describe('GET /api/customer-portal/bookings/[id]/calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
    mocks.getPortalSessionSnapshot.mockResolvedValue({ outcome: 'ok', snapshot })
    mocks.getPortalBooking.mockResolvedValue({ outcome: 'ok', booking })
  })

  it('is always dynamic and returns an owned booking as a fixed-name no-store attachment', async () => {
    expect({ dynamic, revalidate, fetchCache }).toEqual({
      dynamic: 'force-dynamic', revalidate: 0, fetchCache: 'force-no-store',
    })

    const response = await GET(request(), context())
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="corevo-bokning.ics"')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(body).toContain('BEGIN:VCALENDAR\r\n')
    expect(body).toContain('SUMMARY:Klippning\r\n')
    expect(body).not.toContain(bookingId)
    expect(body).not.toContain('Hemlig Kund')
    expect(body).not.toContain('Hemlig Personal')
    expect(mocks.getPortalSessionSnapshot).toHaveBeenCalledOnce()
    expect(mocks.getPortalBooking).toHaveBeenCalledWith(bookingId)
    expect(mocks.getPortalBooking).toHaveBeenCalledOnce()
  })

  it('rejects malformed UUIDs and query data before any session or booking read', async () => {
    const malformed = await GET(
      request('https://mina.corevo.se/api/customer-portal/bookings/not-a-uuid/calendar'),
      context('not-a-uuid'),
    )
    const queried = await GET(request(`${request().url}?token=secret`), context())

    expect(malformed.status).toBe(404)
    expect(await malformed.text()).toBe('Kalenderfilen kunde inte skapas.')
    expect(queried.status).toBe(404)
    expect(await queried.text()).toBe('Kalenderfilen kunde inte skapas.')
    expect(mocks.getPortalSessionSnapshot).not.toHaveBeenCalled()
    expect(mocks.getPortalBooking).not.toHaveBeenCalled()
  })

  it.each([
    ['snapshot expired', { outcome: 'expired', recoveryTenantSlug: 'freshcut' }, { outcome: 'ok', booking }],
    ['snapshot unavailable', { outcome: 'unavailable' }, { outcome: 'ok', booking }],
    ['booking not found', { outcome: 'ok', snapshot }, { outcome: 'not_found' }],
    ['booking unavailable', { outcome: 'ok', snapshot }, { outcome: 'unavailable' }],
  ])('returns one indistinguishable no-leak response for %s', async (_name, snapshotResult, bookingResult) => {
    mocks.getPortalSessionSnapshot.mockResolvedValue(snapshotResult)
    mocks.getPortalBooking.mockResolvedValue(bookingResult)

    const response = await GET(request(), context())

    expect(response.status).toBe(404)
    expect(await response.text()).toBe('Kalenderfilen kunde inte skapas.')
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('content-disposition')).toBeNull()
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })
})
