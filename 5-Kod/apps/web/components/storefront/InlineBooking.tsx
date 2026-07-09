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
  staffNoun = 'Frisör',
  pickerMode = 'calendar',
  staffAvatarMode = 'initialer',
}: {
  services: WizardService[]
  locations?: WizardLocation[]
  tenantName: string
  staffNoun?: string
  pickerMode?: PickerMode
  staffAvatarMode?: StaffAvatarMode
}) {
  return (
    <section id="boka-inline" className="fc-scope fc-inline" aria-label={`Boka tid hos ${tenantName}`}>
      <div className="fc-inline-band">
        <div className="fc-inline-eyebrow">Boka online</div>
        <h2 className="fc-inline-title">Hitta din tid</h2>
      </div>
      <div className="fc-inline-panel">
        <BookingWizard
          services={services}
          locations={locations}
          mode="compact"
          staffNoun={staffNoun}
          pickerMode={pickerMode}
          staffAvatarMode={staffAvatarMode}
          brandName={tenantName}
          open
        />
      </div>
    </section>
  )
}
