// S0 sajtbyggare spike — flag-gated render surface (NOT a public tenant storefront).
//
// Lives OUTSIDE the (public) route group on purpose: (public) resolves the tenant
// from the Host header, which has no tenant on the staging *.workers.dev preview
// surface. Here we resolve the tenant EXPLICITLY by slug param, so the spike works
// on the deployed Workers runtime without a tenant subdomain or a cert.
//
// Gated by SAJTBYGGARE_ENABLED (read at call-time): OFF in prod → notFound() →
// zero new public surface. ON only on the staging worker.
//
// F1 (render-bron): import ONE restoran page as data → render on the real Workers
// deploy path → weave the REAL booking module at the <corevo-module> marker via
// html-react-parser, with the template's own CSS, scoped under [data-tenant].
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTenantBySlug } from '@/lib/tenant-data'
import { sajtbyggareEnabled } from '@/lib/sajtbyggare/flag'
import { BookingMount } from '@/lib/sajtbyggare/booking-mount'
import { renderTemplate } from '@/lib/sajtbyggare/render-bridge'
import { RESTORAN_PAGE_HTML, RESTORAN_CSS_HREFS } from '@/lib/sajtbyggare/templates/restoran'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sajtbyggare S0 — restoran-spike' }

export default async function SajtbyggareSpikePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  if (!sajtbyggareEnabled()) notFound() // off in prod → zero public surface
  const { slug } = await params
  const bundle = await getTenantBySlug(slug)
  if (!bundle) notFound()
  const { tenant } = bundle

  // Preloaded module node (async server component loads its own DB data when React
  // renders it) → handed to the bridge, which places it at the booking marker.
  const booking = <BookingMount tenantId={tenant.id} slug={tenant.slug} />

  return (
    <>
      {RESTORAN_CSS_HREFS.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      {/* The imported template is wrapped in a [data-tenant] root. Full CSS
          isolation (prefixing Bootstrap under the scope) is a per-template
          onboarding cost measured in F3 — for the spike the vendor CSS loads
          page-level on this standalone surface, which is faithful. */}
      <div data-tenant={tenant.id} data-world="sajtbyggare-spike" className="corevo-tpl-scope">
        {renderTemplate(RESTORAN_PAGE_HTML, { booking })}
      </div>
    </>
  )
}
