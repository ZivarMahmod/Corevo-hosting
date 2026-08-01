import { buildPortalBookingCalendar } from '@/lib/customer-portal/calendar'
import { getPortalBooking, getPortalSessionSnapshot } from '@/lib/customer-portal/data'
import { PORTAL_UUID_PATTERN } from '@/lib/customer-portal/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const securityHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}

function unavailable(): Response {
  return new Response('Kalenderfilen kunde inte skapas.', {
    status: 404,
    headers: {
      ...securityHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!PORTAL_UUID_PATTERN.test(id) || new URL(request.url).search !== '') return unavailable()

  const snapshotResult = await getPortalSessionSnapshot()
  if (snapshotResult.outcome !== 'ok') return unavailable()
  const bookingResult = await getPortalBooking(id)
  if (bookingResult.outcome !== 'ok') return unavailable()

  try {
    const calendar = await buildPortalBookingCalendar({
      snapshot: snapshotResult.snapshot,
      booking: bookingResult.booking,
    })
    return new Response(calendar, {
      status: 200,
      headers: {
        ...securityHeaders,
        'Content-Disposition': 'attachment; filename="corevo-bokning.ics"',
        'Content-Type': 'text/calendar; charset=utf-8',
      },
    })
  } catch {
    return unavailable()
  }
}
