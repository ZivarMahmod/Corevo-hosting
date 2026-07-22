import 'server-only'
import { icsEscape, icsUtcStamp, serializeIcs } from '@/lib/calendar/ics'
import { portalCalendarUid } from './crypto'
import type { PortalBookingProjection, PortalSessionSnapshot } from './types'

export async function buildPortalBookingCalendar({
  snapshot,
  booking,
  generatedAt = new Date(),
}: {
  snapshot: PortalSessionSnapshot
  booking: PortalBookingProjection
  generatedAt?: Date
}): Promise<string> {
  const location = [booking.location?.name, booking.location?.address].filter(Boolean).join(', ')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Corevo//Customer Portal//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${await portalCalendarUid(booking.id)}`,
    `DTSTAMP:${icsUtcStamp(generatedAt)}`,
    `DTSTART:${icsUtcStamp(booking.startTs)}`,
    `DTEND:${icsUtcStamp(booking.endTs)}`,
    `SUMMARY:${icsEscape(booking.serviceName)}`,
    `DESCRIPTION:${icsEscape(snapshot.tenantName)}`,
    `ORGANIZER:${snapshot.bookingOrigin}`,
    ...(location ? [`LOCATION:${icsEscape(location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return serializeIcs(lines)
}
