import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { BookCta } from '@/components/brand/BookCta'
import styles from '@/components/brand/brand.module.css'

export const metadata: Metadata = { title: 'Kontakt' }

export default async function ContactPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle

  return (
    <section className="section">
      <div className={`section-inner ${styles.sectionInner}`}>
        <p className={styles.sectionEyebrow}>Kontakt</p>
        <h1>Kontakt</h1>
        <p className={styles.sectionLead}>
          Vill du boka tid hos {tenant.name}? Det gör du snabbast direkt online — välj tjänst
          och en ledig tid som passar dig.
        </p>

        {/* Graceful placeholders: the public data layer doesn't expose
            address / phone / opening hours yet (see crossModuleGaps). Until the
            salon fills in its profile, these read as "kommer snart" rather than
            leaving the page empty. */}
        <ul className={styles.infoGrid}>
          <li className={styles.infoCard}>
            <span className={styles.infoLabel}>Boka tid</span>
            <span className={styles.infoValue}>Online, dygnet runt</span>
            <span className={styles.infoHint}>
              Bekräftelse direkt — ändra eller avboka enkelt via din bokning.
            </span>
          </li>
          <li className={styles.infoCard}>
            <span className={styles.infoLabel}>Adress</span>
            <span className={styles.infoValue}>Visas snart</span>
            <span className={styles.infoHint}>
              {tenant.name} lägger till adress och vägbeskrivning i sin profil.
            </span>
          </li>
          <li className={styles.infoCard}>
            <span className={styles.infoLabel}>Öppettider</span>
            <span className={styles.infoValue}>Visas snart</span>
            <span className={styles.infoHint}>
              Lediga tider syns alltid i bokningen — välj den som passar dig.
            </span>
          </li>
        </ul>

        <p className="section-more">
          <BookCta />
        </p>
      </div>
    </section>
  )
}
