export type PortalDataFailure =
  | { outcome: 'expired' }
  | { outcome: 'not_found' }
  | { outcome: 'unavailable' }

export type PortalSessionSnapshot = {
  tenantSlug: string
  tenantName: string
  logoUrl: string | null
  verticalLabel: string | null
  phone: string | null
  address: string | null
  mapUrl: string | null
  bookingOrigin: string
  timezone: string
  locale: string
  defaultCountry: string
  currency: string
  cancellationCutoffHours: number
  customerName: string
  lastSeenAt: string
  absoluteExpiresAt: string
}

export type PortalSessionSnapshotResult =
  | { outcome: 'ok'; snapshot: PortalSessionSnapshot }
  | PortalDataFailure

export type PortalBookingScope = 'upcoming' | 'history'

export type PortalBookingCursor = {
  startTs: string
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
  startTs: string
  endTs: string
  status: string
  presentationStatus: PortalPresentationStatus
  serviceName: string
  durationMinutes: number
  staffTitle: string | null
  location: {
    name: string | null
    address: string | null
    phone: string | null
    mapUrl: string | null
    timezone: string
  } | null
  priceCents: number | null
  currency: string
  canCancel: boolean
  cancelDeadline: string | null
  publicRebookUrl: string | null
}

export type PortalBookingListResult =
  | {
      outcome: 'ok'
      scope: PortalBookingScope
      pageSize: number
      items: PortalBookingProjection[]
      hasMore: boolean
      nextCursor: PortalBookingCursor | null
    }
  | PortalDataFailure

export type PortalBookingDetailResult =
  | { outcome: 'ok'; booking: PortalBookingProjection }
  | PortalDataFailure
