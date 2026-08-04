import { describe, expect, it } from 'vitest'
import { staffCardContext, toStaffCard } from './data'

describe('staff card projection', () => {
  it('uses one shared projection for names, readiness and chronological day rows', () => {
    const context = staffCardContext(
      [{ id: 'service-1', name: 'Klippning', active: true, location_id: null, duration_min: 30 }],
      [{ id: 'location-1', name: 'Centrum' }],
      [{ location_id: 'location-1', confirmed_at: '2026-08-04T00:00:00Z' }],
      [{ staff_id: 'staff-1', location_id: 'location-1' }],
    )

    const card = toStaffCard(
      {
        id: 'staff-1',
        displayName: 'Alex',
        title: 'Stylist',
        active: true,
        bookingCount: 2,
        serviceIds: ['service-1'],
        profile_id: 'user-1',
        location_id: 'location-1',
        avatar_url: null,
        show_on_site: true,
        color: '#123456',
      },
      [
        { id: 'late', startTs: '2026-08-04T12:00:00Z', status: 'confirmed', serviceName: null, customerLabel: 'B' },
        { id: 'early', startTs: '2026-08-04T10:00:00Z', status: 'confirmed', serviceName: null, customerLabel: 'A' },
      ],
      context,
    )

    expect(card).toMatchObject({
      serviceNames: ['Klippning'],
      locationName: 'Centrum',
      hasAccount: true,
      readiness: { state: 'ready', bookable: true },
    })
    expect(card.today.map((row) => row.id)).toEqual(['early', 'late'])
  })
})
