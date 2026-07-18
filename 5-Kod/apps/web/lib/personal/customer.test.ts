import { describe, it, expect } from 'vitest'
import { deriveCustomerVisitSummary, deriveLoyalty, resolveCustomerName } from './customer'

// The calendar label and the client-card heading both go through resolveCustomerName.
// It must NEVER surface raw contact-PII (email/phone) — only the customer's chosen
// display name, or an initial when they asked to hide their name. This is the
// FAS0 leak fix (raw email used to be the fallback label).

describe('resolveCustomerName', () => {
  it('prefers an explicit display_name', () => {
    expect(
      resolveCustomerName({ display_name: 'Sara L.', full_name: 'Sara Lindqvist', name_hidden: false }),
    ).toBe('Sara L.')
  })

  it('uses the full name when nothing is hidden and no display_name', () => {
    expect(
      resolveCustomerName({ display_name: null, full_name: 'Erik Berg', name_hidden: false }),
    ).toBe('Erik Berg')
  })

  it('reduces to an initial when name_hidden is set', () => {
    expect(
      resolveCustomerName({ display_name: null, full_name: 'Erik Berg', name_hidden: true }),
    ).toBe('E.')
  })

  it('name_hidden masks even a stale display_name value', () => {
    expect(
      resolveCustomerName({ display_name: 'Stamkund', full_name: 'Erik Berg', name_hidden: true }),
    ).toBe('E.')
  })

  it('falls back to a neutral label when nothing is known', () => {
    expect(resolveCustomerName({ display_name: null, full_name: null, name_hidden: false })).toBe(
      'Kund',
    )
    expect(resolveCustomerName({ display_name: '  ', full_name: '', name_hidden: false })).toBe(
      'Kund',
    )
  })

  it('hidden with no full name degrades to the neutral label, not an empty initial', () => {
    expect(resolveCustomerName({ display_name: null, full_name: null, name_hidden: true })).toBe(
      'Kund',
    )
  })
})

describe('deriveCustomerVisitSummary', () => {
  it('derives relationship memory from completed visits only and uses the latest visit for ties', () => {
    expect(
      deriveCustomerVisitSummary([
        {
          status: 'confirmed',
          start_ts: '2026-07-18T12:00:00.000Z',
          services: { name: 'Färgning' },
          staff: { title: 'Kim' },
        },
        {
          status: 'completed',
          start_ts: '2026-07-04T12:00:00.000Z',
          services: { name: 'Klippning' },
          staff: { title: 'Alex' },
        },
        {
          status: 'completed',
          start_ts: '2026-06-20T12:00:00.000Z',
          services: { name: 'Klippning' },
          staff: { title: 'Kim' },
        },
        {
          status: 'no_show',
          start_ts: '2026-06-01T12:00:00.000Z',
          services: { name: 'Färgning' },
          staff: { title: 'Kim' },
        },
      ]),
    ).toEqual({
      visits: 2,
      lastVisitTs: '2026-07-04T12:00:00.000Z',
      lastStaffTitle: 'Alex',
      favoriteStaffTitle: 'Alex',
      usualServiceName: 'Klippning',
    })
  })
})

describe('deriveLoyalty', () => {
  it('uses database lifetime independently of a spent balance', () => {
    expect(deriveLoyalty(0, 250, [
      { name: 'Brons', points: 0 },
      { name: 'Silver', points: 200 },
      { name: 'Guld', points: 500 },
    ])).toEqual({
      points: 0,
      lifetime: 250,
      tier: 'Silver',
      toNext: 250,
      hasProgram: true,
    })
  })
})
