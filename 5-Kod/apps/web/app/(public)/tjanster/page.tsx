import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { ServiceList } from '@/components/brand/ServiceList'
import { BookCta } from '@/components/brand/BookCta'
import styles from '@/components/brand/brand.module.css'

export const metadata: Metadata = { title: 'Tjänster' }

export default async function ServicesPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const services = await getServices(tenant.id, tenant.slug)

  return (
    <section className="section">
      <div className={`section-inner ${styles.sectionInner}`}>
        <p className={styles.sectionEyebrow}>Behandlingar &amp; priser</p>
        <h1>Tjänster</h1>
        <p className={styles.sectionLead}>
          Våra behandlingar hos {tenant.name}. Alla priser är inkl. moms — välj en tjänst och
          boka en ledig tid online.
        </p>
        <ServiceList services={services} />
        {services.length > 0 ? (
          <p className="section-more">
            <BookCta />
          </p>
        ) : null}
      </div>
    </section>
  )
}
