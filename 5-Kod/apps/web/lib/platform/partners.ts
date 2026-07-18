import 'server-only'
import type { Database } from '@corevo/db'
import { platformAdminCtx, platformCtx } from './guard'

export type PartnerSummary = Database['public']['Functions']['platform_partner_summaries']['Returns'][number]

export type PartnerTenantOption = {
  id: string
  name: string
  slug: string
  status: string
  partnerId: string | null
}

export type PartnerLicenseMonth = {
  month: string
  customers: number
  totalOre: number
  closed: boolean
}

export function throwIfPartnerReadFailed(
  code: 'partner_detail_unavailable' | 'partner_billing_unavailable',
  results: Array<{ error: unknown }>,
): void {
  if (results.some((result) => result.error)) throw new Error(code)
}

export async function loadPartnerSummaries(): Promise<PartnerSummary[]> {
  const { supabase } = await platformCtx()
  const { error: syncError } = await supabase.rpc('sync_partner_license_open_month')
  if (syncError) throw new Error('partner_license_sync_unavailable')
  const { data, error } = await supabase.rpc('platform_partner_summaries')
  if (error) throw new Error('partner_summaries_unavailable')
  return data ?? []
}

export async function loadPartnerAdminDetail(partnerId: string): Promise<{
  summary: PartnerSummary | null
  tenants: PartnerTenantOption[]
  history: PartnerLicenseMonth[]
  smsSender: string | null
}> {
  const { supabase } = await platformAdminCtx()
  const { error: syncError } = await supabase.rpc('sync_partner_license_open_month', {
    p_partner: partnerId,
  })
  if (syncError) throw new Error('partner_license_sync_unavailable')
  const [summaryResult, tenantsResult, licensesResult, smsResult] = await Promise.all([
    supabase.rpc('platform_partner_summaries'),
    supabase
      .from('tenants')
      .select('id, name, slug, status, partner_id')
      .order('name'),
    supabase
      .from('partner_license_months')
      .select('month, unit_price_ore, closed_at')
      .eq('partner_id', partnerId)
      .order('month', { ascending: false }),
    supabase
      .from('partner_sms_configs')
      .select('sender')
      .eq('partner_id', partnerId)
      .maybeSingle(),
  ])
  throwIfPartnerReadFailed('partner_detail_unavailable', [
    summaryResult,
    tenantsResult,
    licensesResult,
    smsResult,
  ])

  const byMonth = new Map<string, PartnerLicenseMonth>()
  for (const row of licensesResult.data ?? []) {
    const current = byMonth.get(row.month) ?? {
      month: row.month,
      customers: 0,
      totalOre: 0,
      closed: Boolean(row.closed_at),
    }
    current.customers += 1
    current.totalOre += row.unit_price_ore
    current.closed = current.closed && Boolean(row.closed_at)
    byMonth.set(row.month, current)
  }

  return {
    summary: (summaryResult.data ?? []).find((row) => row.partner_id === partnerId) ?? null,
    tenants: (tenantsResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      partnerId: row.partner_id,
    })),
    history: [...byMonth.values()],
    smsSender: smsResult.data?.sender ?? null,
  }
}

export async function loadOwnPartnerBilling(): Promise<{
  summary: PartnerSummary | null
  history: PartnerLicenseMonth[]
  smsSender: string | null
}> {
  const { supabase, scope } = await platformCtx()
  if (scope.kind !== 'partner') return { summary: null, history: [], smsSender: null }
  const { error: syncError } = await supabase.rpc('sync_partner_license_open_month', {
    p_partner: scope.partnerId,
  })
  if (syncError) throw new Error('partner_license_sync_unavailable')
  const [summaryResult, licensesResult, smsResult] = await Promise.all([
    supabase.rpc('platform_partner_summaries'),
    supabase
      .from('partner_license_months')
      .select('month, unit_price_ore, closed_at')
      .eq('partner_id', scope.partnerId)
      .order('month', { ascending: false }),
    supabase
      .from('partner_sms_configs')
      .select('sender')
      .eq('partner_id', scope.partnerId)
      .maybeSingle(),
  ])
  throwIfPartnerReadFailed('partner_billing_unavailable', [
    summaryResult,
    licensesResult,
    smsResult,
  ])
  const byMonth = new Map<string, PartnerLicenseMonth>()
  for (const row of licensesResult.data ?? []) {
    const current = byMonth.get(row.month) ?? {
      month: row.month,
      customers: 0,
      totalOre: 0,
      closed: Boolean(row.closed_at),
    }
    current.customers += 1
    current.totalOre += row.unit_price_ore
    current.closed = current.closed && Boolean(row.closed_at)
    byMonth.set(row.month, current)
  }
  return {
    summary: summaryResult.data?.[0] ?? null,
    history: [...byMonth.values()],
    smsSender: smsResult.data?.sender ?? null,
  }
}
