import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { ServiceMenu } from '@/components/storefront/ServiceMenu'
import { SectionHeader } from '@/components/storefront/sections'
import { BookCta } from '@/components/brand/BookCta'
import { Reveal } from '@/components/storefront/Reveal'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Tjänster' }

export default async function ServicesPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle
  const services = await getServices(tenant.id, tenant.slug)

  return (
    <section className="section">
      <div className="section-inner">
        <SectionHeader
          eyebrow="— Behandlingar & priser"
          title="Tjänster"
          lead={`Våra behandlingar hos ${tenant.name}. Alla priser är inkl. moms — välj en tjänst och boka en ledig tid online.`}
        />
        <ServiceMenu services={services} />
        {services.length > 0 ? (
          <Reveal className="section-more">
            <BookCta />
          </Reveal>
        ) : null}
      </div>
    </section>
  )
}
