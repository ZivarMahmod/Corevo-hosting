import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'
import { pickNav, pickTemplate } from '@/components/brand/variants'
import { Footer } from '@/components/brand/Footer'
import storefront from '@/components/storefront/storefront.module.css'

// Per-request, host-resolved tenant theme → never prerender.
export const dynamic = 'force-dynamic'

// Full brand shell (nav + footer) — same composition as the (public) storefront
// layout. The /boka route AND the shareable /boka/bekraftelse/[id] receipt both
// render inside the real salon chrome, so a refresh/share of the confirmation is
// never a stripped page (⭐ in-page confirmation requirement). We omit the
// BookingProvider here: the standalone /boka route renders its own inline wizard,
// and Nav's "Boka tid" CTA falls back to a real <Link href="/boka"> when no
// provider is mounted — so no second/redundant drawer wizard appears.
export default async function BokaLayout({ children }: { children: React.ReactNode }) {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle

  const Nav = pickNav(settings.layout.nav_variant)
  const template = pickTemplate(settings.layout.nav_variant)
  const brandProps = {
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    branding: settings.branding,
  }
  const overrideCss = settings.customOverride?.css

  return (
    <div
      className={`tenant-root ${storefront.tplRoot}`}
      data-world="storefront"
      data-theme={settings.theme}
      data-tenant={tenant.id}
      data-template={template}
      style={injectTenantTokens(settings.branding) as CSSProperties}
    >
      {/* Nivå 3 — tenant-isolated custom CSS, scoped under [data-tenant]. */}
      {overrideCss ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `[data-tenant="${tenant.id}"]{${overrideCss}}`,
          }}
        />
      ) : null}

      <Nav {...brandProps} customerAccountsEnabled={settings.customerAccountsEnabled} />
      {/* `.shellMain` reserves space for the fixed top cluster (--nav-h). Safe on
          these non-hero pages — only adds whitespace below the fixed nav. */}
      <main className={`tenant-main ${storefront.shellMain}`}>{children}</main>
      <Footer tenant={{ name: tenant.name }} />
    </div>
  )
}
