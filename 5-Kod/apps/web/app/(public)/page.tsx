import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { STOREFRONT_LAYOUTS, THEME_OWNS_MODULES } from '@/components/storefront/layouts'
import { loadLayoutModuleTeasers } from '@/components/storefront/layouts/load-module-teasers'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { StorefrontModuleSections } from '@/components/storefront/StorefrontModuleSections'
import { loadTenantSkin } from '@/lib/storefront/skin/load-skin'
import { applySkinOverlay } from '@/lib/storefront/skin/overlay'
import { SALVIA_REGION_MANIFEST } from '@/lib/storefront/skin/salvia-manifest'

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
  const baseCopy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)

  // Template-bron option 1: a salvia tenant with authored content_slots (written by
  // the super-admin visual hub at /kunder/[id]) renders those values THROUGH this
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

  // S10: teman som ÄGER sina moduler väver in butik/blogg/presentkort i sitt eget
  // formspråk men förblir SYNKRONA komponenter (studions klient-preview renderar
  // dem) — teasers förladdas här och skickas som prop. Vilka teman det är bor i
  // THEME_OWNS_MODULES (layouts/index.ts), inte i en OR-kedja här: en glömd nyckel
  // gav förr BÅDE modul-lösa hem OCH dubbelrenderade sektioner, helt tyst.
  const ownsModules = THEME_OWNS_MODULES.has(settings.theme)
  const modules = ownsModules
    ? await loadLayoutModuleTeasers(tenant.id, tenant.slug)
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
