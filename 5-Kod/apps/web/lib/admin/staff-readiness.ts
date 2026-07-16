export type ReadinessService = {
  id: string
  active: boolean
  locationId: string | null
}

export type StaffReadinessInput = {
  active: boolean
  locationId: string | null
  openingHoursConfirmed: boolean
  workingHoursCount: number
  serviceIds: readonly string[]
  services: readonly ReadinessService[]
}

export type StaffReadinessState =
  | 'missing_location'
  | 'unconfirmed_opening_hours'
  | 'no_matching_service'
  | 'no_working_hours'
  | 'inactive'
  | 'ready'

export type StaffReadinessAction =
  | 'location'
  | 'opening_hours'
  | 'services'
  | 'working_hours'
  | 'activate'

export type StaffReadiness = {
  state: StaffReadinessState
  bookable: boolean
  label: string
  action: StaffReadinessAction | null
}

export function matchingBookableServices<T extends ReadinessService>(
  locationId: string | null,
  services: readonly T[],
): T[] {
  if (!locationId) return []
  return services.filter(
    (service) =>
      service.active && (service.locationId === null || service.locationId === locationId),
  )
}

export function staffReadiness(input: StaffReadinessInput): StaffReadiness {
  if (!input.locationId) {
    return { state: 'missing_location', bookable: false, label: 'Välj plats', action: 'location' }
  }
  if (!input.openingHoursConfirmed) {
    return {
      state: 'unconfirmed_opening_hours',
      bookable: false,
      label: 'Bekräfta platsens öppettider',
      action: 'opening_hours',
    }
  }

  const linked = new Set(input.serviceIds)
  const hasMatchingService = matchingBookableServices(input.locationId, input.services).some(
    (service) => linked.has(service.id),
  )
  if (!hasMatchingService) {
    return {
      state: 'no_matching_service',
      bookable: false,
      label: 'Koppla en aktiv tjänst för platsen',
      action: 'services',
    }
  }
  if (input.workingHoursCount === 0) {
    return {
      state: 'no_working_hours',
      bookable: false,
      label: 'Lägg till arbetstider',
      action: 'working_hours',
    }
  }
  if (!input.active) {
    return {
      state: 'inactive',
      bookable: false,
      label: 'Aktivera medarbetaren',
      action: 'activate',
    }
  }
  return { state: 'ready', bookable: true, label: 'Redo att bokas', action: null }
}
