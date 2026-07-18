import type { Metadata } from 'next'
import type { Database } from '@corevo/db'
import { requirePlatformAdmin } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { UtskickCenter, type UtskickFilters } from './UtskickCenter'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Utskick' }

type SearchParams = {
  tenant?: string
  channel?: string
  status?: string
  category?: string
}

export default async function UtskickPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePlatformAdmin()

  const sp = await searchParams
  const filters: UtskickFilters = {
    tenant: clean(sp.tenant),
    channel: clean(sp.channel),
    status: clean(sp.status),
    category: clean(sp.category),
  }
  const rowArgs: Database['public']['Functions']['platform_outbox_rows']['Args'] = {
    p_limit: 100,
  }
  if (filters.tenant) rowArgs.p_tenant = filters.tenant
  if (filters.channel) rowArgs.p_channel = filters.channel
  if (filters.status) rowArgs.p_status = filters.status
  if (filters.category) rowArgs.p_category = filters.category

  const supabase = await createClient()
  const [summaryResult, rowsResult] = await Promise.all([
    supabase.rpc('platform_outbox_summary'),
    supabase.rpc('platform_outbox_rows', rowArgs),
  ])

  return (
    <section className="portal-section">
      <UtskickCenter
        summary={summaryResult.error ? null : (summaryResult.data ?? [])}
        rows={rowsResult.error ? null : (rowsResult.data ?? [])}
        filters={filters}
        summaryError={Boolean(summaryResult.error)}
        rowsError={Boolean(rowsResult.error)}
      />
    </section>
  )
}

function clean(value: string | undefined): string {
  return value?.trim() ?? ''
}
