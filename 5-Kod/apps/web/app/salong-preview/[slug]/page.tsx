import type { Metadata } from 'next'
import { getServices } from '@/lib/tenant-data'
import {
  STOREFRONT_LAYOUTS,
  THEME_LOADS_LAYOUT_MODULES,
  THEME_OWNS_MODULES,
} from '@/components/storefront/layouts/runtime'
import {
  loadLayoutModuleTeasers,
  withLegacyExternalBooking,
} from '@/components/storefront/layouts/load-module-teasers'
import { resolveThemeContent } from '@/lib/storefront/theme-content'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { StorefrontModuleSections } from '@/components/storefront/StorefrontModuleSections'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { loadPreviewPage, type PreviewPageProps } from './preview-shell'

// Super-admin LIVE STOREFRONT PREVIEW, startsidan — iframe-målet för Sida-fliken på
// /kunder/[id]. Renderar tenantens RIKTIGA storefront med FULL chrome (Nav +
// sektioner + moduler + footer) SAME-ORIGIN på plattform-hosten, så den kan framas
// under `frame-ancestors 'self'`. Undersidorna (tjanster/om/kontakt) är egna rutter
// bredvid denna — SidaPreviewBridge skriver om nav-länkarna dit, så operatören kan
// klicka runt precis som på den skarpa sidan. Chromen ägs av StorefrontShell.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning', robots: { index: false } }

export default async function SalongPreviewPage(props: PreviewPageProps) {
  const { bundle, theme, copyMode } = await loadPreviewPage(props)
  const { tenant, settings, location } = bundle

  const Layout = STOREFRONT_LAYOUTS[theme]
  const ownsModules = THEME_OWNS_MODULES.has(theme)
  const copy = await getTenantCopy(bundle, theme, copyMode)
  const content = resolveThemeContent(theme, settings.branding, copy)
  const services = await getServices(tenant.id, tenant.slug)
  const loadedModules = THEME_LOADS_LAYOUT_MODULES.has(theme)
    ? await loadLayoutModuleTeasers(tenant.id, tenant.slug)
    : undefined
  const modules = loadedModules
    ? withLegacyExternalBooking(loadedModules, settings.bookingLegacyExternal)
    : undefined

  return (
    <StorefrontShell bundle={bundle} surface="preview" theme={theme} copyMode={copyMode}>
      <Layout
        tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
        theme={theme}
        content={content}
        services={services}
        location={location}
        contact={settings.contact}
        social={settings.social}
        modules={modules}
      />
      {ownsModules ? null : (
        <StorefrontModuleSections tenantId={tenant.id} slug={tenant.slug} variant="teaser" />
      )}
    </StorefrontShell>
  )
}
