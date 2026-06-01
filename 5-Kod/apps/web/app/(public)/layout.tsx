import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'
import { pickNav, pickTemplate } from '@/components/brand/variants'
import { Footer } from '@/components/brand/Footer'
import { BookingProvider } from '@/components/storefront/BookingProvider'
import { getWizardServices } from '@/components/storefront/wizard-services'
import storefront from '@/components/storefront/storefront.module.css'

// Per-request, host-resolved tenant → never prerender.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const bundle = await currentTenant()
  if (!bundle) return { title: 'Salong' }
  const { tenant } = bundle
  const description = `Boka tid hos ${tenant.name} online.`
  return {
    title: { default: tenant.name, template: `%s · ${tenant.name}` },
    description,
    openGraph: { title: tenant.name, description, type: 'website' },
  }
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const bundle = await currentTenant()
  if (!bundle) notFound() // unknown / reserved / platform / root host → 404
  const { tenant, settings } = bundle

  const Nav = pickNav(settings.layout.nav_variant)
  const template = pickTemplate(settings.layout.nav_variant)
  const brandProps = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    branding: settings.branding,
  }
  const overrideCss = settings.customOverride?.css

  // Services shaped for the embedded booking wizard — same join as /boka, cached.
  const wizardServices = await getWizardServices(tenant.id, tenant.slug)

  return (
    <div
      className={`tenant-root ${storefront.tplRoot}`}
      data-tenant={tenant.id}
      data-template={template}
      style={injectTenantTokens(settings.branding) as CSSProperties}
    >
      {/* Nivå 3 — tenant-isolated custom CSS. Emitted ONLY for tenants that have
          an override, and physically scoped under [data-tenant="<id>"] via CSS
          nesting, so it can never match another tenant's subtree. */}
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
      <BookingProvider services={wizardServices} tenantName={tenant.name}>
        <Nav {...brandProps} customerAccountsEnabled={settings.customerAccountsEnabled} />
        {/* `.shellMain` reserves space for the fixed top cluster (--nav-h). The
            home hero cancels it exactly with a negative margin, so the hero photo
            still meets the viewport top under the nav. */}
        <main className={`tenant-main ${storefront.shellMain}`}>{children}</main>
        <Footer tenant={{ name: tenant.name }} />
      </BookingProvider>
    </div>
  )
}
