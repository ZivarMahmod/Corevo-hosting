import type { CSSProperties, ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { requirePortal } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { injectTenantTokens } from '@corevo/ui'
import { getTenantBySlug, STOREFRONT_THEMES, type StorefrontTheme, type TenantBundle } from '@/lib/tenant-data'
import { THEME_CONTENT, resolveTenantCopy } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { Nav } from '@/components/brand/Nav'
import { Footer } from '@/components/brand/Footer'
import { FooterFull } from '@/components/brand/FooterFull'
import { BookingProvider } from '@/components/storefront/BookingProvider'
import { CartProvider } from '@/components/storefront/shop/CartProvider'
import { getWizardServices, getWizardLocations } from '@/components/storefront/wizard-services'
import { InlineBooking } from '@/components/storefront/InlineBooking'
import { resolveStaffNoun } from '@/components/storefront/staff-noun'
import { getTenantModuleStates, moduleState } from '@/lib/tenant-modules'
import { SidaPreviewBridge } from '@/components/platform/SidaPreviewBridge'
import storefront from '@/components/storefront/storefront.module.css'

/**
 * Delat skal för super-admin-previewens ALLA sidor (/salong-preview/<slug>[/tjanster|
 * /om|/kontakt]) — samma chrome som app/(public)/layout.tsx: Nav (toppbanner),
 * BookingProvider med RIKTIGA tjänster (Zivar: "kunna göra allt i previewen som i
 * deras riktiga storefront" — boknings-drawern öppnar och funkar), footer per tema.
 * Ett vanligt server-komponent-skal (INTE en route-layout: layouts får inte
 * searchParams, och ?theme= måste styra chromen). Sid-innehållet skickas som children.
 *
 * Draft-mall: ?theme= förhandsvisar en ANNAN mall utan att spara — valideras mot de
 * kända mallarna; ogiltigt/utelämnat → tenantens sparade tema.
 *
 * Middleware (steg 2b) sätter x-corevo-tenant-slug ur preview-URL:en, så själv-
 * hämtande storefront-sektioner (LocationHours, modulsektioner) resolvar rätt tenant
 * via currentTenant() precis som på den riktiga tenant-hosten.
 */
export function resolvePreviewTheme(bundle: TenantBundle, themeParam: string | undefined): StorefrontTheme {
  return typeof themeParam === 'string' && (STOREFRONT_THEMES as readonly string[]).includes(themeParam)
    ? (themeParam as StorefrontTheme)
    : bundle.settings.theme
}

export async function loadPreviewBundle(slug: string): Promise<TenantBundle> {
  // Same-origin iframe → the viewer's session cookie flows. Platform admin may
  // preview ANY tenant; a salon admin (portal level) only their OWN slug — the
  // kund-adminens /admin/sida uses exactly this route for its live preview.
  const user = await requirePortal('admin')
  if (!user.platformAdmin) {
    const supabase = await createClient()
    const { data: own } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', user.tenantId ?? '')
      .maybeSingle()
    if (!own || own.slug !== slug) notFound()
  }
  const bundle = await getTenantBySlug(slug)
  if (!bundle) notFound() // unknown / suspended (public client sees active only)
  return bundle
}

export async function PreviewShell({
  bundle,
  theme,
  children,
}: {
  bundle: TenantBundle
  theme: StorefrontTheme
  children: ReactNode
}) {
  const { tenant, settings, location } = bundle
  const themeBase = THEME_CONTENT[theme]
  const isFullFooter = theme === 'salvia' || theme === 'freshcut'

  // Riktig bokning i previewen — samma gating som (public)/layout: bara en LIVE
  // bokningsmodul får riktiga tjänster; annars renderar CTA:erna inert.
  const moduleStates = await getTenantModuleStates(tenant.id, tenant.slug)
  const bookingLive = moduleState(moduleStates, 'booking') === 'live'
  const [allWizardServices, wizardLocations, staffNoun] = await Promise.all([
    getWizardServices(tenant.id, tenant.slug),
    getWizardLocations(tenant.id, tenant.slug),
    resolveStaffNoun(tenant.vertical_id),
  ])
  const wizardServices = bookingLive ? allWizardServices : []

  // Footer-taglinen ärar ägarens copy-override (temats standard annars) — samma
  // kontrakt som (public)/layout.
  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
  const tagline = resolveTenantCopy(theme, copy).tagline

  return (
    <div
      className={`tenant-root ${storefront.tplRoot}`}
      data-world="storefront"
      data-theme={theme}
      data-tenant={tenant.id}
      style={injectTenantTokens(settings.branding) as CSSProperties}
    >
      <SidaPreviewBridge />
      <BookingProvider
        services={wizardServices}
        locations={wizardLocations}
        tenantName={tenant.name}
        staffNoun={staffNoun}
        variant={settings.bookingVariant}
      >
        <Nav
          tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
          branding={settings.branding}
          customerAccountsEnabled={settings.customerAccountsEnabled}
          utilityText={themeBase.utility}
        />
        <CartProvider>
          <main className={`tenant-main ${storefront.shellMain}`}>{children}</main>
        </CartProvider>
        {settings.bookingVariant === 'inline' && wizardServices.length > 0 ? (
          <InlineBooking
            services={wizardServices}
            locations={wizardLocations}
            tenantName={tenant.name}
            staffNoun={staffNoun}
          />
        ) : null}
        {isFullFooter ? (
          <FooterFull
            tenant={{ name: tenant.name }}
            tagline={tagline}
            location={location}
            contact={settings.contact}
            social={settings.social}
          />
        ) : (
          <Footer tenant={{ name: tenant.name }} />
        )}
      </BookingProvider>
    </div>
  )
}
