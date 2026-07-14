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

export type SlotRow = Tables<'working_hour_slots'>

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
  /** When the booking was made (created_at) — "bokad den" column (M6 §3.2). */
  createdAt: string
  /** Bokningens plats (bookings.location_id är NOT NULL). Namnet joinas för
   *  fler-plats-tenants; null bara om locations-raden inte är läsbar. */
  locationId: string
  locationName: string | null
  /** Kopplad kundprofil — null för gäst-/legacy-bokningar utan kundkoppling. */
  customerId: string | null
  /** Maskerat visningsnamn med SAMMA privacy-regel som Kunder-listan
   *  (shownNameOf: display_name → initial vid name_hidden → full_name).
   *  null = ingen kundkoppling; ett dolt fullnamn läcker aldrig hit. */
  customerName: string | null
  /** Kundens telefon — så receptionen kan RINGA direkt ur kalendern. null = gäst
   *  utan nummer. `name_hidden` maskerar NAMNET, aldrig numret: den kund som valt
   *  att vara anonym utåt ska fortfarande gå att nå av salongen hen bokat hos. */
  customerPhone: string | null
}

export type BookingFilters = {
  fromUtc?: string
  toUtc?: string
  staffId?: string
  status?: string
  locationId?: string
  /** Free-text search across service name, staff title and the (legacy) note. */
  query?: string
}

/** Statuses that count as a real visit (exclude cancelled/no_show). Shared by the
 *  dashboard counts and the customer visit tallies. */
const ACTIVE_BOOKING = ['pending', 'confirmed', 'completed'] as const

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

/** Owner editorial copy override (settings.copy) for the branding editor's copy
 *  fields. Returns a plain {field: string} map (missing → ''). Read-only mirror of
 *  the M2 contract's CopyOverride shape; defensive against malformed jsonb. */
export type CopyFields = {
  heroEyebrow: string
  heroTitle: string
  heroLede: string
  aboutCopy: string
  tagline: string
  italic: string
}

export function copyOf(row: SettingsRow | null): CopyFields {
  const raw = ((row?.settings ?? {}) as Record<string, unknown>).copy
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  return {
    heroEyebrow: str(c.heroEyebrow),
    heroTitle: str(c.heroTitle),
    heroLede: str(c.heroLede),
    aboutCopy: str(c.aboutCopy),
    tagline: str(c.tagline),
    italic: str(c.italic),
  }
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

/** Explicit bookable start times per (staff, weekday) — M6 §5 model. Active only;
 *  weekday→start ordered for a clean per-day grouping. */
export async function listWorkingHourSlots(
  tenantId: string,
  staffId: string,
): Promise<SlotRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('working_hour_slots')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('staff_id', staffId)
    .eq('active', true)
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
  // customers joinas för visningsnamnet på raden. RLS (customers_rls, 0011:503)
  // fencar läsningen till role_level>=3 i tenanten — kan raden inte läsas blir
  // embedden null och UI:t faller ärligt tillbaka till 'Gäst', aldrig ett läckt
  // fullnamn (maskningen sker i shownNameOf, samma regel som Kunder-sidan).
  //
  // `phone` följer med: kalendern måste kunna RINGA kunden ("sen igår, kommer du?")
  // utan att först öppna bokningen. Det är inte en ny PII-väg — customers_rls släpper
  // redan igenom raden till ägaren, och en kund i ägarens egen kalender är precis det
  // driftfall get_customer_contact:s fönster beskriver. RPC:n behövs där anroparen
  // INTE har den fencen (kundportalen, personalvyn); här har den det.
  let q = supabase
    .from('bookings')
    .select(
      'id, start_ts, end_ts, status, price_cents, note, created_at, staff_id, location_id, customer_id, services(name), staff(title), locations(name), customers(display_name, full_name, name_hidden, phone)',
    )
    .eq('tenant_id', tenantId)
  if (filters.fromUtc) q = q.gte('start_ts', filters.fromUtc)
  if (filters.toUtc) q = q.lt('start_ts', filters.toUtc)
  if (filters.staffId) q = q.eq('staff_id', filters.staffId)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.locationId) q = q.eq('location_id', filters.locationId)
  const { data } = await q.order('start_ts', { ascending: true })

  type Row = {
    id: string
    start_ts: string
    end_ts: string
    status: string
    price_cents: number | null
    note: string | null
    created_at: string
    staff_id: string
    location_id: string
    customer_id: string | null
    services: { name: string } | null
    staff: { title: string | null } | null
    locations: { name: string } | null
    customers: Pick<CustomerRow, 'display_name' | 'full_name' | 'name_hidden' | 'phone'> | null
  }
  const mapped: AdminBooking[] = ((data ?? []) as Row[]).map((b) => ({
    id: b.id,
    startTs: b.start_ts,
    endTs: b.end_ts,
    status: b.status,
    priceCents: b.price_cents,
    note: b.note,
    createdAt: b.created_at,
    staffId: b.staff_id,
    locationId: b.location_id,
    locationName: b.locations?.name ?? null,
    customerId: b.customer_id,
    customerName: b.customers ? shownNameOf(b.customers) : null,
    customerPhone: b.customers?.phone?.trim() || null,
    serviceName: b.services?.name ?? 'Okänd tjänst',
    staffTitle: b.staff?.title?.trim() || 'Medarbetare',
  }))

  // Free-text search is applied app-side: the joined service/staff/customer names
  // live on related tables, so a single SQL ilike can't span them; the result set
  // is already date/staff/status-narrowed, so this stays cheap. Customer match is
  // on the SHOWN (masked) name only — never the hidden full name.
  const term = filters.query?.trim().toLowerCase()
  if (!term) return mapped
  return mapped.filter(
    (b) =>
      b.serviceName.toLowerCase().includes(term) ||
      b.staffTitle.toLowerCase().includes(term) ||
      (b.customerName?.toLowerCase().includes(term) ?? false) ||
      (b.note?.toLowerCase().includes(term) ?? false),
  )
}

// ── Customers (M6 §3.1 + §4 — identity vs time-bound PII) ─────────────────────
export type CustomerRow = Tables<'customers'>

/** One row in the owner's customer database list. Identity-level only — NO raw
 *  PII (email/phone) is exposed here; the time-bound contact lives behind the
 *  get_customer_contact RPC (see {@link getCustomerContact}). */
/** Härledd lojalitetsnivå. INGA lagrade tier-kolumner — beräknas från livstids-
 *  poäng (migr 0011:107). Trösklar nedan; tenant-konfigurerbara trösklar är en
 *  framtida förbättring (idag standardvärden). */
export type CustomerTier = 'guld' | 'silver' | 'brons' | 'ny'

const TIER_GULD = 500
const TIER_SILVER = 150

function tierOf(points: number): CustomerTier {
  if (points >= TIER_GULD) return 'guld'
  if (points >= TIER_SILVER) return 'silver'
  if (points > 0) return 'brons'
  return 'ny'
}

export type AdminCustomer = {
  id: string
  /** What to SHOW: kund-chosen display_name, else masked initial when name_hidden,
   *  else full_name, else a neutral placeholder. Never leaks a hidden full name. */
  shownName: string
  nameHidden: boolean
  status: string
  visits: number
  lastVisitTs: string | null
  firstSeenAt: string
  isReturning: boolean
  /** Riktigt saldo = sum(points_delta) ur loyalty_ledger (append-only, härlett —
   *  migr 0011:107). 0 = ingen lojalitets-aktivitet, aldrig fejkat. */
  loyaltyPoints: number
  tier: CustomerTier
}

/** Public display name for a customer row WITHOUT leaking a hidden full name.
 *  Mirrors get_customer_contact's display_name rule (migration 0011:340). */
function shownNameOf(c: Pick<CustomerRow, 'display_name' | 'full_name' | 'name_hidden'>): string {
  const display = c.display_name?.trim()
  if (display) return display
  const full = c.full_name?.trim()
  if (!full) return 'Gäst'
  return c.name_hidden ? `${full[0]!.toUpperCase()}.` : full
}

const RETURNING_VISITS = 5

/** Tenant customer database with per-customer visit count (active bookings).
 *  RLS (customers_rls, 0011:503) fences to role_level>=3 within the tenant; we
 *  also pass tenant_id for stable ordering + defence-in-depth.
 *
 *  `searchTerm` (optional) filters app-side on the SHOWN name (the same masked
 *  label the list renders) so a name-hidden customer is never matched on their
 *  hidden full name. Empty/whitespace term → no filtering. */
export async function listCustomers(
  tenantId: string,
  searchTerm?: string,
): Promise<AdminCustomer[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select('id, display_name, full_name, name_hidden, status, first_seen_at, last_seen_at, bookings(start_ts, status)')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('last_seen_at', { ascending: false })

  // Riktigt lojalitets-saldo per kund (sum signerad points_delta). loyalty_ledger
  // är append-only + SELECT-only tenant-wide för admin (migr 0011:551). Saldo HÄRLEDS
  // — inga lagrade saldokolumner. Tomt → 0 p (ärligt, aldrig fejkat).
  const { data: ledger } = await supabase
    .from('loyalty_ledger')
    .select('customer_id, points_delta')
    .eq('tenant_id', tenantId)
  const points = new Map<string, number>()
  for (const r of (ledger ?? []) as { customer_id: string | null; points_delta: number }[]) {
    if (!r.customer_id) continue
    points.set(r.customer_id, (points.get(r.customer_id) ?? 0) + r.points_delta)
  }

  type Row = CustomerRow & { bookings: { start_ts: string; status: string }[] | null }
  const rows: AdminCustomer[] = ((data ?? []) as Row[]).map((c) => {
    const active = (c.bookings ?? []).filter((b) =>
      (ACTIVE_BOOKING as readonly string[]).includes(b.status),
    )
    const lastVisit = active.reduce<string | null>(
      (max, b) => (max == null || b.start_ts > max ? b.start_ts : max),
      null,
    )
    const lp = points.get(c.id) ?? 0
    return {
      id: c.id,
      shownName: shownNameOf(c),
      nameHidden: c.name_hidden,
      status: c.status,
      visits: active.length,
      lastVisitTs: lastVisit,
      firstSeenAt: c.first_seen_at,
      isReturning: active.length >= RETURNING_VISITS,
      loyaltyPoints: lp,
      tier: tierOf(lp),
    }
  })

  const term = searchTerm?.trim().toLowerCase()
  if (!term) return rows
  // Match the SHOWN name only (never the hidden full name) — privacy-preserving.
  return rows.filter((c) => c.shownName.toLowerCase().includes(term))
}

export type CustomerStats = {
  total: number
  returning: number
  protectedNames: number
  /** Summa utestående lojalitetspoäng över alla kunder (negativa saldon räknas 0). */
  loyaltyPoints: number
}

export function customerStats(rows: AdminCustomer[]): CustomerStats {
  return {
    total: rows.length,
    returning: rows.filter((c) => c.isReturning).length,
    protectedNames: rows.filter((c) => c.nameHidden).length,
    loyaltyPoints: rows.reduce((s, c) => s + Math.max(0, c.loyaltyPoints), 0),
  }
}

/** A single customer's identity (the row) + their booking history. Identity only;
 *  the operator reveals time-bound PII separately via getCustomerContact. */
export type CustomerDetail = {
  id: string
  shownName: string
  nameHidden: boolean
  displayName: string | null
  status: string
  firstSeenAt: string
  lastSeenAt: string
  isLinkedAccount: boolean
  history: AdminBooking[]
  visits: number
}

export async function getCustomerDetail(
  tenantId: string,
  customerId: string,
): Promise<CustomerDetail | null> {
  const supabase = await createClient()
  const { data: c } = await supabase
    .from('customers')
    .select('id, display_name, full_name, name_hidden, status, first_seen_at, last_seen_at, auth_user_id')
    .eq('tenant_id', tenantId)
    .eq('id', customerId)
    .maybeSingle()
  if (!c) return null

  // History via the new stable band (bookings.customer_id). Newest first.
  const { data: bd } = await supabase
    .from('bookings')
    .select('id, start_ts, end_ts, status, price_cents, note, created_at, staff_id, location_id, services(name), staff(title), locations(name)')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('start_ts', { ascending: false })

  type BRow = {
    id: string
    start_ts: string
    end_ts: string
    status: string
    price_cents: number | null
    note: string | null
    created_at: string
    staff_id: string
    location_id: string
    services: { name: string } | null
    staff: { title: string | null } | null
    locations: { name: string } | null
  }
  const history: AdminBooking[] = ((bd ?? []) as BRow[]).map((b) => ({
    id: b.id,
    startTs: b.start_ts,
    endTs: b.end_ts,
    status: b.status,
    priceCents: b.price_cents,
    note: b.note,
    createdAt: b.created_at,
    staffId: b.staff_id,
    locationId: b.location_id,
    locationName: b.locations?.name ?? null,
    // Raden ÄR kundens egen historik — identiteten är redan känd + maskad ovan.
    customerId,
    customerName: shownNameOf(c),
    // Kundkortet visar kontaktuppgifterna i sin egen sektion (tidsbunden PII via
    // get_customer_contact). Historikraderna behöver inte upprepa numret.
    customerPhone: null,
    serviceName: b.services?.name ?? 'Okänd tjänst',
    staffTitle: b.staff?.title?.trim() || 'Medarbetare',
  }))
  const visits = history.filter((b) =>
    (ACTIVE_BOOKING as readonly string[]).includes(b.status),
  ).length

  return {
    id: c.id,
    shownName: shownNameOf(c),
    nameHidden: c.name_hidden,
    displayName: c.display_name,
    status: c.status,
    firstSeenAt: c.first_seen_at,
    lastSeenAt: c.last_seen_at,
    isLinkedAccount: Boolean(c.auth_user_id),
    history,
    visits,
  }
}

export type CustomerContact = {
  displayName: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  /** False → outside the operational window: PII is masked, not available. */
  piiVisible: boolean
}

/**
 * Time-bound contact PII (M6 §4 / migration 0011:299). The RPC returns the real
 * email/phone ONLY when the customer has a booking inside the operational window
 * (or the caller is the customer); otherwise pii_visible=false and the fields are
 * null. RLS-equivalent fence is re-checked inside the SECURITY DEFINER function.
 */
export async function getCustomerContact(customerId: string): Promise<CustomerContact | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_customer_contact', { p_customer: customerId })
  if (error || !data || data.length === 0) return null
  const row = data[0]!
  return {
    displayName: row.display_name,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    piiVisible: row.pii_visible,
  }
}

export type ServiceMixEntry = { name: string; count: number }
export type PeakHourEntry = { hour: number; count: number }

/** En resurs (personal) och dess arbetstid en given veckodag. `start`/`end` är null
 *  när resursen inte arbetar den dagen — det är ett ärligt "ledig", inte saknad data. */
export type StaffDay = {
  staffId: string
  name: string
  start: string | null
  end: string | null
}

/** Dagens resursläge: aktiv personal + deras arbetstid för veckodagen (0=sön … 6=lör,
 *  samma konvention som working_hours.weekday). EN läsning för hela tenanten — den
 *  gamla listWorkingHours(staffId) är per resurs och blir N+1 i en dagvy.
 *  Kalenderns kolumner (goal-66) läser samma funktion: en resurs som är ledig ska
 *  ritas som ledig, inte utelämnas. */
export async function staffDay(tenantId: string, weekday: number): Promise<StaffDay[]> {
  const supabase = await createClient()
  const [{ data: staffRows }, { data: hourRows }] = await Promise.all([
    supabase
      .from('staff')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      // Stabil kolumnordning i kalendern kräver en deterministisk sortering — samma
      // ordning varje ladd, annars hoppar resurserna mellan kolumner.
      .order('created_at', { ascending: true }),
    supabase
      .from('working_hours')
      .select('staff_id, start_time, end_time')
      .eq('tenant_id', tenantId)
      .eq('weekday', weekday)
      .order('start_time', { ascending: true }),
  ])

  // Flera pass samma dag (t.ex. förmiddag + kväll) → resursens dag spänner från
  // första starten till sista slutet. Luckan mellan passen ritas som ej tillgänglig
  // i kalendern; här räcker ytterkanterna.
  const span = new Map<string, { start: string; end: string }>()
  for (const row of (hourRows ?? []) as {
    staff_id: string
    start_time: string
    end_time: string
  }[]) {
    const prev = span.get(row.staff_id)
    span.set(row.staff_id, {
      start: prev && prev.start < row.start_time ? prev.start : row.start_time,
      end: prev && prev.end > row.end_time ? prev.end : row.end_time,
    })
  }

  return ((staffRows ?? []) as { id: string; title: string | null }[]).map((s) => {
    const hours = span.get(s.id)
    return {
      staffId: s.id,
      // Samma fallback som listStaff.displayName — identiteten bärs av namnet.
      name: s.title?.trim() || 'Namnlös medarbetare',
      start: hours?.start ?? null,
      end: hours?.end ?? null,
    }
  })
}

export type DashboardData = {
  servicesActive: number
  staffActive: number
  todayCount: number
  weekCount: number
  upcomingToday: AdminBooking[]
  /** Most-booked services this week (top 5). */
  serviceMix: ServiceMixEntry[]
  /** Busiest hours-of-day this week (top 4), in the tenant's timezone. */
  peakHours: PeakHourEntry[]
}

/** Hour-of-day (0–23) of an ISO instant in a given IANA timezone. */
function hourInTz(iso: string, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone }).format(
    new Date(iso),
  )
  const n = Number(h)
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : 0
}

export async function dashboardData(
  tenantId: string,
  today: { fromUtc: string; toUtc: string },
  week: { fromUtc: string; toUtc: string },
  timeZone: string,
): Promise<DashboardData> {
  const supabase = await createClient()
  const [services, staff, todayB, weekRows, upcoming] = await Promise.all([
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
    // Week rows (not just a count) so we can derive service-mix + peak hours.
    supabase
      .from('bookings')
      .select('start_ts, services(name)')
      .eq('tenant_id', tenantId)
      .in('status', ACTIVE_BOOKING as unknown as string[])
      .gte('start_ts', week.fromUtc)
      .lt('start_ts', week.toUtc),
    listBookings(tenantId, { fromUtc: today.fromUtc, toUtc: today.toUtc }),
  ])

  type WRow = { start_ts: string; services: { name: string } | null }
  const rows = (weekRows.data ?? []) as WRow[]

  // Service-mix: count per service name, top 5.
  const mix = new Map<string, number>()
  for (const r of rows) {
    const name = r.services?.name ?? 'Okänd tjänst'
    mix.set(name, (mix.get(name) ?? 0) + 1)
  }
  const serviceMix: ServiceMixEntry[] = [...mix.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Peak hours: count per hour-of-day (tenant tz), top 4.
  const hours = new Map<number, number>()
  for (const r of rows) {
    const h = hourInTz(r.start_ts, timeZone)
    hours.set(h, (hours.get(h) ?? 0) + 1)
  }
  const peakHours: PeakHourEntry[] = [...hours.entries()]
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)

  // Keep the list consistent with `todayCount` (both exclude cancelled/no_show).
  const active = new Set<string>(ACTIVE_BOOKING)
  return {
    servicesActive: services.count ?? 0,
    staffActive: staff.count ?? 0,
    todayCount: todayB.count ?? 0,
    weekCount: rows.length,
    upcomingToday: upcoming.filter((b) => active.has(b.status)),
    serviceMix,
    peakHours,
  }
}

// ── Booking payment status (M6 §3.2 drawer status-badge) ─────────────────────
// payments_rls (0010:63) lets staff/admin (role_level>=3) read payments tenant-
// wide via the authed client, so this is a REAL read (verified RLS). A booking
// MAY have no payment row at all (payments are minted only on the Stripe-checkout
// path, migration 0007): that is the HONEST "no payment" state, status=null — the
// drawer renders no badge, never a fake "Betald"/"Väntar". UNIQUE(booking_id)
// (0007:53) guarantees at most one row per booking.

export type BookingPaymentStatus = 'pending' | 'succeeded' | 'failed'

export type BookingPayment = {
  /** Stripe-mirrored payment state, or null when no payment row exists. */
  status: BookingPaymentStatus | null
  /** Charged amount in minor units, or null when no payment row exists. */
  amountCents: number | null
}

/** Normalise a raw payments.status string into the known set (defensive: any
 *  unknown value collapses to null so the UI never shows a phantom badge). */
export function normalisePaymentStatus(raw: string | null | undefined): BookingPaymentStatus | null {
  if (raw === 'pending' || raw === 'succeeded' || raw === 'failed') return raw
  return null
}

/**
 * Batch-variant för list-ytor: EN läsning för alla bokningars payment-rader i
 * stället för en per bokning (N+1:an på /admin/bokningar). Bokningar utan rad
 * saknas i mappen → samma ärliga "ingen betalning"-null som singel-läsningen.
 */
export async function listBookingPayments(
  tenantId: string,
  bookingIds: string[],
): Promise<Map<string, BookingPayment>> {
  const out = new Map<string, BookingPayment>()
  if (bookingIds.length === 0) return out
  const supabase = await createClient()
  const { data } = await supabase
    .from('payments')
    .select('booking_id, status, amount_cents')
    .eq('tenant_id', tenantId)
    .in('booking_id', bookingIds)
  for (const p of (data ?? []) as { booking_id: string | null; status: string | null; amount_cents: number | null }[]) {
    if (!p.booking_id) continue
    out.set(p.booking_id, {
      status: normalisePaymentStatus(p.status),
      amountCents: p.amount_cents ?? null,
    })
  }
  return out
}

/**
 * The payment row for a single booking (or the null no-payment state). tenant_id
 * is passed for defence-in-depth + stable scoping (RLS already fences it).
 */
export async function getBookingPaymentStatus(
  bookingId: string,
  tenantId: string,
): Promise<BookingPayment> {
  if (!bookingId) return { status: null, amountCents: null }
  const supabase = await createClient()
  const { data } = await supabase
    .from('payments')
    .select('status, amount_cents')
    .eq('tenant_id', tenantId)
    .eq('booking_id', bookingId)
    .maybeSingle()
  if (!data) return { status: null, amountCents: null }
  return {
    status: normalisePaymentStatus(data.status),
    amountCents: data.amount_cents ?? null,
  }
}
