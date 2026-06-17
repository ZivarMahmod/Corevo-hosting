// Sajtbyggare S2 — draft-preview route (LÅST-B).
//
// Renderar den RIKTIGA storefronten med UTKASTS-värden, same-origin. Editorns
// <iframe> pekar hit med ?draft=<encodeDraft(draft)>; vi avkodar utkastet, lägger
// det ÖVER de sparade värdena (via den testade, sanerande apply-kärnan) och
// rendererar EXAKT samma komposition som app/(public)/layout.tsx +
// app/(public)/page.tsx — aldrig en iframe av den publika live-URL:en.
//
// Gated på SAJTBYGGARE_ENABLED (läses vid anrop): AV i prod → notFound() → noll
// ny publik yta. Endast `salvia` är redigerbar i S2; alla andra teman → notFound().
//
// Tenant resolvas EXPLICIT via slug (inte via Host-header), så preview funkar på
// staging-workern utan en tenant-subdomän/cert — samma mönster som spike-[slug].
import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { injectTenantTokens } from '@corevo/ui'
import type { TenantBranding } from '@corevo/ui'
import { getTenantBySlug, getServices } from '@/lib/tenant-data'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { SALVIA_REGION_MANIFEST } from '@/lib/sajtbyggare/manifest/salvia'
import { applySiteContentEdits } from '@/lib/sajtbyggare/site-content-edit'
import { decodeDraft } from '@/lib/sajtbyggare/editor/draft-url'
import { Nav } from '@/components/brand/Nav'
import { FooterFull } from '@/components/brand/FooterFull'
import { BookingProvider } from '@/components/storefront/BookingProvider'
import { STOREFRONT_LAYOUTS } from '@/components/storefront/layouts'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import type { CopyOverride } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { getWizardServices, getWizardLocations } from '@/components/storefront/wizard-services'
import { getTenantModuleStates, moduleState } from '@/lib/tenant-modules'
import storefront from '@/components/storefront/storefront.module.css'

// Per-request, slug-resolverad preview → aldrig prerender.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sajtbyggare — förhandsvisning' }

export default async function SajtbyggarePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ draft?: string }>
}) {
  if (!sajtbyggareEnabled()) notFound() // av i prod → noll publik yta

  const { slug } = await params
  const bundle = await getTenantBySlug(slug)
  if (!bundle) notFound()
  const { tenant, settings, location } = bundle
  // Nivå 3 — tenantens egna scoped CSS-override (samma som (public)/layout.tsx) så
  // previewen visar exakt det live-utseendet, inte bara temadefault.
  const overrideCss = settings.customOverride?.css

  // Endast salvia är redigerbar i S2. Allt annat → 404 (ingen preview-yta).
  if (settings.theme !== 'salvia') notFound()

  // Sparad ägar-copy (M2-sidan av copy-kontraktet — settings.copy).
  const savedCopy = await getTenantCopy(tenant.id, tenant.slug)

  // Avkoda utkastet ur query-strängen (malformat/oversize → tomt utkast → sparade
  // värden visas, kastar aldrig).
  const draft = decodeDraft((await searchParams).draft)
  const edits = Object.entries(draft).map(([regionKey, value]) => ({ regionKey, value }))

  // Lägg utkastet ÖVER sparat via den testade, sanerande, fail-closed kärnan. En
  // dålig region → applied.ok=false → vi faller tillbaka till de sparade värdena
  // (ingen halv-sanerad preview).
  const applied = applySiteContentEdits(
    SALVIA_REGION_MANIFEST,
    { copy: savedCopy },
    settings.branding as unknown as Record<string, unknown>,
    edits,
  )
  const draftBranding: Record<string, unknown> = applied.ok
    ? applied.branding
    : (settings.branding as unknown as Record<string, unknown>)
  const draftCopy: CopyOverride | null = applied.ok
    ? ((applied.settings.copy as CopyOverride | undefined) ?? savedCopy)
    : savedCopy

  // Resolva temainnehållet ur utkasts-branding + utkasts-copy (per-fält: ägar-
  // override vinner, annars temadefault — exakt som den riktiga storefronten).
  const content = resolveThemeContent('salvia', draftBranding as TenantBranding, draftCopy)

  // Tjänster + bokningsdata — samma laddning som (public)/page.tsx och layout.tsx.
  const services = await getServices(tenant.id, tenant.slug)
  const [allWizardServices, wizardLocations, moduleStates] = await Promise.all([
    getWizardServices(tenant.id, tenant.slug),
    getWizardLocations(tenant.id, tenant.slug),
    getTenantModuleStates(tenant.id, tenant.slug),
  ])
  // Booking-gate EXAKT som (public)/layout.tsx: bara LIVE booking ger riktiga tjänster
  // → BookingProvider.available speglar om bokning faktiskt är aktiv (annars inerta CTA:er),
  // så previewen ljuger inte om bokningsläget.
  const bookingLive = moduleState(moduleStates, 'booking') === 'live'
  const wizardServices = bookingLive ? allWizardServices : []

  const Layout = STOREFRONT_LAYOUTS['salvia']

  // Speglar (public)/layout.tsx-kompositionen EXAKT: tenant-root med world/theme/
  // tenant-attribut + inline-injicerade utkasts-tokens, BookingProvider runt hela
  // skalet, themed Nav, .shellMain med salvia-layouten, och den rika FooterFull.
  return (
    <div
      className={`tenant-root ${storefront.tplRoot}`}
      data-world="storefront"
      data-theme="salvia"
      data-tenant={tenant.id}
      style={injectTenantTokens(draftBranding as TenantBranding) as CSSProperties}
    >
      {/* Nivå 3 tenant-scoped CSS — speglar (public)/layout.tsx exakt (samma admin-satta
          override, scopad under [data-tenant]); inget nytt XSS-yta (saneras ej i prod heller). */}
      {overrideCss ? (
        <style dangerouslySetInnerHTML={{ __html: `[data-tenant="${tenant.id}"]{${overrideCss}}` }} />
      ) : null}
      <BookingProvider services={wizardServices} locations={wizardLocations} tenantName={tenant.name}>
        <Nav
          tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
          branding={draftBranding as TenantBranding}
          customerAccountsEnabled={settings.customerAccountsEnabled}
          utilityText={content.utility}
        />
        <main className={`tenant-main ${storefront.shellMain}`}>
          <Layout
            tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
            theme="salvia"
            content={content}
            services={services}
            location={location}
          />
          {/* v0-scope: modul-sektioner (shop/offert/blogg/lojalitet/presentkort)
              renderas INTE i preview — ligger utanför S2-utkasts-modellen (de
              redigeras inte via region-manifestet). Endast tema-layouten + chrome. */}
        </main>
        <FooterFull
          tenant={{ name: tenant.name }}
          tagline={content.tagline}
          location={location}
          contact={settings.contact}
        />
      </BookingProvider>
    </div>
  )
}
