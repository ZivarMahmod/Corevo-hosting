'use client'

import { BookingWizard, type WizardService, type WizardLocation } from '@/components/booking/BookingWizard'
import type { PickerMode, StaffAvatarMode } from '@/lib/platform/booking-variant'

/**
 * Boknings-vy "inline" (design-paketet, README §The four presentations):
 * bokningen ligger INBYGGD i sidan — ingen drawer/modal, ingen scrim.
 * Sektionshuvud på ett paper-2-band ("Boka online / Hitta din tid") och därunder
 * in-flow-kortet med 1.5px ink-ram + mjuk skugga (max 640px på desktop).
 * "Boka tid"-CTA:erna scrollar hit (BookingProvider → #boka-inline).
 */
export function InlineBooking({
  services,
  locations = [],
  tenantName,
  staffNoun = 'Personal',
  bokaCta = 'Boka tid',
  bokaOnline = 'Boka online',
  pickerMode = 'calendar',
  staffAvatarMode = 'initialer',
}: {
  services: WizardService[]
  locations?: WizardLocation[]
  tenantName: string
  staffNoun?: string
  /** Branschens boknings-verb + tagline (bransch-copy.ts → branschBokning()).
   *  Låg hårdkodat som "Boka tid" här förr — en restaurang bokar bord. */
  bokaCta?: string
  bokaOnline?: string
  pickerMode?: PickerMode
  staffAvatarMode?: StaffAvatarMode
}) {
  return (
    <section
      id="boka-inline"
      className="fc-scope fc-inline"
      aria-label={`${bokaCta} hos ${tenantName}`}
    >
      <div className="fc-inline-band">
        <div className="fc-inline-eyebrow">{bokaOnline}</div>
        <h2 className="fc-inline-title">{bokaCta}</h2>
      </div>
      <div className="fc-inline-panel">
        <BookingWizard
          services={services}
          locations={locations}
          mode="compact"
          staffNoun={staffNoun}
          bokaCta={bokaCta}
          pickerMode={pickerMode}
          staffAvatarMode={staffAvatarMode}
          brandName={tenantName}
          open
        />
      </div>
    </section>
  )
}
