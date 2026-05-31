import 'server-only'
import type { Tables } from '@corevo/db'
import type { TenantBranding } from '@corevo/ui'
import { createClient } from '@/lib/supabase/server'

// Every read here runs through the cookie-bound authenticated client, so RLS
// (0002: tenant_id = private.tenant_id()) fences it to the admin's own tenant.
// We ALSO pass tenant_id explicitly — defence-in-depth + stable ordering, and it
// mirrors the public data layer's app-side scoping.

export type ServiceRow = Tables<'services'>
export type StaffRow = Tables<'staff'>
export type LocationRow = Tables<'locations'>
export type SettingsRow = Tables<'tenant_settings'>
export type DomainRow = Tables<'tenant_domains'>
export type WorkingHourRow = Tables<'working_hours'>

export type StaffWithServices = StaffRow & { serviceIds: string[]; displayName: string }

export type AdminBooking = {
  id: string
  startTs: string
  endTs: string
  status: string
  priceCents: number | null
  note: string | null
  staffId: string
  serviceName: string
  staffTitle: string
}

export type BookingFilters = {
  fromUtc?: string
  toUtc?: string
  staffId?: string
  status?: string
}

/** All services (active + inactive), grouped sensibly for the admin table. */
export async function listServices(tenantId: string): Promise<ServiceRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('active', { ascending: false })
    .order('category', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true })
  return data ?? []
}

/** Staff with the set of service ids each one performs (staff_services join). */
export async function listStaff(tenantId: string): Promise<StaffWithServices[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('staff')
    .select('*, staff_services(service_id)')
    .eq('tenant_id', tenantId)
    .order('active', { ascending: false })
    .order('created_at', { ascending: true })
  return (data ?? []).map((s) => {
    const { staff_services, ...row } = s as StaffRow & {
      staff_services: { service_id: string }[] | null
    }
    return {
      ...row,
      serviceIds: (staff_services ?? []).map((x) => x.service_id),
      displayName: row.title?.trim() || 'Namnlös medarbetare',
    }
  })
}

export async function listLocations(tenantId: string): Promise<LocationRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('locations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function getSettingsRow(tenantId: string): Promise<SettingsRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data ?? null
}

export function brandingOf(row: SettingsRow | null): TenantBranding {
  return (row?.branding ?? {}) as TenantBranding
}

export async function listDomains(tenantId: string): Promise<DomainRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('tenant_domains')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_primary', { ascending: false })
  return data ?? []
}

export async function listWorkingHours(
  tenantId: string,
  staffId: string,
): Promise<WorkingHourRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('working_hours')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })
  return data ?? []
}

/** Tenant bookings with service name + staff title, filtered + chronological. */
export async function listBookings(
  tenantId: string,
  filters: BookingFilters = {},
): Promise<AdminBooking[]> {
  const supabase = await createClient()
  let q = supabase
    .from('bookings')
    .select('id, start_ts, end_ts, status, price_cents, note, staff_id, services(name), staff(title)')
    .eq('tenant_id', tenantId)
  if (filters.fromUtc) q = q.gte('start_ts', filters.fromUtc)
  if (filters.toUtc) q = q.lt('start_ts', filters.toUtc)
  if (filters.staffId) q = q.eq('staff_id', filters.staffId)
  if (filters.status) q = q.eq('status', filters.status)
  const { data } = await q.order('start_ts', { ascending: true })

  type Row = {
    id: string
    start_ts: string
    end_ts: string
    status: string
    price_cents: number | null
    note: string | null
    staff_id: string
    services: { name: string } | null
    staff: { title: string | null } | null
  }
  return ((data ?? []) as Row[]).map((b) => ({
    id: b.id,
    startTs: b.start_ts,
    endTs: b.end_ts,
    status: b.status,
    priceCents: b.price_cents,
    note: b.note,
    staffId: b.staff_id,
    serviceName: b.services?.name ?? 'Okänd tjänst',
    staffTitle: b.staff?.title?.trim() || 'Medarbetare',
  }))
}

export type DashboardData = {
  servicesActive: number
  staffActive: number
  todayCount: number
  weekCount: number
  upcomingToday: AdminBooking[]
}

const ACTIVE_BOOKING = ['pending', 'confirmed', 'completed'] as const

export async function dashboardData(
  tenantId: string,
  today: { fromUtc: string; toUtc: string },
  week: { fromUtc: string; toUtc: string },
): Promise<DashboardData> {
  const supabase = await createClient()
  const [services, staff, todayB, weekCount, upcoming] = await Promise.all([
    supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('active', true),
    supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('active', true),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ACTIVE_BOOKING as unknown as string[])
      .gte('start_ts', today.fromUtc)
      .lt('start_ts', today.toUtc),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ACTIVE_BOOKING as unknown as string[])
      .gte('start_ts', week.fromUtc)
      .lt('start_ts', week.toUtc),
    listBookings(tenantId, { fromUtc: today.fromUtc, toUtc: today.toUtc }),
  ])
  // Keep the list consistent with `todayCount` (both exclude cancelled/no_show).
  const active = new Set<string>(ACTIVE_BOOKING)
  return {
    servicesActive: services.count ?? 0,
    staffActive: staff.count ?? 0,
    todayCount: todayB.count ?? 0,
    weekCount: weekCount.count ?? 0,
    upcomingToday: upcoming.filter((b) => active.has(b.status)),
  }
}
