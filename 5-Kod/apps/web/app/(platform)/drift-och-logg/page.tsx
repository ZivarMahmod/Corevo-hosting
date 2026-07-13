import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { listAuditLogAllTenants } from '@/lib/platform/audit'
import { DriftLog } from './DriftLog'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Drift & logg' }

export default async function DriftOchLoggPage() {
  // Self-gate: platform_admin only (layout also gates; re-check here per the goal).
  await requirePlatformAdmin()

  // One unfiltered cross-tenant read (RLS bypass via platformCtx); the client island
  // filters q + actor in memory. Telemetry is omitted until a real source exists.
  const entries = await listAuditLogAllTenants({}, 200)

  return (
    <section className="portal-section">
      <DriftLog entries={entries} />
    </section>
  )
}
