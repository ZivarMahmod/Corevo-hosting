import 'server-only'
import { platformCtx } from './guard'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { monthlyFeeCents } from './billing'

// Platform-wide metrics + FLÖDE 2 faktureringsunderlag. All counts are cross-
// tenant via the platform_admin RLS bypass (platformCtx). The billing view is a
// READ-ONLY aid Zivar invoices manually from — no Stripe, no money movement.

const PLATFORM_TZ = 'Europe/Stockholm'

export type PlatformMetrics = {
  tenantsTotal: number
  tenantsActive: number
  tenantsSuspended: number
  bookingsTotal: number
}

export async function platformMetrics(): Promise<PlatformMetrics> {
  const { supabase } = await platformCtx()
  const [total, active, suspended, bookings] = await Promise.all([
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
  ])
  return {
    tenantsTotal: total.count ?? 0,
    tenantsActive: active.count ?? 0,
    tenantsSuspended: suspended.count ?? 0,
    bookingsTotal: bookings.count ?? 0,
  }
}

/** UTC [from, to) bounds of a calendar month in the platform timezone. */
export function monthRangeUtc(year: number, month1to12: number): { fromUtc: string; toUtc: string } {
  const mm = String(month1to12).padStart(2, '0')
  const nextY = month1to12 === 12 ? year + 1 : year
  const nextM = month1to12 === 12 ? 1 : month1to12 + 1
  const nmm = String(nextM).padStart(2, '0')
  return {
    fromUtc: zonedTimeToUtc(`${year}-${mm}-01`, '00:00', PLATFORM_TZ).toISOString(),
    toUtc: zonedTimeToUtc(`${nextY}-${nmm}-01`, '00:00', PLATFORM_TZ).toISOString(),
  }
}

export type BillingRow = {
  tenantId: string
  slug: string
  name: string
  status: string
  billingModel: string
  completedBookings: number
  perBookingFeeCents: number
  flatMonthlyFeeCents: number
  setupFeeCents: number
  feeCents: number
}

export type BillingUnderlag = {
  year: number
  month: number
  rows: BillingRow[]
  totalCents: number
}

/**
 * Per-tenant invoiceable amount for one calendar month:
 *   completed bookings (excl. cancelled/no_show) × per_booking fee, OR the flat
 *   monthly fee. One bookings query, tallied in JS (manual monthly view — volume
 *   is small; avoids a GROUP BY RPC).
 */
export async function billingUnderlag(year: number, month: number): Promise<BillingUnderlag> {
  const { supabase } = await platformCtx()
  const { fromUtc, toUtc } = monthRangeUtc(year, month)

  const [tenantsRes, bookingsRes] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, slug, name, status, tenant_settings(billing_model, per_booking_fee_cents, flat_monthly_fee_cents, setup_fee_cents)')
      .order('slug'),
    supabase
      .from('bookings')
      .select('tenant_id')
      .eq('status', 'completed')
      .gte('start_ts', fromUtc)
      .lt('start_ts', toUtc),
  ])

  const completedByTenant = new Map<string, number>()
  for (const b of (bookingsRes.data ?? []) as { tenant_id: string }[]) {
    completedByTenant.set(b.tenant_id, (completedByTenant.get(b.tenant_id) ?? 0) + 1)
  }

  type Settings = {
    billing_model: string
    per_booking_fee_cents: number
    flat_monthly_fee_cents: number
    setup_fee_cents: number
  }
  type TRow = {
    id: string
    slug: string
    name: string
    status: string
    tenant_settings: Settings | Settings[] | null
  }

  const rows: BillingRow[] = ((tenantsRes.data ?? []) as TRow[]).map((t) => {
    const ts = Array.isArray(t.tenant_settings) ? t.tenant_settings[0] : t.tenant_settings
    const billingModel = ts?.billing_model ?? 'per_booking'
    const perBookingFeeCents = ts?.per_booking_fee_cents ?? 0
    const flatMonthlyFeeCents = ts?.flat_monthly_fee_cents ?? 0
    const setupFeeCents = ts?.setup_fee_cents ?? 0
    const completedBookings = completedByTenant.get(t.id) ?? 0
    const feeCents = monthlyFeeCents({
      billingModel,
      completedBookings,
      perBookingFeeCents,
      flatMonthlyFeeCents,
    })
    return {
      tenantId: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      billingModel,
      completedBookings,
      perBookingFeeCents,
      flatMonthlyFeeCents,
      setupFeeCents,
      feeCents,
    }
  })

  const totalCents = rows.reduce((sum, r) => sum + r.feeCents, 0)
  return { year, month, rows, totalCents }
}
