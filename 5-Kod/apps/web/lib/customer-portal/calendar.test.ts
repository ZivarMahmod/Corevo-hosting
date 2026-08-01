import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PortalBookingProjection, PortalSessionSnapshot } from './types'
import { buildPortalBookingCalendar } from './calendar'

const originalKey = process.env.CUSTOMER_PORTAL_HMAC_KEY
const bookingId = '123e4567-e89b-42d3-a456-426614174000'

const snapshot: PortalSessionSnapshot = {
  tenantSlug: 'freshcut',
  tenantName: 'FreshCut, Sverige',
  logoUrl: null,
  verticalLabel: 'HEMLIG VERTIKAL',
  phone: '+46700000000',
  address: 'TENANTENS CENTRALA ADRESS',
  mapUrl: null,
  bookingOrigin: 'https://freshcut.corevo.se',
  timezone: 'Europe/Stockholm',
  locale: 'sv-SE',
  defaultCountry: 'SE',
  currency: 'SEK',
  cancellationCutoffHours: 24,
  customerName: 'HEMLIG KUND',
  lastSeenAt: '2026-07-22T10:00:00.000Z',
  absoluteExpiresAt: '2027-07-22T10:00:00.000Z',
}

const booking: PortalBookingProjection = {
  id: bookingId,
  startTs: '2026-10-25T02:30:00+02:00',
  endTs: '2026-10-25T02:30:00+01:00',
  status: 'confirmed',
  presentationStatus: 'confirmed',
  serviceName: 'Klippning; skägg, premium',
  durationMinutes: 60,
  staffTitle: 'HEMLIG PERSONAL',
  location: {
    name: 'Studio; Ett',
    address: 'Bokningsgatan 1, Linköping',
    phone: '+46800000000',
    mapUrl: 'https://www.openstreetmap.org/?mlat=1&mlon=2',
    timezone: 'Europe/Stockholm',
  },
  priceCents: 99900,
  currency: 'SEK',
  canCancel: true,
  cancelDeadline: '2026-10-24T00:30:00.000Z',
  publicRebookUrl: 'https://freshcut.corevo.se/boka',
}

function unfold(calendar: string): string[] {
  return calendar.slice(0, -2).split('\r\n').reduce<string[]>((lines, line) => {
    if (line.startsWith(' ')) lines[lines.length - 1] += line.slice(1)
    else lines.push(line)
    return lines
  }, [])
}

describe('portal booking calendar payload', () => {
  beforeEach(() => {
    process.env.CUSTOMER_PORTAL_HMAC_KEY = '0123456789abcdef0123456789abcdef'
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CUSTOMER_PORTAL_HMAC_KEY
    else process.env.CUSTOMER_PORTAL_HMAC_KEY = originalKey
  })

  it('exports only the approved booking fields with an opaque UID', async () => {
    const calendar = await buildPortalBookingCalendar({
      snapshot,
      booking,
      generatedAt: new Date('2026-07-22T10:11:12.000Z'),
    })
    const lines = unfold(calendar)

    expect(lines).toContain('DTSTAMP:20260722T101112Z')
    expect(lines).toContain('DTSTART:20261025T003000Z')
    expect(lines).toContain('DTEND:20261025T013000Z')
    expect(lines).toContain('SUMMARY:Klippning\\; skägg\\, premium')
    expect(lines).toContain('DESCRIPTION:FreshCut\\, Sverige')
    expect(lines).toContain('ORGANIZER:https://freshcut.corevo.se')
    expect(lines).toContain('LOCATION:Studio\\; Ett\\, Bokningsgatan 1\\, Linköping')
    expect(lines.find((line) => line.startsWith('UID:'))).toMatch(
      /^UID:[a-f0-9]{64}@calendar\.corevo\.se$/,
    )

    for (const forbidden of [
      bookingId,
      'HEMLIG PERSONAL',
      'HEMLIG KUND',
      'HEMLIG VERTIKAL',
      'TENANTENS CENTRALA ADRESS',
      '+46700000000',
      '+46800000000',
      '99900',
      'openstreetmap',
      '/boka',
    ]) expect(calendar).not.toContain(forbidden)
  })

  it('omits LOCATION instead of falling back to tenant or staff data', async () => {
    const calendar = await buildPortalBookingCalendar({
      snapshot,
      booking: { ...booking, location: null },
      generatedAt: new Date('2026-07-22T10:11:12.000Z'),
    })

    expect(unfold(calendar).some((line) => line.startsWith('LOCATION:'))).toBe(false)
    expect(calendar).not.toContain(snapshot.address!)
  })
})
