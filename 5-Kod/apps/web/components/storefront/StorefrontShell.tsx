import type { CSSProperties, ReactNode } from 'react'
import { injectTenantTokens } from '@corevo/ui'
import type { WizardService } from '@/components/booking/BookingWizard'
import { Nav } from '@/components/brand/Nav'
import { NavShell } from '@/components/brand/NavShell'
import { Footer } from '@/components/brand/Footer'
import { FooterFull } from '@/components/brand/FooterFull'
import { SidaPreviewBridge } from '@/components/platform/SidaPreviewBridge'
import { RealtimeTenantModulesLazy } from '@/components/realtime/RealtimeTenantModulesLazy'
import type { StorefrontTheme, TenantBundle } from '@/lib/tenant-data'
import { getTenantModuleStates, moduleState, type TenantModuleStates } from '@/lib/tenant-modules'
import type { PrimaryCta } from './primary-cta'
import type { LayoutModuleTeasers } from './layouts/types'
import { BookingProvider } from './BookingProvider'
import { CookieConsent } from './CookieConsent'
import { InlineBooking } from './InlineBooking'
import { branschBokning } from '@/lib/storefront/bransch-copy'
import { themeChrome } from './layouts/runtime'
import { freshCutNavigationLinks } from './layouts/FreshCutChrome'
import { loadLayoutModuleTeasers, withLegacyExternalBooking } from './layouts/load-module-teasers'
import {
  canonicalModuleHref,
  moduleNavigationLinks,
  moduleRouteReachable,
} from './layouts/module-navigation'
import { resolvePrimaryCta } from './primary-cta'
import { LocalBusinessJsonLd } from './seo'
import { resolveStaffNoun } from '@/lib/storefront/staff-noun'
import { CartProvider } from './shop/CartProvider'
import { getTenantCopy } from '@/lib/storefront/tenant-copy'
import { THEME_CONTENT, resolveTenantCopy } from '@/lib/storefront/theme-content'
import { getBookingPrefs, getWizardLocations, getWizardServices } from './wizard-services'
import { countTeamMembers } from '@/lib/storefront/team/load-team'
import storefront from './storefront.module.css'

export type StorefrontSurface = 'public' | 'preview'

type StorefrontShellViewInput = {
  surface: StorefrontSurface
  theme: StorefrontTheme
  moduleStates: TenantModuleStates
  layoutModules: LayoutModuleTeasers
  allWizardServices: WizardService[]
  teamCount: number
  rawPrimaryCta: PrimaryCta | null
  bookingLegacyExternal: boolean
  bookingVariant: TenantBundle['settings']['bookingVariant']
}

export function deriveStorefrontShellView({
  surface,
  theme,
  moduleStates,
  layoutModules,
  allWizardServices,
  teamCount,
  rawPrimaryCta,
  bookingLegacyExternal,
  bookingVariant,
}: StorefrontShellViewInput) {
  const bookingReachable = moduleState(moduleStates, 'booking') === 'live' || bookingLegacyExternal
  const effectiveLayoutModules = withLegacyExternalBooking(layoutModules, bookingLegacyExternal)
  const wizardServices = bookingReachable ? allWizardServices : []
  const moduleLinks = moduleNavigationLinks(effectiveLayoutModules)
  const navLinks = [
    { href: '/', label: 'Hem' },
    ...moduleLinks.filter((link) => link.href === '/shop'),
    ...(allWizardServices.length > 0 ? [{ href: '/tjanster', label: 'Tjänster' }] : []),
    ...moduleLinks.filter((link) => link.href !== '/shop'),
    ...(teamCount > 0 ? [{ href: '/team', label: 'Team' }] : []),
    { href: '/om', label: 'Om oss' },
    { href: '/kontakt', label: 'Kontakt' },
  ]
  const primaryCta =
    rawPrimaryCta &&
    moduleRouteReachable(rawPrimaryCta.href, effectiveLayoutModules, bookingReachable)
      ? { ...rawPrimaryCta, href: canonicalModuleHref(rawPrimaryCta.href) }
      : null

  return {
    bookingReachable,
    effectiveLayoutModules,
    wizardServices,
    cartEnabled: layoutModules.shopReachable,
    primaryCta,
    shellNavLinks: theme === 'freshcut' ? freshCutNavigationLinks(navLinks) : navLinks,
    inlineBooking: {
      mounted: wizardServices.length > 0 && (surface === 'preview' || bookingVariant === 'inline'),
      previewControlled: surface === 'preview',
    },
  }
}

type StorefrontShellProps = {
  bundle: TenantBundle
  children: ReactNode
} & (
  | { surface: 'public'; theme?: never; copyMode?: never; embeddedBooking?: boolean }
  | {
      surface: 'preview'
      theme: StorefrontTheme
      copyMode: 'keep' | 'template' | null
      embeddedBooking?: never
    }
)

/** The single server owner for public and editor-preview storefront chrome. */
export async function StorefrontShell(props: StorefrontShellProps) {
  const { bundle, children, surface } = props
  const { tenant, settings, location } = bundle
  const theme = surface === 'preview' ? props.theme : settings.theme
  const copyMode = surface === 'preview' ? props.copyMode : null
  const embeddedBooking = surface === 'preview' ? true : props.embeddedBooking !== false
  const [
    copy,
    moduleStates,
    allWizardServices,
    wizardLocations,
    bookingPrefs,
    staffNoun,
    rawPrimaryCta,
    teamCount,
    layoutModules,
  ] = await Promise.all([
    getTenantCopy(bundle, surface === 'preview' ? theme : null, copyMode),
    getTenantModuleStates(tenant.id, tenant.slug),
    getWizardServices(tenant.id, tenant.slug),
    getWizardLocations(tenant.id, tenant.slug),
    getBookingPrefs(tenant.id, tenant.slug),
    resolveStaffNoun(tenant.vertical_id),
    resolvePrimaryCta(tenant.vertical_id),
    countTeamMembers(tenant.id, tenant.slug),
    loadLayoutModuleTeasers(tenant.id, tenant.slug),
  ])
  const view = deriveStorefrontShellView({
    surface,
    theme,
    moduleStates,
    layoutModules,
    allWizardServices,
    teamCount,
    rawPrimaryCta,
    bookingLegacyExternal: settings.bookingLegacyExternal,
    bookingVariant: settings.bookingVariant,
  })
  const content = {
    utility: THEME_CONTENT[theme].utility,
    tagline: resolveTenantCopy(theme, copy).tagline,
  }
  const bokning = branschBokning(tenant.vertical_id)
  const chrome = themeChrome(theme)
  const tenantIdentity = { id: tenant.id, name: tenant.name, slug: tenant.slug }
  const isFullFooter = theme === 'salvia' || theme === 'freshcut'
  const shell = (
    <CartProvider>
      {chrome.Nav ? (
        <NavShell
          customerAccountsEnabled={settings.customerAccountsEnabled}
          cartEnabled={view.cartEnabled}
          utilityText={content.utility}
          hideUtility={chrome.ownsUtility}
          links={view.shellNavLinks}
          primaryCta={view.primaryCta}
        >
          <chrome.Nav
            tenant={tenantIdentity}
            branding={settings.branding}
            links={view.shellNavLinks}
            primaryCta={view.primaryCta}
            cartEnabled={view.cartEnabled}
            customerAccountsEnabled={settings.customerAccountsEnabled}
            utilityText={content.utility}
            location={location}
            contact={settings.contact}
          />
        </NavShell>
      ) : (
        <Nav
          tenant={tenantIdentity}
          branding={settings.branding}
          customerAccountsEnabled={settings.customerAccountsEnabled}
          cartEnabled={view.cartEnabled}
          utilityText={content.utility}
          primaryCta={view.primaryCta}
          links={view.shellNavLinks}
        />
      )}
      <main className={`tenant-main ${storefront.shellMain}`}>{children}</main>
      {embeddedBooking && view.inlineBooking.mounted ? (
        <InlineBooking
          services={view.wizardServices}
          locations={wizardLocations}
          tenantName={tenant.name}
          staffNoun={staffNoun}
          bokaCta={bokning.cta}
          bokaOnline={bokning.online}
          pickerMode={bookingPrefs.pickerMode}
          staffAvatarMode={bookingPrefs.staffAvatarMode}
          countryCode={settings.countryCode}
          locale={settings.locale}
          currency={settings.currency}
          defaultTimeZone={settings.defaultTimeZone}
          previewControlled={view.inlineBooking.previewControlled}
        />
      ) : null}
      {chrome.Footer ? (
        <chrome.Footer
          tenant={tenantIdentity}
          tagline={content.tagline}
          location={location}
          contact={settings.contact}
          social={settings.social}
          links={view.shellNavLinks}
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
      {surface === 'public' && settings.cookieBannerEnabled ? <CookieConsent /> : null}
    </CartProvider>
  )

  return (
    <div
      className={`tenant-root ${storefront.tplRoot}`}
      data-world="storefront"
      data-theme={theme}
      data-tenant={tenant.id}
      style={injectTenantTokens(settings.branding) as CSSProperties}
    >
      {surface === 'public' ? (
        <>
          <RealtimeTenantModulesLazy tenantId={tenant.id} />
          <LocalBusinessJsonLd
            name={tenant.name}
            location={location}
            contact={settings.contact}
            logoUrl={settings.branding.logo_url ?? null}
          />
        </>
      ) : (
        <SidaPreviewBridge />
      )}
      {embeddedBooking ? (
        <BookingProvider
          reachable={view.bookingReachable}
          provider={settings.bookingProvider}
          externalUrl={settings.bookingExternalUrl}
          externalCtaUrls={settings.bookingExternalCtaUrls}
          services={view.wizardServices}
          locations={wizardLocations}
          tenantName={tenant.name}
          staffNoun={staffNoun}
          bokaCta={bokning.cta}
          variant={settings.bookingVariant}
          pickerMode={bookingPrefs.pickerMode}
          staffAvatarMode={bookingPrefs.staffAvatarMode}
          countryCode={settings.countryCode}
          locale={settings.locale}
          currency={settings.currency}
          defaultTimeZone={settings.defaultTimeZone}
        >
          {shell}
        </BookingProvider>
      ) : (
        shell
      )}
    </div>
  )
}
