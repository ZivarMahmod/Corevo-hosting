import { describe, expect, it } from 'vitest'
import { matchingBookableServices, staffReadiness } from './staff-readiness'

const base = {
  active: true,
  locationId: 'location-a',
  openingHoursConfirmed: true,
  workingHoursCount: 5,
  serviceIds: ['global-service'],
  services: [
    { id: 'global-service', active: true, locationId: null },
    { id: 'location-a-service', active: true, locationId: 'location-a' },
    { id: 'location-b-service', active: true, locationId: 'location-b' },
    { id: 'inactive-service', active: false, locationId: null },
  ],
}

describe('staffReadiness', () => {
  it.each([
    [{ ...base, active: false, locationId: null }, 'missing_location'],
    [{ ...base, active: false, openingHoursConfirmed: false }, 'unconfirmed_opening_hours'],
    [{ ...base, active: false, serviceIds: [] }, 'no_matching_service'],
    [{ ...base, active: false, workingHoursCount: 0 }, 'no_working_hours'],
    [{ ...base, active: false }, 'inactive'],
    [base, 'ready'],
  ] as const)('prioriterar den första blockeraren och ger %s', (input, state) => {
    expect(staffReadiness(input).state).toBe(state)
  })

  it('godkänner bara kopplade aktiva tjänster som är globala eller tillhör personalens plats', () => {
    expect(
      staffReadiness({
        ...base,
        serviceIds: ['location-b-service', 'inactive-service'],
      }),
    ).toMatchObject({ state: 'no_matching_service', bookable: false })

    expect(staffReadiness({ ...base, serviceIds: ['location-a-service'] })).toMatchObject({
      state: 'ready',
      bookable: true,
    })
  })

  it('returnerar de tjänster som kan kopplas till vald plats', () => {
    expect(
      matchingBookableServices('location-a', base.services).map((service) => service.id),
    ).toEqual(['global-service', 'location-a-service'])
    expect(matchingBookableServices(null, base.services)).toEqual([])
  })

  it('ger en konkret nästa åtgärd i stället för en generell status', () => {
    expect(staffReadiness({ ...base, openingHoursConfirmed: false })).toMatchObject({
      label: 'Bekräfta platsens öppettider',
      action: 'opening_hours',
    })
    expect(staffReadiness(base)).toMatchObject({
      label: 'Redo att bokas',
      action: null,
    })
  })
})
