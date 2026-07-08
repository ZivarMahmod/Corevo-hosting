import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { injectTenantTokens } from '@corevo/ui'
import { getTenantBySlug, getServices, STOREFRONT_THEMES, type StorefrontTheme } from '@/lib/tenant-data'
import { STOREFRONT_LAYOUTS } from '@/components/storefront/layouts'
import { resolveThemeContent, THEME_CONTENT, resolveTenantCopy } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { StorefrontModuleSections } from '@/components/storefront/StorefrontModuleSections'
import { Nav } from '@/components/brand/Nav'
import { Footer } from '@/components/brand/Footer'
import { FooterFull } from '@/components/brand/FooterFull'
import { BookingProvider } from '@/components/storefront/BookingProvider'
import { CartProvider } from '@/components/storefront/shop/CartProvider'
import { SidaPreviewBridge } from '@/components/platform/SidaPreviewBridge'
import storefront from '@/components/storefront/storefront.module.css'

// Super-admin LIVE STOREFRONT PREVIEW — the iframe target for the Sida tab on
// /salonger/[id]. Renders the tenant's REAL storefront **with the full chrome**
// (Nav + hero/sections + module sections + footer — the same pieces
// app/(public)/layout.tsx + page.tsx compose), but SAME-ORIGIN on the platform
// host so it can be framed under `frame-ancestors 'self'` (the public
// storefront on <slug>.corevo.se is cross-origin and blocked by X-Frame-Options).
//
// Zivar: "jag behöver även se topp-bannern, alltså hela sidan i previewen" — so
// this is deliberately NOT slim anymore. Only the side-effectful extras are
// skipped: JSON-LD/SEO, cookie-banner, cart button. Booking CTAs render but are
// inert (BookingProvider gets an empty service list) — correct for a preview.
// Platform-gated; force-dynamic (per-tenant, never prerendered).
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning', robots: { index: false } }

export default async function SalongPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ theme?: string }>
}) {
  await requirePlatformAdmin() // same-origin iframe → platform session cookie flows
  const { slug } = await params
  const { theme: themeParam } = await searchParams
  const bundle = await getTenantBySlug(slug)
  if (!bundle) notFound() // unknown / suspended (public client sees active only)
  const { tenant, settings, location } = bundle

  // Draft-mall: Sida-fliken förhandsvisar en ANNAN mall via ?theme= UTAN att spara —
  // så operatören ser mallen innan hen publicerar. Valideras mot de kända mallarna;
  // ogiltigt/utelämnat → tenantens sparade tema (den skarpa sidan är oförändrad).
  const theme: StorefrontTheme =
    typeof themeParam === 'string' && (STOREFRONT_THEMES as readonly string[]).includes(themeParam)
      ? (themeParam as StorefrontTheme)
      : settings.theme

  const Layout = STOREFRONT_LAYOUTS[theme]
  const copy = await getTenantCopy(tenant.id, tenant.slug)
  const content = resolveThemeContent(theme, settings.branding, copy)
  const services = await getServices(tenant.id, tenant.slug)

  // Chrome pieces — mirrors app/(public)/layout.tsx for the previewed theme.
  const themeBase = THEME_CONTENT[theme]
  const tagline = resolveTenantCopy(theme, copy).tagline
  const isFullFooter = theme === 'salvia' || theme === 'freshcut'

  return (
    <div
      className={`tenant-root ${storefront.tplRoot}`}
      data-world="storefront"
      data-theme={theme}
      data-tenant={tenant.id}
      style={injectTenantTokens(settings.branding) as CSSProperties}
    >
      <SidaPreviewBridge />
      {/* Inert booking context: empty services → every "Boka tid" CTA renders but
          does nothing, so the preview can't create bookings. */}
      <BookingProvider services={[]} locations={[]} tenantName={tenant.name} staffNoun="Frisör">
        <Nav
          tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
          branding={settings.branding}
          customerAccountsEnabled={settings.customerAccountsEnabled}
          utilityText={themeBase.utility}
        />
        <CartProvider>
          <main className={`tenant-main ${storefront.shellMain}`}>
            <Layout
              tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
              theme={theme}
              content={content}
              services={services}
              location={location}
            />
            <StorefrontModuleSections tenantId={tenant.id} slug={tenant.slug} />
          </main>
        </CartProvider>
        {isFullFooter ? (
          <FooterFull
            tenant={{ name: tenant.name }}
            tagline={tagline}
            location={location}
            contact={settings.contact}
          />
        ) : (
          <Footer tenant={{ name: tenant.name }} />
        )}
      </BookingProvider>
    </div>
  )
}
