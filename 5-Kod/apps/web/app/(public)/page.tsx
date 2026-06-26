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
import { loadTenantSkin } from '@/lib/storefront/skin/load-skin'
import { applySkinOverlay } from '@/lib/storefront/skin/overlay'
import { SALVIA_REGION_MANIFEST } from '@/lib/sajtbyggare/manifest/salvia'
import { getLook } from '@/lib/sajtbyggare/look-registry'
import { renderTemplate } from '@/lib/sajtbyggare/render-bridge'
import { BookingMount } from '@/lib/sajtbyggare/booking-mount'

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

  // goal-50: a tenant that chose a render-bron LOOK renders that look's REAL HTML (väg
  // A) with the live booking module woven at its <corevo-module> marker. The (public)
  // layout serves the slim shell for these tenants (no Corevo nav/footer). BookingMount
  // is the self-contained inline wizard (loads its own services/locations). The look's
  // vendor CSS loads page-level via its cssHrefs (same faithful surface as the spike;
  // full CSS scoping is goal-36 R5 hardening). renderTemplate is R2-guarded → a broken
  // look degrades to a fallback node, never a 500.
  const look = settings.look ? getLook(settings.look) : undefined
  if (look) {
    return (
      <>
        {look.cssHrefs.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <div data-look={look.key} className="corevo-tpl-scope">
          {renderTemplate(look.html, { booking: <BookingMount tenantId={tenant.id} slug={tenant.slug} /> })}
        </div>
      </>
    )
  }

  // Render-bron = the renderer. The public storefront renders via the per-theme
  // layout (the 5 React themes today; the manifest/HTML render-bridge for the
  // catalogue templates — goal-36). The skin-path (lib/storefront/skin + the
  // content_slots/template_slots DB) is the KEPT data layer for the next slice
  // (defs→templates, edits→content_slots), but its slice-1 SKELETON renderer
  // (SkinRenderer) is PARKED — it never rendered a tenant (prod has 0
  // content_slots) and a bare-skeleton render would regress the design. When the
  // marriage slice lands a RICH renderer over the DB layer, it gets wired here.
  const Layout = STOREFRONT_LAYOUTS[settings.theme]
  // Owner copy (settings.copy) wins per-field; theme default fills the rest.
  const baseCopy = await getTenantCopy(tenant.id, tenant.slug)

  // Template-bron option 1: a salvia tenant with authored content_slots (written by
  // the super-admin visual hub at /salonger/[id]) renders those values THROUGH this
  // same hand-built layout — precedence content_slots > tenant_settings > theme
  // default. We resolve the DB skin and fold it onto copy/branding via the salvia
  // manifest's bindings (applySkinOverlay), then the normal resolveThemeContent
  // renders it — no new renderer, no design regression. salvia-only, and only when
  // the tenant actually authored content (hasTenantContent) → otherwise BYTE-
  // IDENTICAL to the tenant_settings path. loadTenantSkin is throw-safe (→ null).
  let copy = baseCopy
  let branding: typeof settings.branding = settings.branding
  if (settings.theme === 'salvia') {
    const skin = await loadTenantSkin(tenant.id, 'salvia')
    if (skin?.hasTenantContent) {
      const folded = applySkinOverlay(
        skin,
        SALVIA_REGION_MANIFEST,
        (baseCopy ?? {}) as Record<string, unknown>,
        (settings.branding ?? {}) as unknown as Record<string, unknown>,
      )
      copy = folded.copy as unknown as typeof baseCopy
      branding = folded.branding as unknown as typeof settings.branding
    }
  }
  const content = resolveThemeContent(settings.theme, branding, copy)
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
