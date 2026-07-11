import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { AboutSplit, StylistSpotlights, AccentPhrase, ClosingCta } from '@/components/storefront/sections'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { pageMetadata } from '@/components/storefront/seo'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('om')
}

export default async function AboutPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
  const content = resolveThemeContent(settings.theme, settings.branding, copy)

  return (
    <>
      <AboutSplit salonName={tenant.name} content={content} />
      <AccentPhrase text={content.italic} />
      <StylistSpotlights salonName={tenant.name} content={content} />
      <ClosingCta content={content} />
    </>
  )
}
