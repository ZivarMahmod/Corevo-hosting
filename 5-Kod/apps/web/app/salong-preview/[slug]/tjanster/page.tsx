import type { Metadata } from 'next'
import { getServices } from '@/lib/tenant-data'
import { ServiceMenu } from '@/components/storefront/ServiceMenu'
import { SectionHeader } from '@/components/storefront/sections'
import { BookCta } from '@/components/brand/BookCta'
import { Reveal } from '@/components/storefront/Reveal'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell } from '../preview-shell'

// Preview av /tjanster — samma innehåll som app/(public)/tjanster/page.tsx (utan
// SEO-metadata), i preview-chromen. Nås via nav-klick i preview-iframen.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Tjänster', robots: { index: false } }

export default async function PreviewServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string }>
}) {
  const { slug } = await params
  const { theme: themeParam } = await searchParams
  const bundle = await loadPreviewBundle(slug)
  const theme = resolvePreviewTheme(bundle, themeParam)
  const { tenant, settings } = bundle

  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme)
  const content = resolveThemeContent(theme, settings.branding, copy)
  const services = await getServices(tenant.id, tenant.slug)

  return (
    <PreviewShell bundle={bundle} theme={theme}>
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
    </PreviewShell>
  )
}
