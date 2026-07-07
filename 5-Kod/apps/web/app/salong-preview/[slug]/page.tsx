import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { injectTenantTokens } from '@corevo/ui'
import { getTenantBySlug, getServices } from '@/lib/tenant-data'
import { STOREFRONT_LAYOUTS } from '@/components/storefront/layouts'
import { resolveThemeContent } from '@/components/storefront/theme-content'
import { getTenantCopy } from '@/components/storefront/tenant-copy'
import { SidaPreviewBridge } from '@/components/platform/SidaPreviewBridge'
import storefront from '@/components/storefront/storefront.module.css'

// Super-admin LIVE STOREFRONT PREVIEW — the iframe target for the Sida tab on
// /salonger/[id]. This renders the tenant's REAL storefront (same STOREFRONT_LAYOUTS
// + resolveThemeContent the public page uses — NOT the parked content_slots store) but
// SAME-ORIGIN on the platform host, so it can be framed by /salonger/[id] under the
// existing `frame-ancestors 'self'` header variant (see next.config.ts) — the public
// storefront on <slug>.corevo.se is cross-origin and blocked by X-Frame-Options DENY.
//
// Deliberately slim vs app/(public): no Nav/Footer/BookingProvider chrome and no
// StorefrontModuleSections — this previews what the Sida editor actually changes
// (theme + branding tokens + copy + hero/gallery photos). The theme Layouts are pure
// server components and useBooking() returns null without a provider (no throw), so the
// "Boka tid" CTAs render inert — correct for a preview. Root layout supplies the fonts
// + tokens.css. Platform-gated; force-dynamic (per-tenant, never prerendered).
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Förhandsvisning', robots: { index: false } }

export default async function SalongPreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await requirePlatformAdmin() // same-origin iframe → platform session cookie flows
  const { slug } = await params
  const bundle = await getTenantBySlug(slug)
  if (!bundle) notFound() // unknown / suspended (public client sees active only)
  const { tenant, settings, location } = bundle

  const Layout = STOREFRONT_LAYOUTS[settings.theme]
  const copy = await getTenantCopy(tenant.id, tenant.slug)
  const content = resolveThemeContent(settings.theme, settings.branding, copy)
  const services = await getServices(tenant.id, tenant.slug)

  return (
    <div
      className={`tenant-root ${storefront.tplRoot}`}
      data-world="storefront"
      data-theme={settings.theme}
      data-tenant={tenant.id}
      style={injectTenantTokens(settings.branding) as CSSProperties}
    >
      <SidaPreviewBridge />
      <Layout
        tenant={{ id: tenant.id, name: tenant.name, slug: tenant.slug }}
        theme={settings.theme}
        content={content}
        services={services}
        location={location}
      />
    </div>
  )
}
