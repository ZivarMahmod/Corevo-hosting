import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
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

// Per-request, host-resolved tenant → never prerender.
export const dynamic = 'force-dynamic'

/** Storefront home. `settings.theme` selects the layout; tenant copy and media
 * override that theme's defaults. Shared chrome lives in StorefrontShell. */
export default async function HomePage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings, location } = bundle

  // The selected theme layout is the only renderer.
  const Layout = STOREFRONT_LAYOUTS[settings.theme]
  // Owner copy (settings.copy) wins per-field; theme default fills the rest.
  const copy = await getTenantCopy(bundle)
  const content = resolveThemeContent(settings.theme, settings.branding, copy)
  const services = await getServices(tenant.id, tenant.slug)

  // S10: teman som ÄGER sina moduler väver in butik/blogg/presentkort i sitt eget
  // formspråk men förblir SYNKRONA komponenter (studions klient-preview renderar
  // dem) — teasers förladdas här och skickas som prop. Vilka teman det är bor i
  // THEME_OWNS_MODULES (layouts/index.ts), inte i en OR-kedja här: en glömd nyckel
  // gav förr BÅDE modul-lösa hem OCH dubbelrenderade sektioner, helt tyst.
  const ownsModules = THEME_OWNS_MODULES.has(settings.theme)
  const loadedModules = THEME_LOADS_LAYOUT_MODULES.has(settings.theme)
    ? await loadLayoutModuleTeasers(tenant.id, tenant.slug)
    : undefined
  const modules = loadedModules
    ? withLegacyExternalBooking(loadedModules, settings.bookingLegacyExternal)
    : undefined

  // Multi-bransch (spår 5): the live module sections (shop/offert/blogg/lojalitet/
  // presentkort) render right after the theme layout's own sections, gated by the
  // tenant's per-module lifecycle. Extracted to StorefrontModuleSections so the
  // render-bron LOOK path (above) renders the SAME live modules — one gating impl.
  return (
    <>
      <Layout
        tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
        theme={settings.theme}
        content={content}
        services={services}
        location={location}
        contact={settings.contact}
        social={settings.social}
        modules={modules}
      />
      {/* Teman som ÄGER sina moduler väver in butik/blogg/presentkort i sitt eget
          formspråk inne i layouten — den generiska teaser-stapeln skulle dubblera
          dem. Övriga teman får teasers tills de också integrerar modulerna. */}
      {ownsModules ? null : (
        <StorefrontModuleSections tenantId={tenant.id} slug={tenant.slug} variant="teaser" />
      )}
    </>
  )
}
