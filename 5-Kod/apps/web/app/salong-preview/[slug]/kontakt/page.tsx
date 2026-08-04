import type { Metadata } from 'next'
import { getServices } from '@/lib/tenant-data'
import { LocationHours, ClosingCta } from '@/components/storefront/sections'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { themePages } from '@/components/storefront/layouts/runtime'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { loadPreviewPage, type PreviewPageProps } from '../preview-shell'

// Preview av /kontakt — samma innehåll som app/(public)/kontakt/page.tsx, i preview-
// chromen. LocationHours själv-hämtar via currentTenant() — funkar i previewen tack
// vare middlewarens steg 2b (x-corevo-tenant-slug ur preview-URL:en).
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning · Kontakt', robots: { index: false } }

export default async function PreviewContactPage(props: PreviewPageProps) {
  const { bundle, theme, copyMode } = await loadPreviewPage(props)
  const { tenant, settings, location } = bundle

  const copy = await getTenantCopy(bundle, theme, copyMode)
  const content = resolveThemeContent(theme, settings.branding, copy)
  const Page = themePages(theme).kontakt
  const services = Page ? await getServices(tenant.id, tenant.slug) : []

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
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
    </StorefrontShell>
  )
}
