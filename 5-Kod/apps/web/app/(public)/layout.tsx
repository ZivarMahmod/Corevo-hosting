import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'
import { requestOrigin } from '@/lib/url'
import { Nav } from '@/components/brand/Nav'
import { NavShell } from '@/components/brand/NavShell'
import { Footer } from '@/components/brand/Footer'
import { FooterFull } from '@/components/brand/FooterFull'
import { themeChrome } from '@/components/storefront/layouts/florist/layouts'
import { BookingProvider } from '@/components/storefront/BookingProvider'
import { CartProvider } from '@/components/storefront/shop/CartProvider'
import { CookieConsent } from '@/components/storefront/CookieConsent'
import { ModulePausedBanner } from '@/components/storefront/ModulePausedBanner'
import { getTenantModuleStates, moduleState } from '@/lib/tenant-modules'
import { loadLayoutModuleTeasers } from '@/components/storefront/layouts/load-module-teasers'
import {
  canonicalModuleHref,
  moduleNavigationLinks,
  moduleRouteReachable,
} from '@/components/storefront/layouts/module-navigation'
import { getWizardServices, getWizardLocations, getBookingPrefs } from '@/components/storefront/wizard-services'
import { InlineBooking } from '@/components/storefront/InlineBooking'
import { resolveStaffNoun } from '@/components/storefront/staff-noun'
import { branschBokning } from '@/components/storefront/bransch-copy'
import { resolvePrimaryCta } from '@/components/storefront/primary-cta'
import { THEME_CONTENT, resolveTenantCopy } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { LocalBusinessJsonLd } from '@/components/storefront/seo'
import { countTeamMembers } from '@/lib/storefront/team/load-team'
import storefront from '@/components/storefront/storefront.module.css'

// Per-request, host-resolved tenant → never prerender.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await currentTenant()
  if (!bundle) return { title: 'Corevo' }
  const { tenant } = bundle
  // Bransch-neutral (goal-54 körning 2, S11): "Boka tid hos X" antog att bokning är
  // kärnan — för t.ex. en butiks-tung florist är det missvisande som huvudbeskrivning.
  const description = `${tenant.name} — hitta öppettider, utbud och kontakt, och boka eller handla online.`
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
  // Prestanda C1: allt nedan behöver bara tenant.id/slug/vertical_id ur bundlen och är
  // inbördes OBEROENDE — det kördes tidigare som seriella await-hopp på varje
  // storefront-sidvisning (auditens vattenfall). Ett Promise.all gör dem parallella.
  // Modulgrindarna härleds efteråt ur samma reachability som startsidans layouts.
  //   copy        — footer-tagline (ägar-override annars tema-default; utility tema-fast)
  //   moduleStates— per-modul-livscykel (spår 5): storefronten renderar bara LIVE-moduler;
  //                 draft/off ej publikt, paused → banner + inerta CTA. Saknad rad → 'live'
  //                 (moduleState-default) så FreshCut/omigrerade salonger ser EXAKT ut som förr.
  //   wizard-trion— services/locations/prefs för den inbäddade bokningswizarden (som /boka).
  //   staffNoun   — bransch-substantiv (default 'Frisör') för drawern.
  //   rawPrimaryCta—bransch-styrd huvud-CTA (config-first); modul-gatas nedan.
  const [
    copy,
    moduleStates,
    [allWizardServices, wizardLocations, bookingPrefs],
    staffNoun,
    rawPrimaryCta,
    teamCount,
    layoutModules,
  ] = await Promise.all([
    getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null),
    getTenantModuleStates(tenant.id, tenant.slug),
    Promise.all([
      getWizardServices(tenant.id, tenant.slug),
      getWizardLocations(tenant.id, tenant.slug),
      getBookingPrefs(tenant.id, tenant.slug),
    ]),
    resolveStaffNoun(tenant.vertical_id),
    resolvePrimaryCta(tenant.vertical_id),
    countTeamMembers(tenant.id, tenant.slug),
    loadLayoutModuleTeasers(tenant.id, tenant.slug),
  ])

  const themeBase = THEME_CONTENT[settings.theme]
  const tagline = resolveTenantCopy(settings.theme, copy).tagline
  const content = { utility: themeBase.utility, tagline }

  const bookingState = moduleState(moduleStates, 'booking')
  const bookingLive = bookingState === 'live'
  const bookingPaused = bookingState === 'paused'
  // Korgen visas bara när shop-routen är reachable och har publika produkter.
  const cartEnabled = layoutModules.shopReachable
  // Booking gating: bara en LIVE booking-modul får riktiga tjänster; draft/off/paused
  // ger en TOM lista så varje "Boka tid"-CTA är inert (BookingProvider.available=false).
  const wizardServices = bookingLive ? allWizardServices : []
  // BRANSCH-REGELN: bokningens VERB (drawer/aria/footer/inline) ur bransch-lagret.
  const bokning = branschBokning(tenant.vertical_id)

  // goal-55 8A: bransch-styrd huvud-CTA i naven (config-first, aldrig if(bransch)).
  // Pekar branschens CTA på en modulroute använder den samma state+data-gate som navet;
  // annars faller den tillbaka till BookCta (null-prop).
  // Nav/NavShell får bara en färdig cta — eller null = dagens 'Boka tid' exakt.
  const primaryCta =
    rawPrimaryCta && moduleRouteReachable(rawPrimaryCta.href, layoutModules, layoutModules.bookingReachable)
      ? { ...rawPrimaryCta, href: canonicalModuleHref(rawPrimaryCta.href) }
      : null

  // Salvia + FreshCut lead with the richer 3-column footer (real address/hours/contact
  // — freshcut.se's footer carries phone/address/Instagram); the other themes (and
  // boka/avboka) use the compact MiniFooter.
  const isFullFooter = settings.theme === 'salvia' || settings.theme === 'freshcut'

  // goal-59 TEMA-PAKET: mallen får äga sitt SIDHUVUD och sin SIDFOT. Ett delat ansikte
  // gjorde alla 20 mallar till samma sida i olika färg (Zivars "det snurrar i cirklar").
  // FUNKTIONEN stannar här: länklistan nedan är modul-gatad, och mallens nav-markup
  // renderas som children i NavShell → mobilmeny, fokusfälla, korg och kundkonto följer
  // med varje mall utan att mallen kan tappa dem. Utan chrome → dagens Nav/Footer exakt.
  const chrome = themeChrome(settings.theme)
  const moduleLinks = moduleNavigationLinks(layoutModules)
  const navLinks = [
    { href: '/', label: 'Hem' },
    ...moduleLinks.filter((link) => link.href === '/shop'),
    ...(allWizardServices.length > 0 ? [{ href: '/tjanster', label: 'Tjänster' }] : []),
    ...moduleLinks.filter((link) => link.href !== '/shop'),
    // goal-64 TEAMET: INGEN modul — det är kundens folk. Länken gatas därför på FÖREKOMST
    // (minst en aktiv medarbetare som valt att synas). Utan folk finns ingen sida att
    // länka till — samma render-on-present-regel som resten av storefronten.
    ...(teamCount > 0
      ? [{ href: '/team', label: 'Team' }]
      : []),
    { href: '/om', label: 'Om oss' },
    { href: '/kontakt', label: 'Kontakt' },
  ]

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

      {/* In-page booking embed (Zivar's #1): the WHOLE shell — nav, main, footer
          — sits inside the provider, so every "Boka tid" CTA opens the same
          slide-over drawer without ever leaving the salon's page. */}
      <BookingProvider
        reachable={layoutModules.bookingReachable}
        websiteOnly={bookingState === 'off'}
        externalUrl={settings.bookingExternalUrl}
        services={wizardServices}
        locations={wizardLocations}
        tenantName={tenant.name}
        staffNoun={staffNoun}
        bokaCta={bokning.cta}
        variant={settings.bookingVariant}
        pickerMode={bookingPrefs.pickerMode}
        staffAvatarMode={bookingPrefs.staffAvatarMode}
      >
        {/* Paused booking → "stängt"-banner at the very top (draft/off render
            nothing public, so only 'paused' surfaces here). */}
        {bookingPaused ? <ModulePausedBanner /> : null}
        {/* CartProvider omsluter HELA skalet (nav + main + footer) — navens
            CartNavButton och mobil-overlayns korg-rad använder useCart, så
            providern måste ligga ovanför Nav (goal-55 7B). Den flytande
            CartButton-bollen är borttagen här — korgen bor i naven. */}
        <CartProvider>
        {/* Modulstyrd meny: Butik/Blogg får en riktig plats i navigationen när
            modulerna är live/paused — modulens egen sida är dess hem, startsidan
            visar bara teasers ("mosas in"-fixen). */}
        {chrome.Nav ? (
          // Mallens EGET sidhuvud som markup i plattformens NavShell — formen är
          // mallens, funktionen (mobilmeny/korg/konto/scroll) är alltid vår.
          <NavShell
            customerAccountsEnabled={settings.customerAccountsEnabled}
            cartEnabled={cartEnabled}
            utilityText={content.utility}
            hideUtility={chrome.ownsUtility}
            links={navLinks}
            primaryCta={primaryCta}
          >
            <chrome.Nav
              tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
              branding={settings.branding}
              links={navLinks}
              primaryCta={primaryCta}
              cartEnabled={cartEnabled}
              customerAccountsEnabled={settings.customerAccountsEnabled}
              utilityText={content.utility}
            />
          </NavShell>
        ) : (
          <Nav
            {...brandProps}
            customerAccountsEnabled={settings.customerAccountsEnabled}
            cartEnabled={cartEnabled}
            utilityText={content.utility}
            primaryCta={primaryCta}
            links={navLinks}
          />
        )}
        {/* `.shellMain` reserves space for the fixed top cluster (--nav-h). The
            Salvia home hero cancels it exactly with a negative margin, so the hero
            photo still meets the viewport top under the nav. */}
        <main className={`tenant-main ${storefront.shellMain}`}>{children}</main>
        {/* Inline-boknings-vyn: sektionen ligger I sidan, ovanför footern. */}
        {settings.bookingVariant === 'inline' && wizardServices.length > 0 ? (
          <InlineBooking
            services={wizardServices}
            locations={wizardLocations}
            tenantName={tenant.name}
            staffNoun={staffNoun}
            bokaCta={bokning.cta}
            bokaOnline={bokning.online}
            pickerMode={bookingPrefs.pickerMode}
            staffAvatarMode={bookingPrefs.staffAvatarMode}
          />
        ) : null}
        {chrome.Footer ? (
          <chrome.Footer
            tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
            tagline={content.tagline}
            location={location}
            contact={settings.contact}
            social={settings.social}
            links={navLinks}
          />
        ) : isFullFooter ? (
          <FooterFull
            tenant={{ name: tenant.name }}
            tagline={content.tagline}
            location={location}
            contact={settings.contact}
            social={settings.social}
          />
        ) : (
          <Footer tenant={{ name: tenant.name }} bokaOnline={bokning.online} />
        )}
        {settings.cookieBannerEnabled ? <CookieConsent /> : null}
        </CartProvider>
      </BookingProvider>
    </div>
  )
}
