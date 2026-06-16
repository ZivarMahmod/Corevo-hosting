import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { getDomainOverview } from '@/lib/platform/domain-overview'
import { PageHead } from '@/components/portal/ui'
import { DomainOverview } from '@/components/platform/DomainOverview'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Domäner' }

/**
 * Domäner — super-admin overview of every salon's <slug>.corevo.se + the 3 fixed
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
        lede="Varje salongs subdomän kopplas automatiskt och re-asserteras vid varje deploy — en deploy kan aldrig ta ner en kundsida. Bara manuell radering tar bort en domän."
      />
      <DomainOverview overview={overview} />
    </section>
  )
}
