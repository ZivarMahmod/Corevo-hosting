import type { Metadata } from 'next'
import { getServices } from '@/lib/tenant-data'
import { STOREFRONT_LAYOUTS } from '@/components/storefront/layouts'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { StorefrontModuleSections } from '@/components/storefront/StorefrontModuleSections'
import { loadPreviewBundle, resolvePreviewTheme, PreviewShell } from './preview-shell'

// Super-admin LIVE STOREFRONT PREVIEW, startsidan — iframe-målet för Sida-fliken på
// /kunder/[id]. Renderar tenantens RIKTIGA storefront med FULL chrome (Nav +
// sektioner + moduler + footer) SAME-ORIGIN på plattform-hosten, så den kan framas
// under `frame-ancestors 'self'`. Undersidorna (tjanster/om/kontakt) är egna rutter
// bredvid denna — SidaPreviewBridge skriver om nav-länkarna dit, så operatören kan
// klicka runt precis som på den skarpa sidan. Chromen bor i PreviewShell.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning', robots: { index: false } }

export default async function SalongPreviewPage({
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
  const { tenant, settings, location } = bundle

  const Layout = STOREFRONT_LAYOUTS[theme]
  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme)
  const content = resolveThemeContent(theme, settings.branding, copy)
  const services = await getServices(tenant.id, tenant.slug)

  return (
    <PreviewShell bundle={bundle} theme={theme}>
      <Layout
        tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
        theme={theme}
        content={content}
        services={services}
        location={location}
      />
      <StorefrontModuleSections tenantId={tenant.id} slug={tenant.slug} />
    </PreviewShell>
  )
}
