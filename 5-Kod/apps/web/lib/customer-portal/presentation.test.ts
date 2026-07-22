import { describe, expect, it } from 'vitest'
import type { PortalBookingProjection, PortalSessionSnapshot } from './types'
import {
  formatPortalBooking,
  groupPortalHistory,
  portalStatusPresentation,
} from './presentation'

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
  startTs: '2026-07-23T12:30:00.000Z',
  endTs: '2026-07-23T13:15:00.000Z',
  status: 'confirmed',
  presentationStatus: 'confirmed',
  serviceName: 'Felsökning av motor och elektriskt system',
  durationMinutes: 45,
  staffTitle: null,
  location: null,
  priceCents: 12550,
  currency: 'USD',
  canCancel: false,
  cancelDeadline: '2026-07-22T12:30:00.000Z',
  publicRebookUrl: null,
  ...overrides,
})

describe('customer portal presentation', () => {
  it('formats dates in the snapshot locale/timezone and money in the booking currency', () => {
    const formatted = formatPortalBooking(booking(), snapshot)

    expect(formatted.homeDateTime).toBe('torsdag 23 juli · 14:30')
    expect(formatted.detailDateTime).toBe('torsdag 23 juli 2026 · 14:30–15:15')
    expect(formatted.historyDate).toBe('23 juli 2026')
    expect(formatted.price).toMatch(/125[,.]50\s+US\$/)
  })

  it('uses only presentationStatus and maps unknown status to the neutral contract', () => {
    expect(portalStatusPresentation(booking({
      status: 'internal_future_state',
      presentationStatus: 'unknown',
    }))).toEqual({ label: 'Status uppdateras', tone: 'warning', icon: 'unknown' })
  })

  it('groups history in the canonical order and puts every unknown outcome in other', () => {
    const completed = booking({ id: '1', presentationStatus: 'completed' })
    const cancelled = booking({ id: '2', presentationStatus: 'cancelled' })
    const unknown = booking({ id: '3', presentationStatus: 'unknown' })

    expect(groupPortalHistory([unknown, cancelled, completed])).toEqual([
      { title: 'Tidigare besök', items: [completed] },
      { title: 'Avbokade bokningar', items: [cancelled] },
      { title: 'Övriga bokningar', items: [unknown] },
    ])
  })
})
