import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { ServiceList } from '@/components/brand/ServiceList'
import { BookCta } from '@/components/brand/BookCta'

export const metadata: Metadata = { title: 'Tjänster' }

export default async function ServicesPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const services = await getServices(tenant.id, tenant.slug)

  return (
    <section className="section">
      <div className="section-inner">
        <h1>Tjänster</h1>
        <p className="prose">Våra behandlingar hos {tenant.name}. Priser inkl. moms.</p>
        <ServiceList services={services} />
        <p className="section-more">
          <BookCta />
        </p>
      </div>
    </section>
  )
}
