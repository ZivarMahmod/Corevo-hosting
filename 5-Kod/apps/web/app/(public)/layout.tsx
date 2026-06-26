import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'
import { requestOrigin } from '@/lib/url'
import { Nav } from '@/components/brand/Nav'
import { Footer } from '@/components/brand/Footer'
import { FooterFull } from '@/components/brand/FooterFull'
import { BookingProvider } from '@/components/storefront/BookingProvider'
import { CartProvider } from '@/components/storefront/shop/CartProvider'
import { CartButton } from '@/components/storefront/shop/CartButton'
import { CookieConsent } from '@/components/storefront/CookieConsent'
import { ModulePausedBanner } from '@/components/storefront/ModulePausedBanner'
import { getTenantModuleStates, moduleState } from '@/lib/tenant-modules'
import { getWizardServices, getWizardLocations } from '@/components/storefront/wizard-services'
import { resolveStaffNoun } from '@/components/storefront/staff-noun'
import { THEME_CONTENT, resolveTenantCopy } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { LocalBusinessJsonLd } from '@/components/storefront/seo'
import storefront from '@/components/storefront/storefront.module.css'

// Per-request, host-resolved tenant → never prerender.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await currentTenant()
  if (!bundle) return { title: 'Salong' }
  const { tenant } = bundle
  const description = `Boka tid hos ${tenant.name} online.`
  // metadataBase = this tenant's own origin so child-page openGraph/canonical
  // URLs resolve absolutely against the right subdomain (no Next warning).
  const origin = await requestOrigin()
  let metadataBase: URL | undefined
  try {
    metadataBase = new URL(origin)
  } catch {
    metadataBase = undefined
  }
  return {
    metadataBase,
    title: { default: tenant.name, template: `%s · ${tenant.name}` },
    description,
    alternates: { canonical: '/' },
    openGraph: { title: tenant.name, description, type: 'website', url: '/', siteName: tenant.name },
  }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const bundle = await currentTenant()
  if (!bundle) notFound() // unknown / reserved / platform / root host → 404
  const { tenant, settings, location } = bundle

  // The chrome is the ONE themed nav (flexes per [data-theme]) + footer. We do NOT
  // emit data-template here: the legacy [data-template='B'] rules in
  // storefront.module.css still restyle .heroTitle/.heroCta/.secTitle/.utilityBar
  // (classes the new layouts reuse), so a tenant with a stale nav_variant='B' would
  // get an uppercase/square hero on the wrong theme. .tplRoot's base block supplies
  // --nav-h (116px) without the attribute, so .shellMain padding + the Salvia hero
  // cancel still resolve. boka/avboka still emit their own data-template, but render
  // no hero / no .secTitle content, so they are unaffected.
  const brandProps = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    branding: settings.branding,
  }
  const overrideCss = settings.customOverride?.css
  // Footer tagline honours the owner's settings.copy override (theme default
  // otherwise); utility micro-copy is theme-default by contract. The thin
  // utility strip stays theme-fixed — only `tagline` is owner-editable here.
  const copy = await getTenantCopy(tenant.id, tenant.slug)
  const themeBase = THEME_CONTENT[settings.theme]
  const tagline = resolveTenantCopy(settings.theme, copy).tagline
  const content = { utility: themeBase.utility, tagline }

  // Multi-bransch (spår 5): the tenant's per-module lifecycle. The storefront renders
  // only LIVE modules; 'draft'/'off' booking is not public; 'paused' booking shows a
  // "stängt"-banner and the CTAs go inert. BACKWARD-COMPAT: a tenant with no
  // tenant_modules row defaults booking→'live' (moduleState), so FreshCut (and any
  // un-migrated salon) renders EXACTLY as before.
  const moduleStates = await getTenantModuleStates(tenant.id, tenant.slug)
  const bookingState = moduleState(moduleStates, 'booking')
  const bookingLive = bookingState === 'live'
  const bookingPaused = bookingState === 'paused'

  // Services + active locations shaped for the embedded booking wizard — same as
  // /boka, cached. locations feed the drawer's picker (hidden for 1-location tenants).
  // Booking gating: only a LIVE booking module gets real services; draft/off/paused
  // pass an EMPTY list so every "Boka tid" CTA is inert (BookingProvider.available
  // is false), without removing the storefront's content/pages.
  const [allWizardServices, wizardLocations] = await Promise.all([
    getWizardServices(tenant.id, tenant.slug),
    getWizardLocations(tenant.id, tenant.slug),
  ])
  const wizardServices = bookingLive ? allWizardServices : []

  // Bransch-resolved staff noun (default 'Frisör') for the embedded booking wizard,
  // so a non-frisör tenant's drawer reads e.g. "Barberare"/"Nagelteknolog".
  const staffNoun = await resolveStaffNoun(tenant.vertical_id)

  // Salvia leads with the richer 3-column footer (real address/hours/contact);
  // the other four themes (and boka/avboka) use the compact MiniFooter.
  const isSalvia = settings.theme === 'salvia'

  return (
    <div
      className={`tenant-root ${storefront.tplRoot}`}
      data-world="storefront"
      data-theme={settings.theme}
      data-tenant={tenant.id}
      style={injectTenantTokens(settings.branding) as CSSProperties}
    >
      {/* schema.org LocalBusiness — tenant name/url/phone/image always; address +
          opening hours only when real (no invented data, no fabricated geo). */}
      <LocalBusinessJsonLd
        name={tenant.name}
        location={location}
        contact={settings.contact}
        logoUrl={settings.branding.logo_url ?? null}
      />

      {/* Nivå 3 — tenant-isolated custom CSS, scoped under [data-tenant]. */}
      {overrideCss ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `[data-tenant="${tenant.id}"]{${overrideCss}}`,
          }}
        />
      ) : null}

      {/* In-page booking embed (Zivar's #1): the WHOLE shell — nav, main, footer
          — sits inside the provider, so every "Boka tid" CTA opens the same
          slide-over drawer without ever leaving the salon's page. */}
      <BookingProvider services={wizardServices} locations={wizardLocations} tenantName={tenant.name} staffNoun={staffNoun}>
        {/* Paused booking → "stängt"-banner at the very top (draft/off render
            nothing public, so only 'paused' surfaces here). */}
        {bookingPaused ? <ModulePausedBanner /> : null}
        <Nav
          {...brandProps}
          customerAccountsEnabled={settings.customerAccountsEnabled}
          utilityText={content.utility}
        />
        {/* `.shellMain` reserves space for the fixed top cluster (--nav-h). The
            Salvia home hero cancels it exactly with a negative margin, so the hero
            photo still meets the viewport top under the nav. CartProvider wraps the
            content + flytande kundvagn (köp-räls, goal-49); CartButton döljer sig
            själv när varukorgen är tom → inert för icke-shop-tenants. */}
        <CartProvider>
          <main className={`tenant-main ${storefront.shellMain}`}>{children}</main>
          <CartButton />
        </CartProvider>
        {isSalvia ? (
          <FooterFull
            tenant={{ name: tenant.name }}
            tagline={content.tagline}
            location={location}
            contact={settings.contact}
          />
        ) : (
          <Footer tenant={{ name: tenant.name }} />
        )}
        {settings.cookieBannerEnabled ? <CookieConsent /> : null}
      </BookingProvider>
    </div>
  )
}
