import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { getDomainOverview } from '@/lib/platform/domain-overview'
import { PageHead } from '@/components/portal/ui'
import { DomainOverview } from '@/components/platform/DomainOverview'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Domäner' }

/**
 * Domäner — super-admin overview of every tenant's <slug>.boka.corevo.se + fixed
 * infra hosts (goal-32 F3). Self-gates with requirePlatformAdmin (the (platform)
 * layout also gates; getDomainOverview → platformCtx re-checks the role before the
 * cross-tenant read). Status is honest: 'live'/'cert pending' when the Cloudflare
 * Worker-Domains read is available, else 'managed' (DB-driven, re-asserted every
 * deploy). NEVER fakes a status.
 */
export default async function DomanerPage() {
  await requirePlatformAdmin()
  const overview = await getDomainOverview()

  return (
    <section className="portal-section">
      <PageHead
        eyebrow="Plattform"
        title="Domäner"
        lede="Varje kunds standardadress går genom samma isolerade wildcard-route. Nya kunder kräver ingen separat DNS- eller Cloudflare-koppling."
      />
      <DomainOverview overview={overview} />
    </section>
  )
}
