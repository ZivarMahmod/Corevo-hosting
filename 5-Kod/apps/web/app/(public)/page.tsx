import { notFound } from 'next/navigation'
import { currentTenant, getServices } from '@/lib/tenant-data'
import { STOREFRONT_LAYOUTS } from '@/components/storefront/layouts'
import { resolveThemeContent } from '@/components/storefront/theme-content'

// Per-request, host-resolved tenant → never prerender.
export const dynamic = 'force-dynamic'

/**
 * Storefront home. The tenant's `settings.theme` selects one of five GENUINELY
 * DISTINCT layouts (Salvia/Leander/Zigge/Linnea/Edit) — not a token swap. Each
 * layout renders its own hero + sections; the chrome (nav + footer) lives in
 * app/(public)/layout.tsx. Owner-uploaded media (settings.branding.*) is merged
 * with strong per-theme defaults so an un-uploaded salon still looks complete.
 */
export default async function HomePage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings, location } = bundle

  const Layout = STOREFRONT_LAYOUTS[settings.theme]
  const content = resolveThemeContent(settings.theme, settings.branding)
  const services = await getServices(tenant.id, tenant.slug)

  return (
    <Layout
      tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
      theme={settings.theme}
      content={content}
      services={services}
      location={location}
    />
  )
}
