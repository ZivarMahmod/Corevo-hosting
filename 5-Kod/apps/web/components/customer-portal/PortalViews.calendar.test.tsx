import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PortalBookingProjection, PortalSessionSnapshot } from '@/lib/customer-portal/types'
import { BookingDetail, NextBookingCard } from './PortalViews'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./CalendarDownloadButton', () => ({
  CalendarBookingProvider: ({
    bookingPublicId,
    children,
  }: {
    bookingPublicId: string
    children: ReactNode
  }) => <span data-calendar-booking-provider={bookingPublicId}>{children}</span>,
  CalendarDownloadButton: () => <button type="button">Lägg i kalender</button>,
}))

const snapshot: PortalSessionSnapshot = {
  tenantSlug: 'freshcut', tenantName: 'FreshCut', logoUrl: null, verticalLabel: null,
  phone: null, address: null, mapUrl: null, bookingOrigin: 'https://freshcut.boka.corevo.se',
  timezone: 'Europe/Stockholm', locale: 'sv-SE', defaultCountry: 'SE', currency: 'SEK',
  cancellationCutoffHours: 24, customerName: 'Alex', lastSeenAt: '2026-07-22T10:00:00.000Z',
  absoluteExpiresAt: '2027-07-22T10:00:00.000Z',
}
const base: PortalBookingProjection = {
  id: '123e4567-e89b-42d3-a456-426614174000', startTs: '2099-08-01T10:00:00.000Z',
  endTs: '2099-08-01T10:30:00.000Z', status: 'confirmed', presentationStatus: 'confirmed',
  serviceName: 'Klippning', durationMinutes: 30, staffTitle: null, location: null,
  priceCents: null, currency: 'SEK', canCancel: true,
  cancelDeadline: '2099-07-31T10:00:00.000Z', publicRebookUrl: null,
}

const calendarLabels = (html: string) => html.match(/Lägg i kalender/g) ?? []

describe('calendar action placement', () => {
  it.each(['pending', 'confirmed'] as const)(
    'renders one calendar action on the future %s hero, never on more-upcoming rows',
    (status) => {
      const first = { ...base, status, presentationStatus: status }
      const second = { ...first, id: '223e4567-e89b-42d3-a456-426614174000' }
      const html = renderToStaticMarkup(
        <NextBookingCard snapshot={snapshot} items={[first, second]} hasHistory={false} />,
      )

      expect(calendarLabels(html)).toHaveLength(1)
      expect(html).toContain(
        `<span data-calendar-booking-provider="${first.id}"><button type="button">` +
        'Lägg i kalender</button></span>',
      )
      expect(html.match(/data-calendar-booking-provider/g)).toHaveLength(1)
      expect(html).not.toContain(`data-calendar-booking-provider="${second.id}"`)
    },
  )

  it.each([
    ['past confirmed', { startTs: '2000-01-01T10:00:00.000Z', endTs: '2000-01-01T10:30:00.000Z' }],
    ['cancelled', { status: 'cancelled', presentationStatus: 'cancelled', canCancel: false, cancelDeadline: null }],
    ['completed', { status: 'completed', presentationStatus: 'completed', canCancel: false, cancelDeadline: null }],
    ['no-show', { status: 'no_show', presentationStatus: 'no_show', canCancel: false, cancelDeadline: null }],
    ['unknown', { status: 'future_state', presentationStatus: 'unknown', canCancel: false, cancelDeadline: null }],
  ] as const)('does not render calendar on the %s hero', (_name, overrides) => {
    const html = renderToStaticMarkup(
      <NextBookingCard snapshot={snapshot} items={[{ ...base, ...overrides }]} hasHistory />,
    )
    expect(calendarLabels(html)).toHaveLength(0)
    expect(html).not.toContain('data-calendar-booking-provider')
  })

  it.each(['pending', 'confirmed'] as const)('renders calendar on a future active %s detail', (status) => {
    const html = renderToStaticMarkup(
      <BookingDetail snapshot={snapshot} booking={{ ...base, status, presentationStatus: status }} />,
    )
    expect(calendarLabels(html)).toHaveLength(1)
    expect(html).toContain(
      `<span data-calendar-booking-provider="${base.id}"><button type="button">` +
      'Lägg i kalender</button></span>',
    )
  })

  it.each([
    ['past', { startTs: '2000-01-01T10:00:00.000Z', endTs: '2000-01-01T10:30:00.000Z' }],
    ['history', { status: 'completed', presentationStatus: 'completed', canCancel: false, cancelDeadline: null }],
    ['unknown', { status: 'future_state', presentationStatus: 'unknown', canCancel: false, cancelDeadline: null }],
  ] as const)('does not render calendar on %s detail', (_name, overrides) => {
    const html = renderToStaticMarkup(<BookingDetail snapshot={snapshot} booking={{ ...base, ...overrides }} />)
    expect(calendarLabels(html)).toHaveLength(0)
    expect(html).not.toContain('data-calendar-booking-provider')
  })
})
