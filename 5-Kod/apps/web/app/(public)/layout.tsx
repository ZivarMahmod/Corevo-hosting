import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'
import { pickNav } from '@/components/brand/variants'
import { Footer } from '@/components/brand/Footer'

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
  const brandProps = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    branding: settings.branding,
  }
  const overrideCss = settings.customOverride?.css

  return (
    <div
      className="tenant-root"
      data-tenant={tenant.id}
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

      <Nav {...brandProps} customerAccountsEnabled={settings.customerAccountsEnabled} />
      <main className="tenant-main">{children}</main>
      <Footer tenant={{ name: tenant.name }} />
    </div>
  )
}
