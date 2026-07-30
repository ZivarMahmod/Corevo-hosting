import type { Metadata } from 'next'
import { getServices } from '@/lib/tenant-data'
import { LocationHours, ClosingCta } from '@/components/storefront/sections'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { themePages } from '@/components/storefront/layouts/florist/layouts'
import { loadPreviewBundle, resolvePreviewCopyMode, resolvePreviewTheme, PreviewShell } from '../preview-shell'

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
  searchParams: Promise<{ theme?: string; copy?: string }>
}) {
  const { slug } = await params
  const { theme: themeParam, copy: copyParam } = await searchParams
  const bundle = await loadPreviewBundle(slug)
  const theme = resolvePreviewTheme(bundle, themeParam)
  const copyMode = resolvePreviewCopyMode(copyParam)
  const { tenant, settings, location } = bundle

  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme, copyMode)
  const content = resolveThemeContent(theme, settings.branding, copy)
  const Page = themePages(theme).kontakt
  const services = Page ? await getServices(tenant.id, tenant.slug) : []

  return (
    <PreviewShell bundle={bundle} theme={theme} copyMode={copyMode}>
      {Page ? (
        <Page
          tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
          content={content}
          services={services}
          location={location}
          contact={settings.contact}
        />
      ) : (
        <>
          <LocationHours salonName={tenant.name} content={content} />
          <ClosingCta content={content} />
        </>
      )}
    </PreviewShell>
  )
}
