import { describe, expect, it } from 'vitest'
import { eligibleRescheduleStaff, rescheduleStartIso } from './BookingDrawer'

describe('rescheduleStartIso', () => {
  it('tolkar den valda väggtiden i verksamhetens tidszon på sommaren', () => {
    expect(rescheduleStartIso('2026-07-15', '12:30', 'Europe/Stockholm')).toBe(
      '2026-07-15T10:30:00.000Z',
    )
  })

  it('följer vintertid utan en hårdkodad UTC-offset', () => {
    expect(rescheduleStartIso('2026-01-15', '12:30', 'Europe/Stockholm')).toBe(
      '2026-01-15T11:30:00.000Z',
    )
  })
})

describe('eligibleRescheduleStaff', () => {
  const staff = [
    {
      id: 'both',
      name: 'Båda rätt',
      serviceIds: ['service-a'],
      locationIds: ['location-a'],
    },
    {
      id: 'wrong-service',
      name: 'Fel tjänst',
      serviceIds: ['service-b'],
      locationIds: ['location-a'],
    },
    {
      id: 'wrong-location',
      name: 'Fel plats',
      serviceIds: ['service-a'],
      locationIds: ['location-b'],
    },
  ]

  it('visar bara aktiva resurser som erbjuder tjänsten på bokningens plats', () => {
    expect(eligibleRescheduleStaff(staff, 'service-a', 'location-a').map((s) => s.id)).toEqual([
      'both',
    ])
  })
})
