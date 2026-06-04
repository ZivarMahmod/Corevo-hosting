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

// DORMANT — build-once-never-delete; ersatt av platformOverview. Radera ej.
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

/** Current calendar month in the platform timezone (1-12). Pure for testing. */
export function platformMonth(now: Date = new Date()): { year: number; month: number } {
  // Resolve the y/m in Europe/Stockholm (not the server's UTC) so the "denna
  // månad" window flips at local midnight, matching billingUnderlag's bounds.
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: PLATFORM_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  return { year, month }
}

export type PlatformOverview = {
  tenantsTotal: number
  tenantsActive: number
  tenantsSuspended: number
  bookingsThisMonth: number
  underlagCentsThisMonth: number
  year: number
  month: number
}

/**
 * The Översikt headline aggregates, bound LIVE (no mock numbers): salonger total +
 * aktiva, bokningar denna månad (count in the local-month UTC window), and
 * faktureringsunderlag denna månad (reuse billingUnderlag so the figure matches the
 * Fakturering page exactly). bookingsThisMonth counts every booking that STARTS in
 * the month (all statuses) — the "volume" signal — while the underlag only bills
 * completed bookings (per billingUnderlag).
 */
export async function platformOverview(now: Date = new Date()): Promise<PlatformOverview> {
  const { supabase } = await platformCtx()
  const { year, month } = platformMonth(now)
  const { fromUtc, toUtc } = monthRangeUtc(year, month)

  const [total, active, suspended, monthBookings, underlag] = await Promise.all([
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('start_ts', fromUtc)
      .lt('start_ts', toUtc),
    billingUnderlag(year, month),
  ])

  return {
    tenantsTotal: total.count ?? 0,
    tenantsActive: active.count ?? 0,
    tenantsSuspended: suspended.count ?? 0,
    bookingsThisMonth: monthBookings.count ?? 0,
    underlagCentsThisMonth: underlag.totalCents,
    year,
    month,
  }
}

// ── Booking-trend sparkline (Översikt §2.2) ─────────────────────────────────────
export type BookingTrendPoint = { year: number; month: number; count: number }

/**
 * Cross-tenant monthly booking counts for the last `months` calendar months
 * (oldest→newest, inclusive of the current month), in the platform timezone. LIVE +
 * honest: one ranged read bucketed in JS — a sparse DB yields mostly-zero points (a
 * flat sparkline tracking whatever real recent activity exists), NEVER a fabricated
 * upward curve like the mock's SU_TREND placeholder.
 */
export async function bookingTrend(
  months = 12,
  now: Date = new Date(),
): Promise<BookingTrendPoint[]> {
  const { supabase } = await platformCtx()
  const { year, month } = platformMonth(now)

  // Window start = first day of the month (months-1) back.
  let startY = year
  let startM = month - (months - 1)
  while (startM <= 0) {
    startM += 12
    startY -= 1
  }
  const { fromUtc } = monthRangeUtc(startY, startM)
  const { toUtc } = monthRangeUtc(year, month) // exclusive end = next month start

  const { data } = await supabase
    .from('bookings')
    .select('start_ts')
    .gte('start_ts', fromUtc)
    .lt('start_ts', toUtc)

  // Pre-seed the month buckets oldest→newest so the series is dense even with gaps.
  const buckets: BookingTrendPoint[] = []
  const index = new Map<string, number>()
  let y = startY
  let m = startM
  for (let i = 0; i < months; i++) {
    index.set(`${y}-${m}`, i)
    buckets.push({ year: y, month: m, count: 0 })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }

  for (const row of (data ?? []) as { start_ts: string }[]) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: PLATFORM_TZ,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date(row.start_ts))
    const ry = Number(parts.find((p) => p.type === 'year')?.value)
    const rm = Number(parts.find((p) => p.type === 'month')?.value)
    const k = index.get(`${ry}-${rm}`)
    const bucket = k !== undefined ? buckets[k] : undefined
    if (bucket) bucket.count += 1
  }
  return buckets
}

// ── Plattformshälsa (health pills, §2.3) ────────────────────────────────────────
// The mock shows API-uptid / Workers / DB-pool / Köade SMS pills with live-looking
// numbers (99,98% · 34% · 3). Those have NO backing telemetry source in this stack
// (no metrics pipeline wired) — so we NEVER fabricate a live number. This returns
// `available: false`; the view renders an honest static/empty pill (or omits them),
// never a fake "live" figure. When a telemetry source is wired later, populate the
// fields and flip `available`.
export type PlatformHealth = {
  available: false
  /** Why the live pills are unavailable — shown verbatim in the honest empty-state. */
  reason: string
}

export function getPlatformHealth(): PlatformHealth {
  return {
    available: false,
    reason: 'Ingen telemetri-källa kopplad — hälsovärden visas inte som live.',
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
