import type { Metadata } from 'next'
import { LocationHours, ClosingCta } from '@/components/storefront/sections'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell } from '../preview-shell'

// Preview av /kontakt — samma innehåll som app/(public)/kontakt/page.tsx, i preview-
// chromen. LocationHours själv-hämtar via currentTenant() — funkar i previewen tack
// vare middlewarens steg 2b (x-corevo-tenant-slug ur preview-URL:en).
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Kontakt', robots: { index: false } }

export default async function PreviewContactPage({
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

  const copy = await getTenantCopy(tenant.id, tenant.slug)
  const content = resolveThemeContent(theme, settings.branding, copy)

  return (
    <PreviewShell bundle={bundle} theme={theme}>
      <LocationHours salonName={tenant.name} />
      <ClosingCta content={content} />
    </PreviewShell>
  )
}
