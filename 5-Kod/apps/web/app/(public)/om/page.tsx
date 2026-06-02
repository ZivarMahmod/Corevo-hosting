import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { AboutSplit, StylistSpotlights, AccentPhrase, ClosingCta } from '@/components/storefront/sections'
import { resolveThemeContent } from '@/components/storefront/theme-content'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Om oss' }

export default async function AboutPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const content = resolveThemeContent(settings.theme, settings.branding)

  return (
    <>
      <AboutSplit salonName={tenant.name} content={content} />
      <AccentPhrase text={content.italic} />
      <StylistSpotlights salonName={tenant.name} content={content} />
      <ClosingCta content={content} />
    </>
  )
}
