export type BookingStatusPresentation = {
  eyebrow: string
  heading: string
  message: string
  stamp: string
  canAddToCalendar: boolean
  canManage: boolean
}

const PRESENTATIONS: Record<string, BookingStatusPresentation> = {
  pending: {
    eyebrow: 'FÖRFRÅGAN MOTTAGEN',
    heading: 'Din bokningsförfrågan är mottagen',
    message:
      'Tiden är inte bekräftad ännu. Du får ett besked när verksamheten har godkänt den.',
    stamp: 'VÄNTAR PÅ SVAR',
    canAddToCalendar: false,
    canManage: true,
  },
  confirmed: {
    eyebrow: 'BOKAT',
    heading: 'Tack, din tid är bokad!',
    message: 'En bekräftelse är på väg till dina kontaktuppgifter.',
    stamp: 'BEKRÄFTAD',
    canAddToCalendar: true,
    canManage: true,
  },
  cancelled: {
    eyebrow: 'AVBOKAD',
    heading: 'Bokningen är avbokad',
    message: 'Den här tiden är inte längre bokad.',
    stamp: 'AVBOKAD',
    canAddToCalendar: false,
    canManage: false,
  },
  completed: {
    eyebrow: 'GENOMFÖRD',
    heading: 'Tack för ditt besök!',
    message: 'Besöket är registrerat som genomfört.',
    stamp: 'GENOMFÖRD',
    canAddToCalendar: false,
    canManage: false,
  },
  no_show: {
    eyebrow: 'AVSLUTAD',
    heading: 'Besöket är avslutat',
    message:
      'Bokningen är registrerad som utebliven. Kontakta verksamheten om något har blivit fel.',
    stamp: 'UTEBLIVET',
    canAddToCalendar: false,
    canManage: false,
  },
}

const UNKNOWN: BookingStatusPresentation = {
  eyebrow: 'BOKNINGSSTATUS',
  heading: 'Vi kontrollerar din bokning',
  message: 'Kontakta verksamheten om du behöver besked om tiden.',
  stamp: 'KONTROLLERAS',
  canAddToCalendar: false,
  canManage: false,
}

export function bookingStatusPresentation(status: string | null | undefined): BookingStatusPresentation {
  return (status && PRESENTATIONS[status]) || UNKNOWN
}
