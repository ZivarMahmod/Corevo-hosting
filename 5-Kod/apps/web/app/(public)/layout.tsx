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
import { loadUpcomingEvents } from '@/lib/storefront/kurser/load-kurser'
import { getWizardServices, getWizardLocations, getBookingPrefs } from '@/components/storefront/wizard-services'
import { InlineBooking } from '@/components/storefront/InlineBooking'
import { resolveStaffNoun } from '@/components/storefront/staff-noun'
import { branschBokning } from '@/components/storefront/bransch-copy'
import { resolvePrimaryCta } from '@/components/storefront/primary-cta'
import { THEME_CONTENT, resolveTenantCopy } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { LocalBusinessJsonLd } from '@/components/storefront/seo'
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
  const overrideCss = settings.customOverride?.css
  // Footer tagline honours the owner's settings.copy override (theme default
  // otherwise); utility micro-copy is theme-default by contract. The thin
  // utility strip stays theme-fixed — only `tagline` is owner-editable here.
  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null)
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
  // goal-55 7B: shop live/paused → korg-ikon i naven (alltid synlig, badge vid
  // count>0) + korg-rad i mobil-overlayn, i stället för den flytande bollen.
  const shopState = moduleState(moduleStates, 'shop')
  const cartEnabled = shopState === 'live' || shopState === 'paused'

  // Services + active locations shaped for the embedded booking wizard — same as
  // /boka, cached. locations feed the drawer's picker (hidden for 1-location tenants).
  // Booking gating: only a LIVE booking module gets real services; draft/off/paused
  // pass an EMPTY list so every "Boka tid" CTA is inert (BookingProvider.available
  // is false), without removing the storefront's content/pages.
  const [allWizardServices, wizardLocations, bookingPrefs] = await Promise.all([
    getWizardServices(tenant.id, tenant.slug),
    getWizardLocations(tenant.id, tenant.slug),
    // Redesign-prefs (tid-väljare + barberarbild-läge) — rå-läses ur settings via
    // samma seam som readBookingVariant, cachat per tenant.
    getBookingPrefs(tenant.id, tenant.slug),
  ])
  const wizardServices = bookingLive ? allWizardServices : []

  // Bransch-resolved staff noun (default 'Frisör') for the embedded booking wizard,
  // so a non-frisör tenant's drawer reads e.g. "Barberare"/"Nagelteknolog".
  const staffNoun = await resolveStaffNoun(tenant.vertical_id)
  // BRANSCH-REGELN: bokningens VERB (drawer-etikett, aria, footer-tagline, inline-
  // rubrik) kommer ur bransch-lagret — "Boka bord" hos en restaurang, "Boka
  // konsultation" hos en florist. Låg hårdkodat som "Boka tid" på fem ställen.
  const bokning = branschBokning(tenant.vertical_id)

  // goal-55 8A: bransch-styrd huvud-CTA i naven (config-first, aldrig if(bransch)).
  // Modul-gaten bor HÄR (layouten har moduleStates): pekar branschens CTA på en
  // modulsida vars modul inte är live → falla tillbaka till BookCta (null-prop).
  // Nav/NavShell får bara en färdig cta — eller null = dagens 'Boka tid' exakt.
  const rawPrimaryCta = await resolvePrimaryCta(tenant.vertical_id)
  const CTA_HREF_MODULE: Record<string, string> = {
    '/shop': 'shop',
    '/blogg': 'blogg',
    '/offert': 'offert',
    '/presentkort': 'presentkort',
    '/boka': 'booking',
    '/kurser': 'kurser',
  }
  const ctaModule = rawPrimaryCta
    ? CTA_HREF_MODULE[`/${rawPrimaryCta.href.split('/')[1] ?? ''}`]
    : undefined
  const primaryCta =
    rawPrimaryCta && (!ctaModule || moduleState(moduleStates, ctaModule) === 'live')
      ? rawPrimaryCta
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
  const navLinks = [
    { href: '/', label: 'Hem' },
    ...(cartEnabled ? [{ href: '/shop', label: 'Butik' }] : []),
    ...(allWizardServices.length > 0 ? [{ href: '/tjanster', label: 'Tjänster' }] : []),
    ...(moduleState(moduleStates, 'kurser') === 'live' &&
    (await loadUpcomingEvents(tenant.id, tenant.slug)).length > 0
      ? [{ href: '/kurser', label: 'Kurser' }]
      : []),
    ...(moduleState(moduleStates, 'blogg') === 'live' || moduleState(moduleStates, 'blogg') === 'paused'
      ? [{ href: '/blogg', label: 'Blogg' }]
      : []),
    ...(moduleState(moduleStates, 'offert') === 'live' || moduleState(moduleStates, 'offert') === 'paused'
      ? [{ href: '/offert', label: 'Offert' }]
      : []),
    ...(moduleState(moduleStates, 'presentkort') === 'live' ||
    moduleState(moduleStates, 'presentkort') === 'paused'
      ? [{ href: '/presentkort', label: 'Presentkort' }]
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
      <BookingProvider
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
