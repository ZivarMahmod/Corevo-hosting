import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { STOREFRONT_LAYOUTS } from '@/components/storefront/layouts'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { getTenantModuleStates, isModuleLive, isModulePaused } from '@/lib/tenant-modules'
import { ShopSection } from '@/components/storefront/ShopSection'
import { OffertSection } from '@/components/storefront/OffertSection'
import { BloggSection } from '@/components/storefront/BloggSection'
import { LojalitetSection } from '@/components/storefront/LojalitetSection'
import { PresentkortSection } from '@/components/storefront/PresentkortSection'

// Per-request, host-resolved tenant → never prerender.
export const dynamic = 'force-dynamic'

/**
 * Storefront home. The tenant's `settings.theme` selects one of five GENUINELY
 * DISTINCT layouts (Salvia/Leander/Zigge/Linnea/Edit) — not a token swap. Each
 * layout renders its own hero + sections; the chrome (nav + footer) lives in
 * app/(public)/layout.tsx. Owner-uploaded media (settings.branding.*) is merged
 * with strong per-theme defaults so an un-uploaded salon still looks complete.
 */
export default async function HomePage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings, location } = bundle

  const Layout = STOREFRONT_LAYOUTS[settings.theme]
  // Owner copy (settings.copy) wins per-field; theme default fills the rest.
  const copy = await getTenantCopy(tenant.id, tenant.slug)
  const content = resolveThemeContent(settings.theme, settings.branding, copy)
  const services = await getServices(tenant.id, tenant.slug)

  // Multi-bransch (spår 5): per-module lifecycle, SAME gate shape as booking in
  // app/(public)/layout.tsx. The shop + offert sections live at the module's
  // default_section_position ('main', per 0031/0033), so they render INSIDE the
  // home flow right after the theme layout's own sections. We render them ONLY for
  // a LIVE module; draft/off stay invisible; 'paused' renders the section read-only
  // (closed-state) via its `paused` prop. A tenant with no row for the module gets
  // the per-module default ('off' for shop/offert) → section absent. Each <Section>
  // self-resolves to null when the tenant has no module config, so this is safe to
  // mount whenever the gate passes.
  const moduleStates = await getTenantModuleStates(tenant.id, tenant.slug)
  const shopLive = isModuleLive(moduleStates, 'shop')
  const shopPaused = isModulePaused(moduleStates, 'shop')
  const offertLive = isModuleLive(moduleStates, 'offert')
  const offertPaused = isModulePaused(moduleStates, 'offert')
  const bloggLive = isModuleLive(moduleStates, 'blogg')
  const bloggPaused = isModulePaused(moduleStates, 'blogg')
  const lojalitetLive = isModuleLive(moduleStates, 'lojalitet')
  const lojalitetPaused = isModulePaused(moduleStates, 'lojalitet')
  const presentkortLive = isModuleLive(moduleStates, 'presentkort')
  const presentkortPaused = isModulePaused(moduleStates, 'presentkort')

  return (
    <>
      <Layout
        tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
        theme={settings.theme}
        content={content}
        services={services}
        location={location}
      />
      {shopLive || shopPaused ? (
        <ShopSection tenantId={tenant.id} slug={tenant.slug} paused={shopPaused} />
      ) : null}
      {offertLive || offertPaused ? (
        <OffertSection tenantId={tenant.id} slug={tenant.slug} paused={offertPaused} />
      ) : null}
      {bloggLive || bloggPaused ? (
        <BloggSection tenantId={tenant.id} slug={tenant.slug} paused={bloggPaused} />
      ) : null}
      {lojalitetLive || lojalitetPaused ? (
        <LojalitetSection tenantId={tenant.id} slug={tenant.slug} paused={lojalitetPaused} />
      ) : null}
      {presentkortLive || presentkortPaused ? (
        <PresentkortSection tenantId={tenant.id} slug={tenant.slug} paused={presentkortPaused} />
      ) : null}
    </>
  )
}
