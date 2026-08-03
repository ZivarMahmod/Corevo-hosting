import type { BookingExternalCtaUrls } from './booking-external-url'

export type BookingCtaSlot = { id: string; label: string; group: 'Sida' | 'Tjänster' }

const FRESHCUT_PAGE_SLOTS: BookingCtaSlot[] = [
  { id: 'nav', label: 'Sidhuvud', group: 'Sida' },
  { id: 'hero', label: 'Första bokningsknappen', group: 'Sida' },
  { id: 'services-footer', label: 'Efter tjänstelistan', group: 'Sida' },
  { id: 'results', label: 'Resultat', group: 'Sida' },
  { id: 'studio', label: 'Om verksamheten', group: 'Sida' },
  { id: 'final', label: 'Avslutande bokning', group: 'Sida' },
  { id: 'contact', label: 'Kontakt', group: 'Sida' },
]

export function bookingCtaSlots(
  templateKey: string,
  services: readonly { id: string; name: string; active: boolean }[],
  savedUrls: BookingExternalCtaUrls,
): BookingCtaSlot[] {
  const slots = templateKey === 'freshcut'
    ? [
        ...FRESHCUT_PAGE_SLOTS,
        ...services.filter((service) => service.active).map((service) => ({
          id: `service:${service.id}`,
          label: service.name,
          group: 'Tjänster' as const,
        })),
      ]
    : []
  const known = new Set(slots.map((slot) => slot.id))
  return [
    ...slots,
    ...Object.keys(savedUrls)
      .filter((id) => !known.has(id))
      .map((id) => ({ id, label: id, group: 'Sida' as const })),
  ]
}
