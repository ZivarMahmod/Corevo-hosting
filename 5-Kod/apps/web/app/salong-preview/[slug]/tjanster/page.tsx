import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServices } from '@/lib/tenant-data'
import { ServiceMenu } from '@/components/storefront/ServiceMenu'
import { SectionHeader } from '@/components/storefront/sections'
import { BookCta } from '@/components/brand/BookCta'
import { Reveal } from '@/components/storefront/Reveal'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themePages } from '@/components/storefront/layouts/florist/layouts'
import { loadLayoutModuleTeasers } from '@/components/storefront/layouts/load-module-teasers'
import { loadPreviewBundle, resolvePreviewCopyMode, resolvePreviewTheme, PreviewShell } from '../preview-shell'

// Preview av /tjanster — samma innehåll som app/(public)/tjanster/page.tsx (utan
// SEO-metadata), i preview-chromen. Nås via nav-klick i preview-iframen.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Tjänster', robots: { index: false } }

export default async function PreviewServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string; copy?: string }>
}) {
  const { slug } = await params
  const { theme: themeParam, copy: copyParam } = await searchParams
  const bundle = await loadPreviewBundle(slug)
  const theme = resolvePreviewTheme(bundle, themeParam)
  const copyMode = resolvePreviewCopyMode(copyParam)
  if (theme === 'freshcut') {
    redirect(`/salong-preview/${encodeURIComponent(slug)}?theme=freshcut&copy=${copyMode}#tjanster`)
  }
  const { tenant, settings, location } = bundle

  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme, copyMode)
  const content = resolveThemeContent(theme, settings.branding, copy)
  const [services, modules] = await Promise.all([
    getServices(tenant.id, tenant.slug),
    loadLayoutModuleTeasers(tenant.id, tenant.slug),
  ])
  const Page = themePages(theme).tjanster

  return (
    <PreviewShell bundle={bundle} theme={theme} copyMode={copyMode}>
      {Page ? (
        <Page
          tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
          content={content}
          services={services}
          location={location}
          contact={settings.contact}
          modules={modules}
        />
      ) : (
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
                <BookCta enabled={modules.bookingReachable} />
              </Reveal>
            ) : null}
          </div>
        </section>
      )}
    </PreviewShell>
  )
}
