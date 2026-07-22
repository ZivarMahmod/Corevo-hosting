import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { PortalBookingProjection, PortalSessionSnapshot } from '@/lib/customer-portal/types'
import { PortalShell } from './PortalShell'
import {
  BookingDetail,
  NextBookingCard,
  PortalErrorState,
  TenantIdentityCard,
} from './PortalViews'
import { BookingHistoryListClient } from './BookingHistoryListClient'

const snapshot: PortalSessionSnapshot = {
  tenantSlug: 'nordverk',
  tenantName: 'Nordverk Bilservice',
  logoUrl: null,
  verticalLabel: 'Bilverkstad',
  phone: null,
  address: null,
  mapUrl: null,
  bookingOrigin: 'https://nordverk.corevo.se',
  timezone: 'Europe/Stockholm',
  locale: 'sv-SE',
  defaultCountry: 'SE',
  currency: 'SEK',
  cancellationCutoffHours: 24,
  customerName: 'Alex',
  lastSeenAt: '2026-07-22T12:00:00.000Z',
  absoluteExpiresAt: '2027-07-22T12:00:00.000Z',
}

const booking = (overrides: Partial<PortalBookingProjection> = {}): PortalBookingProjection => ({
  id: '323e4567-e89b-42d3-a456-426614174000',
  startTs: '2026-08-23T12:30:00.000Z',
  endTs: '2026-08-23T13:15:00.000Z',
  status: 'confirmed',
  presentationStatus: 'confirmed',
  serviceName: 'Felsökning av motor och elektriskt system',
  durationMinutes: 45,
  staffTitle: null,
  location: null,
  priceCents: null,
  currency: 'SEK',
  canCancel: true,
  cancelDeadline: '2026-08-22T12:30:00.000Z',
  publicRebookUrl: null,
  ...overrides,
})

const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

describe('CustomerPortalShell', () => {
  it('renders the canonical landmarks once and exactly three links in each responsive nav', () => {
    const html = renderToStaticMarkup(
      <PortalShell active="bookings" customerName="Alex">
        <h1>Nordverk Bilservice</h1>
      </PortalShell>,
    )

    expect(html.indexOf('Hoppa till innehåll')).toBeLessThan(html.indexOf('<header'))
    expect(html.match(/<header/g)).toHaveLength(1)
    expect(html.match(/<main id="huvudinnehall"/g)).toHaveLength(1)
    expect(html.match(/<nav[^>]+aria-label="Huvudmeny"/g)).toHaveLength(2)
    for (const nav of html.match(/<nav[^>]+aria-label="Huvudmeny"[\s\S]*?<\/nav>/g) ?? []) {
      expect(nav.match(/<li>/g)).toHaveLength(3)
      expect(nav.indexOf('Bokningar')).toBeLessThan(nav.indexOf('Historik'))
      expect(nav.indexOf('Historik')).toBeLessThan(nav.indexOf('Profil'))
    }
    expect(html).toContain('aria-current="page"')
  })
})

describe('customer portal views', () => {
  it('renders tenant identity and only real optional contact fields', () => {
    const html = renderToStaticMarkup(<TenantIdentityCard snapshot={snapshot} />)
    expect(html).toContain('<h1')
    expect(html).toContain('Nordverk Bilservice')
    expect(html).toContain('Du bokade via nordverk.corevo.se')
    expect(html).not.toContain('>Ring<')
    expect(html).not.toContain('>Hitta hit<')
  })

  it('renders the next booking, adds Fler kommande only for two, and keeps unknown status neutral', () => {
    const unknown = booking({
      id: '423e4567-e89b-42d3-a456-426614174000',
      status: 'awaiting_internal_review',
      presentationStatus: 'unknown',
    })
    const one = renderToStaticMarkup(
      <NextBookingCard snapshot={snapshot} items={[booking()]} hasHistory />,
    )
    const two = renderToStaticMarkup(
      <NextBookingCard snapshot={snapshot} items={[booking(), unknown]} hasHistory />,
    )

    expect(one).toContain('NÄSTA BOKNING')
    expect(one).toContain('Visa bokningen')
    expect(one).not.toContain('Fler kommande')
    expect(two).toContain('Fler kommande')
    expect(two).toContain('Status uppdateras')
    expect(visibleText(two)).not.toContain('awaiting_internal_review')
    expect(two).not.toMatch(/Lägg i kalender|Avboka/)
  })

  it('uses the canonical honest empty state without an invented next step', () => {
    const html = renderToStaticMarkup(
      <NextBookingCard snapshot={snapshot} items={[]} hasHistory={false} />,
    )
    expect(html).toContain('Ingen kommande bokning')
    expect(html).toContain('Du har inga bokningar hos Nordverk Bilservice ännu.')
    expect(html).not.toContain('href="undefined"')
  })

  it('renders history sections in exact order, unknown in Övriga and Visa fler only when hasMore', () => {
    const completed = booking({ id: '1', presentationStatus: 'completed' })
    const cancelled = booking({ id: '2', presentationStatus: 'cancelled' })
    const unknown = booking({ id: '3', presentationStatus: 'unknown' })
    const html = renderToStaticMarkup(
      <BookingHistoryListClient
        snapshot={snapshot}
        initialItems={[unknown, cancelled, completed]}
        initialCursor={{ startTs: unknown.startTs, id: unknown.id }}
        loadMore={async () => ({ outcome: 'unavailable' })}
      />,
    )
    const noMore = renderToStaticMarkup(
      <BookingHistoryListClient snapshot={snapshot} initialItems={[completed]} initialCursor={null} loadMore={async () => ({ outcome: 'unavailable' })} />,
    )

    expect(html.indexOf('Tidigare besök')).toBeLessThan(html.indexOf('Avbokade bokningar'))
    expect(html.indexOf('Avbokade bokningar')).toBeLessThan(html.indexOf('Övriga bokningar'))
    expect(html.indexOf('Status uppdateras')).toBeGreaterThan(html.indexOf('Övriga bokningar'))
    expect(html).toContain('<button class="cp-btn cp-history-more" type="button">Visa fler</button>')
    expect(noMore).not.toContain('Visa fler')
  })

  it('renders an owned detail and hides missing staff, location, price and rebook action', () => {
    const item = booking({ status: 'internal_only_value', presentationStatus: 'unknown' })
    const html = renderToStaticMarkup(<BookingDetail snapshot={snapshot} booking={item} />)
    const text = visibleText(html)

    expect(html).toContain('Status uppdateras')
    expect(html).toContain('Felsökning av motor och elektriskt system')
    expect(html).not.toMatch(/>Personal<|>Plats<|>Pris<|Boka en tid till|Boka igen/)
    expect(text).not.toContain(item.id)
    expect(text).not.toContain(item.status)
    expect(html).not.toMatch(/Lägg i kalender|Avboka bokningen/)
  })

  it('uses the same neutral not-found surface without reflecting the route id', () => {
    const html = renderToStaticMarkup(<PortalErrorState variant="not-found" />)
    expect(html).toContain('Bokningen kunde inte visas')
    expect(html).toContain('href="/mina"')
    expect(html).not.toMatch(/Logga in|\/konto/)
  })
})
