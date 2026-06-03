import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { listAuditLogAllTenants } from '@/lib/platform/audit'
import { getPlatformHealth } from '@/lib/platform/metrics'
import { DriftLog } from './DriftLog'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Drift & logg' }

export default async function DriftOchLoggPage() {
  // Self-gate: platform_admin only (layout also gates; re-check here per the goal).
  await requirePlatformAdmin()

  // One unfiltered cross-tenant read (RLS bypass via platformCtx); the client island
  // filters q + actor in memory exactly like the mock. getPlatformHealth has NO
  // backing telemetry → DriftLog renders the honest reason in a band, never a fake
  // live number.
  const entries = await listAuditLogAllTenants({}, 200)
  const health = getPlatformHealth()

  return (
    <section className="portal-section">
      <DriftLog entries={entries} healthReason={health.available ? null : health.reason} />
    </section>
  )
}
