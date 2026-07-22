import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortalBookingProjection, PortalSessionSnapshot } from '@/lib/customer-portal/types'

const mocks = vi.hoisted(() => ({
  getPortalSessionSnapshot: vi.fn(),
  listPortalBookings: vi.fn(),
  getPortalBooking: vi.fn(),
}))

vi.mock('@/lib/customer-portal/data', () => mocks)

import HomePage, {
  dynamic as homeDynamic,
  fetchCache as homeFetchCache,
  revalidate as homeRevalidate,
} from './page'
import HistoryPage, {
  dynamic as historyDynamic,
  fetchCache as historyFetchCache,
  revalidate as historyRevalidate,
} from './historik/page'
import DetailPage, {
  dynamic as detailDynamic,
  fetchCache as detailFetchCache,
  revalidate as detailRevalidate,
} from './bokningar/[id]/page'

const snapshot: PortalSessionSnapshot = {
  tenantSlug: 'freshcut', tenantName: 'FreshCut', logoUrl: null,
  verticalLabel: 'Frisörsalong', phone: '+4613123456', address: 'Testgatan 1', mapUrl: null,
  bookingOrigin: 'https://freshcut.corevo.se', timezone: 'Europe/Stockholm', locale: 'sv-SE',
  defaultCountry: 'SE', currency: 'SEK', cancellationCutoffHours: 24, customerName: 'Alex',
  lastSeenAt: '2026-07-22T12:00:00.000Z', absoluteExpiresAt: '2027-07-22T12:00:00.000Z',
}

const bookingId = '323e4567-e89b-42d3-a456-426614174000'
const booking = (overrides: Partial<PortalBookingProjection> = {}): PortalBookingProjection => ({
  id: bookingId, startTs: '2026-08-23T12:30:00.000Z', endTs: '2026-08-23T13:00:00.000Z',
  status: 'confirmed', presentationStatus: 'confirmed', serviceName: 'Service från RPC',
  durationMinutes: 30, staffTitle: 'Sam', location: null, priceCents: 32900, currency: 'SEK',
  canCancel: true, cancelDeadline: '2026-08-22T12:30:00.000Z',
  publicRebookUrl: 'https://freshcut.corevo.se/boka', ...overrides,
})

const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getPortalSessionSnapshot.mockResolvedValue({ outcome: 'ok', snapshot })
})

describe('personal portal route cache contract', () => {
  it('forces every personal route to render dynamically without fetch caching', () => {
    expect([homeDynamic, historyDynamic, detailDynamic]).toEqual([
      'force-dynamic', 'force-dynamic', 'force-dynamic',
    ])
    expect([homeRevalidate, historyRevalidate, detailRevalidate]).toEqual([0, 0, 0])
    expect([homeFetchCache, historyFetchCache, detailFetchCache]).toEqual([
      'force-no-store', 'force-no-store', 'force-no-store',
    ])
  })
})

describe('/mina', () => {
  it('renders snapshot tenant identity and upcoming projections through one shell', async () => {
    mocks.listPortalBookings.mockResolvedValue({
      outcome: 'ok', scope: 'upcoming', pageSize: 20, items: [booking()],
      hasMore: false, nextCursor: null,
    })
    const html = renderToStaticMarkup(await HomePage())
    expect(mocks.listPortalBookings).toHaveBeenCalledWith({ scope: 'upcoming', pageSize: 20 })
    expect(html.match(/<main id="huvudinnehall"/g)).toHaveLength(1)
    expect(html).toContain('FreshCut')
    expect(html).toContain('Service från RPC')
    expect(visibleText(html)).not.toContain(bookingId)
    expect(html).not.toMatch(/Logga in|\/konto/)
  })

  it('uses history only to choose the honest empty copy and never invents a URL', async () => {
    mocks.listPortalBookings
      .mockResolvedValueOnce({ outcome: 'ok', scope: 'upcoming', pageSize: 20, items: [], hasMore: false, nextCursor: null })
      .mockResolvedValueOnce({ outcome: 'ok', scope: 'history', pageSize: 1, items: [], hasMore: false, nextCursor: null })
    const html = renderToStaticMarkup(await HomePage())
    expect(mocks.listPortalBookings).toHaveBeenNthCalledWith(2, { scope: 'history', pageSize: 1 })
    expect(html).toContain('Du har inga bokningar hos FreshCut ännu.')
    expect(html).not.toContain('href="undefined"')
  })

  it.each(['expired', 'not_found', 'unavailable'] as const)(
    'renders a neutral canonical surface when the snapshot is %s',
    async (outcome) => {
      mocks.getPortalSessionSnapshot.mockResolvedValue({ outcome })
      const html = renderToStaticMarkup(await HomePage())
      expect(html).toContain('Något gick fel hos oss.')
      expect(html).not.toMatch(/Logga in|\/konto|tenantId|customerId/)
      expect(mocks.listPortalBookings).not.toHaveBeenCalled()
    },
  )

  it('renders list failures as the canonical booking fetch surface', async () => {
    mocks.listPortalBookings.mockResolvedValue({ outcome: 'unavailable' })
    const html = renderToStaticMarkup(await HomePage())
    expect(html).toContain('Bokningarna kunde inte hämtas. Din bokning är oförändrad.')
    expect(html.match(/<h1/g)).toHaveLength(1)
  })
})

describe('/mina/historik', () => {
  it('renders the canonical grouped history and exposes pagination only from hasMore', async () => {
    mocks.listPortalBookings.mockResolvedValue({
      outcome: 'ok', scope: 'history', pageSize: 20,
      items: [booking({ presentationStatus: 'unknown', status: 'new_internal_state' })],
      hasMore: true, nextCursor: { startTs: '2026-08-23T12:30:00.000Z', id: bookingId },
    })
    const html = renderToStaticMarkup(await HistoryPage())
    expect(mocks.listPortalBookings).toHaveBeenCalledWith({ scope: 'history', pageSize: 20 })
    expect(html).toContain('Övriga bokningar')
    expect(html).toContain('Status uppdateras')
    expect(html).toContain('Visa fler')
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(visibleText(html)).not.toContain('new_internal_state')
  })

  it('never presents a failed history fetch as an empty state', async () => {
    mocks.listPortalBookings.mockResolvedValue({ outcome: 'expired' })
    const html = renderToStaticMarkup(await HistoryPage())
    expect(html).toContain('Historiken kunde inte hämtas.')
    expect(html).toContain('<h1>Historik</h1>')
    expect(html).not.toContain('Du har inga tidigare bokningar')
    expect(html.match(/<h1/g)).toHaveLength(1)
  })
})

describe('/mina/bokningar/[id]', () => {
  it('passes only the route id to the narrow DAL and renders the owned booking', async () => {
    mocks.getPortalBooking.mockResolvedValue({ outcome: 'ok', booking: booking() })
    const html = renderToStaticMarkup(await DetailPage({ params: Promise.resolve({ id: bookingId }) }))
    expect(mocks.getPortalBooking).toHaveBeenCalledWith(bookingId)
    expect(mocks.getPortalBooking).toHaveBeenCalledTimes(1)
    expect(html).toContain('Service från RPC')
    expect(visibleText(html)).not.toContain(bookingId)
  })

  it.each(['not_found', 'expired', 'unavailable'] as const)(
    'uses a neutral non-reflective detail surface for %s',
    async (outcome) => {
      mocks.getPortalBooking.mockResolvedValue({ outcome })
      const html = renderToStaticMarkup(await DetailPage({
        params: Promise.resolve({ id: '423e4567-e89b-42d3-a456-426614174000' }),
      }))
      expect(html).toContain(outcome === 'not_found'
        ? 'Bokningen kunde inte visas'
        : 'Bokningen kunde inte hämtas. Din bokning är oförändrad.')
      expect(visibleText(html)).not.toContain('423e4567-e89b-42d3-a456-426614174000')
      expect(html).not.toMatch(/Logga in|\/konto/)
    },
  )
})
