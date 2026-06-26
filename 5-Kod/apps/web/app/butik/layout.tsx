import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import { injectTenantTokens } from '@corevo/ui'
import { currentTenant } from '@/lib/tenant-data'
import { pickNav, pickTemplate } from '@/components/brand/variants'
import { Footer } from '@/components/brand/Footer'
import { CartProvider } from '@/components/storefront/shop/CartProvider'
import { CartButton } from '@/components/storefront/shop/CartButton'
import { CookieConsent } from '@/components/storefront/CookieConsent'
import storefront from '@/components/storefront/storefront.module.css'

// Per-request, host-resolved tenant theme → never prerender.
export const dynamic = 'force-dynamic'

// Webshop köp-räls (goal-49) — kassa + delad orderbekräftelse renderas i den riktiga
// salongs-chromen (nav + footer), exakt som /boka. CartProvider wrappar så kassan
// läser klient-varukorgen (samma localStorage som storefront-startsidan).
export default async function ButikLayout({ children }: { children: React.ReactNode }) {
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
      {overrideCss ? (
        <style dangerouslySetInnerHTML={{ __html: `[data-tenant="${tenant.id}"]{${overrideCss}}` }} />
      ) : null}

      <Nav {...brandProps} customerAccountsEnabled={settings.customerAccountsEnabled} />
      <CartProvider>
        <main className={`tenant-main ${storefront.shellMain}`}>{children}</main>
        <CartButton />
      </CartProvider>
      <Footer tenant={{ name: tenant.name }} />
      {settings.cookieBannerEnabled ? <CookieConsent /> : null}
    </div>
  )
}
