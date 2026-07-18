import type { CSSProperties, ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { requirePortal } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { injectTenantTokens } from '@corevo/ui'
import { getTenantBySlug, STOREFRONT_THEMES, type StorefrontTheme, type TenantBundle } from '@/lib/tenant-data'
import { THEME_CONTENT, resolveTenantCopy } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { Nav } from '@/components/brand/Nav'
import { NavShell } from '@/components/brand/NavShell'
import { Footer } from '@/components/brand/Footer'
import { FooterFull } from '@/components/brand/FooterFull'
import { BookingProvider } from '@/components/storefront/BookingProvider'
import { CartProvider } from '@/components/storefront/shop/CartProvider'
import { getWizardServices, getWizardLocations, getBookingPrefs } from '@/components/storefront/wizard-services'
import { InlineBooking } from '@/components/storefront/InlineBooking'
import { resolveStaffNoun } from '@/components/storefront/staff-noun'
import { branschBokning } from '@/components/storefront/bransch-copy'
import { resolvePrimaryCta } from '@/components/storefront/primary-cta'
import { getTenantModuleStates, moduleState } from '@/lib/tenant-modules'
import { loadUpcomingEvents } from '@/lib/storefront/kurser/load-kurser'
import { loadTeamMembers } from '@/lib/storefront/team/load-team'
import { themeChrome } from '@/components/storefront/layouts/florist/layouts'
import { commerceReleaseGate } from '@/lib/release/commerce'
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

/** goal-61 preview-parity: ärligt besked när en modulsida previewas men modulen är AV —
 *  den skarpa sidan hade gett 404, men i editorn är "varför ser jag inget?" en fråga
 *  som förtjänar ett svar, inte en krasch-sida. */
export function PreviewModuleOff({ moduleLabel }: { moduleLabel: string }) {
  return (
    <section className="section">
      <div className="section-inner" style={{ textAlign: 'center', padding: '64px 0' }}>
        <p role="status" style={{ font: '600 15px/1.5 var(--font-ui)', margin: 0 }}>
          Modulen {moduleLabel} är inte påslagen för den här kunden.
        </p>
        <p style={{ font: '400 13px/1.5 var(--font-ui)', opacity: 0.75, margin: '8px 0 0' }}>
          Slå på den under Drift-fliken så visas sidan här och på den publika sajten.
        </p>
      </div>
    </section>
  )
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
  const [allWizardServices, wizardLocations, staffNoun, bookingPrefs, teamMembers] = await Promise.all([
    getWizardServices(tenant.id, tenant.slug),
    getWizardLocations(tenant.id, tenant.slug),
    resolveStaffNoun(tenant.vertical_id),
    getBookingPrefs(tenant.id, tenant.slug),
    loadTeamMembers(tenant.id, tenant.slug),
  ])
  const wizardServices = bookingLive ? allWizardServices : []

  // Footer-taglinen ärar ägarens copy-override (temats standard annars) — samma
  // kontrakt som (public)/layout.
  // BRANSCH-REGELN: bokningens verb ur bransch-lagret (se (public)/layout.tsx).
  const bokning = branschBokning(tenant.vertical_id)
  const copy = await getTenantCopy(tenant.id, tenant.slug, tenant.vertical_id ?? null, theme)
  const tagline = resolveTenantCopy(theme, copy).tagline

  // goal-61 preview-parity: previewn bar tidigare ALLTID den delade Nav/Footer —
  // Zivar previewade calytrix och såg fel sidhuvud (samma bugg goal-60 fixade i
  // onboarding-studions StorefrontPreview, men Sida-flikens iframe missades).
  // Nu exakt samma chrome-dispatch + modul-gatade länklista + bransch-CTA som
  // app/(public)/layout.tsx. OBS: chromen följer ?theme= (previewens hela poäng).
  const chrome = themeChrome(theme)
  const commerceRelease = commerceReleaseGate(tenant.id)
  const shopState = moduleState(moduleStates, 'shop')
  const cartEnabled = commerceRelease.shop && (shopState === 'live' || shopState === 'paused')
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
    ...(commerceRelease.presentkort &&
    (moduleState(moduleStates, 'presentkort') === 'live' ||
    moduleState(moduleStates, 'presentkort') === 'paused')
      ? [{ href: '/presentkort', label: 'Presentkort' }]
      : []),
    // goal-64: klubben (/klubb) — samma modul-gate som publika layouten, annars visar
    // previewn en meny som inte är kundens.
    ...(moduleState(moduleStates, 'lojalitet') === 'live' ||
    moduleState(moduleStates, 'lojalitet') === 'paused'
      ? [{ href: '/klubb', label: 'Klubben' }]
      : []),
    ...(moduleState(moduleStates, 'galleri') === 'live' ||
    moduleState(moduleStates, 'galleri') === 'paused'
      ? [{ href: '/galleri', label: 'Galleri' }]
      : []),
    ...(teamMembers.length > 0 ? [{ href: '/team', label: 'Team' }] : []),
    { href: '/om', label: 'Om oss' },
    { href: '/kontakt', label: 'Kontakt' },
  ]
  // Bransch-CTA med samma modul-gate som layouten (peka aldrig på en död modulsida).
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
    rawPrimaryCta &&
    !(ctaModule === 'shop' && !commerceRelease.shop) &&
    !(ctaModule === 'presentkort' && !commerceRelease.presentkort) &&
    (!ctaModule || moduleState(moduleStates, ctaModule) === 'live')
      ? rawPrimaryCta
      : null

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
        bokaCta={bokning.cta}
        variant={settings.bookingVariant}
        pickerMode={bookingPrefs.pickerMode}
        staffAvatarMode={bookingPrefs.staffAvatarMode}
      >
        {/* CartProvider omsluter nav+main+footer (navens korg-knapp använder useCart) —
            samma ordning som (public)/layout. */}
        <CartProvider>
        {chrome.Nav ? (
          <NavShell
            customerAccountsEnabled={settings.customerAccountsEnabled}
            cartEnabled={cartEnabled}
            utilityText={themeBase.utility}
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
              utilityText={themeBase.utility}
            />
          </NavShell>
        ) : (
          <Nav
            tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
            branding={settings.branding}
            customerAccountsEnabled={settings.customerAccountsEnabled}
            cartEnabled={cartEnabled}
            utilityText={themeBase.utility}
            primaryCta={primaryCta}
            links={navLinks}
          />
        )}
        <main className={`tenant-main ${storefront.shellMain}`}>{children}</main>
        {wizardServices.length > 0 ? (
          <InlineBooking
            services={wizardServices}
            locations={wizardLocations}
            tenantName={tenant.name}
            staffNoun={staffNoun}
            bokaCta={bokning.cta}
            bokaOnline={bokning.online}
            pickerMode={bookingPrefs.pickerMode}
            staffAvatarMode={bookingPrefs.staffAvatarMode}
            previewControlled
          />
        ) : null}
        {chrome.Footer ? (
          <chrome.Footer
            tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
            tagline={tagline}
            location={location}
            contact={settings.contact}
            social={settings.social}
            links={navLinks}
          />
        ) : isFullFooter ? (
          <FooterFull
            tenant={{ name: tenant.name }}
            tagline={tagline}
            location={location}
            contact={settings.contact}
            social={settings.social}
          />
        ) : (
          <Footer tenant={{ name: tenant.name }} bokaOnline={bokning.online} />
        )}
        </CartProvider>
      </BookingProvider>
    </div>
  )
}
