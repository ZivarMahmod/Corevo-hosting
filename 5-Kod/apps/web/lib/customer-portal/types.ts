export type PortalDataFailure =
  | { outcome: 'expired' }
  | { outcome: 'not_found' }
  | { outcome: 'unavailable' }

export type PortalSessionSnapshot = {
  tenantSlug: string
  tenantName: string
  customerName: string
  lastSeenAt: string
  absoluteExpiresAt: string
}

export type PortalSessionSnapshotResult =
  | { outcome: 'ok'; snapshot: PortalSessionSnapshot }
  | PortalDataFailure

export type PortalBookingScope = 'upcoming' | 'history'

export type PortalBookingCursor = {
  startAt: string
  id: string
}

export type PortalKnownBookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'

export type PortalPresentationStatus = PortalKnownBookingStatus | 'unknown'

export type PortalBookingProjection = {
  id: string
  startAt: string
  endAt: string
  runtimeStatus: string
  presentationStatus: PortalPresentationStatus
  serviceName: string
  staffName: string | null
  locationName: string | null
  locationAddress: string | null
  price: { cents: number; currency: string } | null
}

export type PortalBookingListResult =
  | {
      outcome: 'ok'
      scope: PortalBookingScope
      pageSize: number
      items: PortalBookingProjection[]
      nextCursor: PortalBookingCursor | null
    }
  | PortalDataFailure

export type PortalBookingDetailResult =
  | { outcome: 'ok'; booking: PortalBookingProjection }
  | PortalDataFailure
