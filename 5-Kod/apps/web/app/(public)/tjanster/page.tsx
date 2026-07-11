import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { ServiceMenu } from '@/components/storefront/ServiceMenu'
import { SectionHeader } from '@/components/storefront/sections'
import { BookCta } from '@/components/brand/BookCta'
import { Reveal } from '@/components/storefront/Reveal'
import { pageMetadata } from '@/components/storefront/seo'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('tjanster')
}

export default async function ServicesPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  // Section header varies per theme (data-driven, no longer hardcoded).
  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
  const content = resolveThemeContent(settings.theme, settings.branding, copy)
  const services = await getServices(tenant.id, tenant.slug)

  return (
    <section className="section">
      <div className="section-inner">
        <SectionHeader
          eyebrow={content.servicesEyebrow}
          title={content.servicesTitle}
          lead={
            content.servicesIntro ??
            `Våra behandlingar hos ${tenant.name}. Alla priser är inkl. moms — välj en tjänst och boka en ledig tid online.`
          }
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
