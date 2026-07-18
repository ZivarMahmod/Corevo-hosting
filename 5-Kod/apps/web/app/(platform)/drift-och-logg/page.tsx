import type { Metadata } from 'next'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { listAuditLogAllTenants } from '@/lib/platform/audit'
import { createClient } from '@/lib/supabase/server'
import { DriftLog } from './DriftLog'
import { DriftHealth, type CronHealthRow } from './DriftHealth'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Drift & logg' }

async function readCronHealth(): Promise<CronHealthRow[] | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('platform_cron_health')
    return error ? null : (data ?? [])
  } catch {
    // Keep the independent, already-existing audit log readable if this RPC is unavailable.
    return null
  }
}

export default async function DriftOchLoggPage() {
  // Self-gate: platform_admin only (layout also gates; re-check here per the goal).
  await requirePlatformAdmin()

  // One unfiltered cross-tenant read (RLS bypass via platformCtx); the client island
  // filters q + actor in memory. Telemetry is omitted until a real source exists.
  const [entries, cronHealth] = await Promise.all([
    listAuditLogAllTenants({}, 200),
    readCronHealth(),
  ])

  return (
    <section className="portal-section">
      <DriftHealth rows={cronHealth} />
      <DriftLog entries={entries} />
    </section>
  )
}
