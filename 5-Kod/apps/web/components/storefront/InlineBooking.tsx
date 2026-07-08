'use client'

import { BookingWizard, type WizardService, type WizardLocation } from '@/components/booking/BookingWizard'
import styles from './storefront.module.css'

/**
 * Boknings-vy "inline": bokningen ligger INBYGGD längst ner på sidan — ingen
 * drawer/modal. "Boka tid"-CTA:erna scrollar hit (BookingProvider). Kompakt
 * enskärms-innehåll (allt staplat i ett svep, per designbeskrivningen).
 */
export function InlineBooking({
  services,
  locations = [],
  tenantName,
  staffNoun = 'Frisör',
}: {
  services: WizardService[]
  locations?: WizardLocation[]
  tenantName: string
  staffNoun?: string
}) {
  return (
    <section id="boka-inline" className={styles.inlineBooking} aria-label={`Boka tid hos ${tenantName}`}>
      <div className="section-inner">
        <p className={styles.eyebrow} style={{ textAlign: 'center' }}>
          — Boka
        </p>
        <h2 className={styles.inlineTitle}>Boka tid</h2>
        <div className={styles.inlinePanel}>
          <BookingWizard services={services} locations={locations} mode="compact" staffNoun={staffNoun} open />
        </div>
      </div>
    </section>
  )
}
