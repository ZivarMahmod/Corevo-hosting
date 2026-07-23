import type { Metadata } from 'next'
import { AboutSplit, StylistSpotlights, AccentPhrase, ClosingCta } from '@/components/storefront/sections'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { loadPreviewBundle, resolvePreviewCopyMode, resolvePreviewTheme, PreviewShell } from '../preview-shell'

// Preview av /om — samma innehåll som app/(public)/om/page.tsx, i preview-chromen.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Om', robots: { index: false } }

export default async function PreviewAboutPage({
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
  const { tenant, settings } = bundle

  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme, copyMode)
  const content = resolveThemeContent(theme, settings.branding, copy)

  return (
    <PreviewShell bundle={bundle} theme={theme} copyMode={copyMode}>
      <AboutSplit salonName={tenant.name} content={content} />
      <AccentPhrase text={content.italic} />
      <StylistSpotlights salonName={tenant.name} content={content} />
      <ClosingCta content={content} />
    </PreviewShell>
  )
}
