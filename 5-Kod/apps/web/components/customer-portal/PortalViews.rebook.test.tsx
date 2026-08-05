import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { PortalBookingProjection, PortalSessionSnapshot } from '@/lib/customer-portal/types'
import { BookingDetail, NextBookingCard } from './PortalViews'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

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
  cancelDeadline: '2099-07-31T10:00:00.000Z',
  publicRebookUrl: 'https://freshcut.boka.corevo.se/boka?plats=223e4567-e89b-42d3-a456-426614174000&tjanst=323e4567-e89b-42d3-a456-426614174000',
}

const countCopy = (html: string, copy: string) => html.split(copy).length - 1
const escapedHref = (href: string) => href.replaceAll('&', '&amp;')

describe('portal rebook placement and status matrix', () => {
  it('places one future CTA under the complete hero/upcoming list, never in another row', () => {
    const html = renderToStaticMarkup(
      <NextBookingCard
        snapshot={snapshot}
        items={[base, { ...base, id: '223e4567-e89b-42d3-a456-426614174000' }]}
        hasHistory={false}
      />,
    )
    expect(countCopy(html, 'Boka en tid till')).toBe(1)
    expect(html.indexOf('Fler kommande')).toBeLessThan(html.indexOf('Boka en tid till'))
    expect(html).toContain(`href="${escapedHref(base.publicRebookUrl!)}"`)
    expect(html).not.toContain('target="_blank"')
  })

  it.each([false, true])('always shows Boka ny tid in the empty state (hasHistory=%s)', (hasHistory) => {
    const html = renderToStaticMarkup(
      <NextBookingCard snapshot={snapshot} items={[]} hasHistory={hasHistory} />,
    )
    expect(countCopy(html, 'Boka ny tid')).toBe(1)
    expect(html).toContain('href="https://freshcut.boka.corevo.se/boka"')
  })

  it.each([
    ['future pending', { status: 'pending', presentationStatus: 'pending' }, 'Boka en tid till'],
    ['future confirmed', {}, 'Boka en tid till'],
    ['completed', { status: 'completed', presentationStatus: 'completed', canCancel: false, cancelDeadline: null }, 'Boka igen'],
    ['cancelled', { status: 'cancelled', presentationStatus: 'cancelled', canCancel: false, cancelDeadline: null }, 'Boka igen'],
  ] as const)('shows the exact detail CTA for %s', (_name, overrides, label) => {
    const html = renderToStaticMarkup(
      <BookingDetail snapshot={snapshot} booking={{ ...base, ...overrides }} />,
    )
    expect(countCopy(html, label)).toBe(1)
    expect(html.indexOf(label)).toBeGreaterThan(html.indexOf('cp-actions'))
  })

  it.each([
    ['no show', { status: 'no_show', presentationStatus: 'no_show', canCancel: false, cancelDeadline: null }],
    ['past pending', { status: 'pending', presentationStatus: 'pending', startTs: '2000-01-01T10:00:00.000Z', endTs: '2000-01-01T10:30:00.000Z' }],
    ['unknown', { status: 'other', presentationStatus: 'unknown', canCancel: false, cancelDeadline: null }],
    ['unsafe URL', { status: 'completed', presentationStatus: 'completed', canCancel: false, cancelDeadline: null, publicRebookUrl: 'https://evil.example/boka' }],
    ['missing URL', { status: 'completed', presentationStatus: 'completed', canCancel: false, cancelDeadline: null, publicRebookUrl: null }],
  ] as const)('shows no rebook CTA for %s', (_name, overrides) => {
    const html = renderToStaticMarkup(
      <BookingDetail snapshot={snapshot} booking={{ ...base, ...overrides }} />,
    )
    expect(html).not.toMatch(/Boka igen|Boka en tid till|evil\.example/)
  })

  it('uses the tenant base URL for an active detail even when its old preselect is missing', () => {
    const html = renderToStaticMarkup(
      <BookingDetail snapshot={snapshot} booking={{ ...base, publicRebookUrl: null }} />,
    )
    expect(html).toContain('Boka en tid till')
    expect(html).toContain('href="https://freshcut.boka.corevo.se/boka"')
  })

  it('preserves validated service/location context for an active detail', () => {
    const html = renderToStaticMarkup(<BookingDetail snapshot={snapshot} booking={base} />)
    expect(html).toContain(`href="${escapedHref(base.publicRebookUrl!)}"`)
  })
})
