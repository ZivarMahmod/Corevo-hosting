import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PortalBookingProjection, PortalSessionSnapshot } from '@/lib/customer-portal/types'
import { BookAgainButton, BookAgainProvider } from './BookAgainButton'

const snapshot: PortalSessionSnapshot = {
  tenantSlug: 'freshcut', tenantName: 'FreshCut', logoUrl: null, verticalLabel: null,
  phone: null, address: null, mapUrl: null, bookingOrigin: 'https://freshcut.boka.corevo.se',
  timezone: 'Europe/Stockholm', locale: 'sv-SE', defaultCountry: 'SE', currency: 'SEK',
  cancellationCutoffHours: 24, customerName: 'Alex', lastSeenAt: '2026-07-22T10:00:00.000Z',
  absoluteExpiresAt: '2027-07-22T10:00:00.000Z',
}

const booking: PortalBookingProjection = {
  id: '123e4567-e89b-42d3-a456-426614174000', startTs: '2099-08-01T10:00:00.000Z',
  endTs: '2099-08-01T10:30:00.000Z', status: 'confirmed', presentationStatus: 'confirmed',
  serviceName: 'Klippning', durationMinutes: 30, staffTitle: null, location: null,
  priceCents: null, currency: 'SEK', canCancel: true,
  cancelDeadline: '2099-07-31T10:00:00.000Z',
  publicRebookUrl: 'https://freshcut.boka.corevo.se/boka?tjanst=223e4567-e89b-42d3-a456-426614174000',
}

describe('BookAgainButton', () => {
  it('uses only the provider-bound target and navigates in the same tab', () => {
    const html = renderToStaticMarkup(
      <BookAgainProvider snapshot={snapshot} booking={booking}>
        <BookAgainButton label="Boka igen" />
      </BookAgainProvider>,
    )

    expect(html).toContain(`href="${booking.publicRebookUrl}"`)
    expect(html).toContain('rel="noopener"')
    expect(html).not.toContain('target=')
  })

  it('builds the new-customer target without booking history', () => {
    const html = renderToStaticMarkup(
      <BookAgainProvider snapshot={snapshot}>
        <BookAgainButton label="Boka ny tid" variant="primary" />
      </BookAgainProvider>,
    )
    expect(html).toContain('href="https://freshcut.boka.corevo.se/boka"')
    expect(html).toContain('cp-btn-primary')
  })

  it.each([
    { ...snapshot, bookingOrigin: 'https://portal.corevo.se' },
    { ...snapshot, bookingOrigin: 'https://other.boka.corevo.se' },
  ])('renders nothing for an unsafe or cross-tenant origin', (unsafeSnapshot) => {
    expect(renderToStaticMarkup(
      <BookAgainProvider snapshot={unsafeSnapshot}>
        <BookAgainButton label="Boka ny tid" />
      </BookAgainProvider>,
    )).toBe('')
  })

  it('renders nothing when a booking lacks a safe server-projected target', () => {
    expect(renderToStaticMarkup(
      <BookAgainProvider snapshot={snapshot} booking={{ ...booking, publicRebookUrl: null }}>
        <BookAgainButton label="Boka igen" />
      </BookAgainProvider>,
    )).toBe('')
  })

  it('keeps the public button API closed to free href/url values', () => {
    // @ts-expect-error BookAgainButton never accepts a caller-controlled href.
    void <BookAgainButton label="Boka igen" href="https://evil.example" />
    // @ts-expect-error BookAgainButton never accepts a caller-controlled URL.
    void <BookAgainButton label="Boka igen" url="https://evil.example" />
    // @ts-expect-error Labels are the three exact canonical copies only.
    void <BookAgainButton label="Boka" />
    expect(true).toBe(true)
  })
})
