import type {
  PortalBookingProjection,
  PortalPresentationStatus,
  PortalSessionSnapshot,
} from './types'

type StatusPresentation = {
  label: string
  tone: 'positive' | 'warning' | 'negative'
  icon: 'check' | 'clock' | 'cross' | 'unknown'
}

const STATUS: Record<PortalPresentationStatus, StatusPresentation> = {
  pending: { label: 'Förfrågan mottagen', tone: 'warning', icon: 'clock' },
  confirmed: { label: 'Bekräftad', tone: 'positive', icon: 'check' },
  completed: { label: 'Genomförd', tone: 'positive', icon: 'check' },
  cancelled: { label: 'Avbokad', tone: 'negative', icon: 'cross' },
  no_show: { label: 'Uteblev', tone: 'negative', icon: 'cross' },
  unknown: { label: 'Status uppdateras', tone: 'warning', icon: 'unknown' },
}

export function portalStatusPresentation(
  booking: PortalBookingProjection,
  now = Date.now(),
): StatusPresentation {
  if (
    (booking.presentationStatus === 'pending' || booking.presentationStatus === 'confirmed') &&
    Date.parse(booking.endTs) < now
  ) {
    return { label: 'Väntar på avslut', tone: 'warning', icon: 'clock' }
  }
  return STATUS[booking.presentationStatus]
}

export function formatPortalBooking(
  booking: PortalBookingProjection,
  snapshot: PortalSessionSnapshot,
) {
  const date = new Date(booking.startTs)
  const end = new Date(booking.endTs)
  const common = { locale: snapshot.locale, timeZone: snapshot.timezone }
  const weekday = new Intl.DateTimeFormat(common.locale, {
    timeZone: common.timeZone,
    weekday: 'long',
  }).format(date)
  const dayMonth = new Intl.DateTimeFormat(common.locale, {
    timeZone: common.timeZone,
    day: 'numeric',
    month: 'long',
  }).format(date)
  const fullDate = new Intl.DateTimeFormat(common.locale, {
    timeZone: common.timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
  const time = new Intl.DateTimeFormat(common.locale, {
    timeZone: common.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  const endTime = new Intl.DateTimeFormat(common.locale, {
    timeZone: common.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(end)
  const price = booking.priceCents === null
    ? null
    : new Intl.NumberFormat(common.locale, {
        style: 'currency',
        currency: booking.currency,
        minimumFractionDigits: booking.priceCents % 100 === 0 ? 0 : 2,
        maximumFractionDigits: booking.priceCents % 100 === 0 ? 0 : 2,
      }).format(booking.priceCents / 100)

  return {
    homeDateTime: `${weekday} ${dayMonth} · ${time}`,
    detailDateTime: `${weekday} ${fullDate} · ${time}–${endTime}`,
    historyDate: fullDate,
    price,
  }
}

export function groupPortalHistory(items: PortalBookingProjection[]) {
  return [
    { title: 'Tidigare besök', items: items.filter((item) => item.presentationStatus === 'completed') },
    { title: 'Avbokade bokningar', items: items.filter((item) => item.presentationStatus === 'cancelled') },
    {
      title: 'Övriga bokningar',
      items: items.filter((item) =>
        item.presentationStatus !== 'completed' && item.presentationStatus !== 'cancelled'),
    },
  ]
}
