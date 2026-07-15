import 'server-only'
import { cache } from 'react'
import type { Tables } from '@corevo/db'
import type { TenantBranding } from '@corevo/ui'
import { createClient } from '@/lib/supabase/server'
import { staffColor } from './staff-colors'
import { hmToMinutes, sumMergedMinutes } from './dashboard-view'

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
  serviceId: string
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
  /** Filter on cancelled_at (NOT start_ts) — "vad avbokades under detta fönster".
   *  Använder 0060-indexet (tenant_id, cancelled_at desc). */
  cancelledFromUtc?: string
  cancelledToUtc?: string
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
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('active', { ascending: false })
    .order('category', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true })
  // Kasta, svälj inte (B-10): en tyst tom tjänstlista gör bokningsdialogen obrukbar
  // utan förklaring. Hellre felsidan med Försök igen.
  if (error) throw new Error(`listServices: ${error.message}`)
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

export type StaffBookingResources = {
  staffId: string
  serviceIds: string[]
  locationIds: string[]
}

/** Giltiga tjänst-/platskopplingar för kalenderns ombokningsväljare.
 *  Två tenant-filtrerade batchläsningar undviker N+1 och ser till att klienten
 *  bara erbjuder samma resurser som moveBooking + DB-triggern accepterar. */
export async function listStaffBookingResources(
  tenantId: string,
): Promise<StaffBookingResources[]> {
  const supabase = await createClient()
  const [servicesRes, locationsRes] = await Promise.all([
    supabase.from('staff_services').select('staff_id, service_id').eq('tenant_id', tenantId),
    supabase
      .from('working_hours')
      .select('staff_id, location_id')
      .eq('tenant_id', tenantId)
      .not('location_id', 'is', null),
  ])
  if (servicesRes.error) {
    throw new Error(`listStaffBookingResources.services: ${servicesRes.error.message}`)
  }
  if (locationsRes.error) {
    throw new Error(`listStaffBookingResources.locations: ${locationsRes.error.message}`)
  }

  const byStaff = new Map<string, { serviceIds: Set<string>; locationIds: Set<string> }>()
  const resource = (staffId: string) => {
    const current = byStaff.get(staffId)
    if (current) return current
    const created = { serviceIds: new Set<string>(), locationIds: new Set<string>() }
    byStaff.set(staffId, created)
    return created
  }
  for (const row of servicesRes.data ?? []) resource(row.staff_id).serviceIds.add(row.service_id)
  for (const row of locationsRes.data ?? []) {
    if (row.location_id) resource(row.staff_id).locationIds.add(row.location_id)
  }

  return [...byStaff.entries()].map(([staffId, links]) => ({
    staffId,
    serviceIds: [...links.serviceIds],
    locationIds: [...links.locationIds],
  }))
}

// Prestanda C2: request-scopad cache() — PortalShell (butik-väljaren) och admin-
// sidorna läser platserna per request; dedupar dubbla locations-frågor.
export const listLocations = cache(async (tenantId: string): Promise<LocationRow[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('locations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
  return data ?? []
})

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
export async function listWorkingHourSlots(tenantId: string, staffId: string): Promise<SlotRow[]> {
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
      'id, start_ts, end_ts, status, price_cents, note, created_at, staff_id, service_id, location_id, customer_id, services(name), staff(title), locations(name), customers(display_name, full_name, name_hidden, phone)',
    )
    .eq('tenant_id', tenantId)
  if (filters.fromUtc) q = q.gte('start_ts', filters.fromUtc)
  if (filters.toUtc) q = q.lt('start_ts', filters.toUtc)
  if (filters.cancelledFromUtc) q = q.gte('cancelled_at', filters.cancelledFromUtc)
  if (filters.cancelledToUtc) q = q.lt('cancelled_at', filters.cancelledToUtc)
  if (filters.staffId) q = q.eq('staff_id', filters.staffId)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.locationId) q = q.eq('location_id', filters.locationId)
  const { data, error } = await q.order('start_ts', { ascending: true })
  // Kasta, svälj inte (B-10): ett datafel som blir [] ser ut som en TOM kalender —
  // "dagen är fri" är en farligare lögn än en felsida. error.tsx fångar + Försök igen.
  if (error) throw new Error(`listBookings: ${error.message}`)

  type Row = {
    id: string
    start_ts: string
    end_ts: string
    status: string
    price_cents: number | null
    note: string | null
    created_at: string
    staff_id: string
    service_id: string
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
    serviceId: b.service_id,
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
  /** B-25 soft delete: dold ur listor/sök. Historiken finns kvar. */
  hidden: boolean
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
  // Prestanda C4: besök (count), senaste besök (max) och lojalitetssaldo (sum) räknas
  // nu i Postgres (RPC admin_customer_rows, migr 0067) i stället för att ladda hela
  // bokningshistoriken PER kund + HELA loyalty_ledger in i isolatet och räkna i JS.
  // Det tog bort den TYSTA korrekthetsbuggen: en inbäddad select/full ledger kapas vid
  // PostgREST-taket vid 1000+ rader, en SQL-COUNT/SUM gör det aldrig. Namn-maskering +
  // nivå-tärning bor kvar här (rent per-rad, ingen I/O). RPC:n är SECURITY INVOKER →
  // exakt samma RLS som de tre separata läsningarna. hidden_at följer med (B-25): sidan
  // partitionerar synliga/dolda i EN läsning.
  // Sidhämta i block om 1000: ett enskilt PostgREST-svar kan kapas (db-max-rows), och
  // en tenant med 1000+ aktiva kunder ska INTE tyst tappa svansen — det var hela C4-
  // buggen. RPC:n har stabil unik ordning (last_seen_at, id) så .range aldrig
  // tappar/dubblar vid sidgränsen. Loopen kör ett anrop tills en sida < 1000.
  const PAGE = 1000
  const rows: AdminCustomer[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .rpc('admin_customer_rows', { p_tenant: tenantId })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(`listCustomers: ${error.message}`)
    const page = data ?? []
    for (const c of page) {
      const lp = c.loyalty_points
      rows.push({
        id: c.id,
        shownName: shownNameOf(c),
        nameHidden: c.name_hidden,
        status: c.status,
        visits: c.visits,
        lastVisitTs: c.last_visit_ts,
        firstSeenAt: c.first_seen_at,
        isReturning: c.visits >= RETURNING_VISITS,
        loyaltyPoints: lp,
        tier: tierOf(lp),
        hidden: c.hidden_at != null,
      })
    }
    if (page.length < PAGE) break
  }

  const term = searchTerm?.trim().toLowerCase()
  if (!term) return rows
  // Match the SHOWN name only (never the hidden full name) — privacy-preserving.
  return rows.filter((c) => c.shownName.toLowerCase().includes(term))
}

/** Prestanda C4: en ENDA kunds lojalitetssaldo + nivå, för kunddetaljsidan — som
 *  tidigare drog HELA kundlistan bara för att plocka ut den här radens poäng. Samma
 *  RPC, filtrerad till en kund (p_customer).
 *
 *  Returnerar NULL när ingen aktiv rad finns (RPC:n är status='active'-filtrerad, precis
 *  som listCustomers): en 'anonymized' (GDPR-skrubbad) kund nås via direkt-URL men har
 *  ingen lojalitetsrad → sidan visar ÄRLIG tom-text, ALDRIG ett påhittat 0/Ny-saldo. */
export async function getCustomerLoyalty(
  tenantId: string,
  customerId: string,
): Promise<{ loyaltyPoints: number; tier: CustomerTier } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_customer_rows', {
    p_tenant: tenantId,
    p_customer: customerId,
  })
  // Skilj ETT RIKTIGT FEL (kasta → felsida) från en frånvarande rad (null → ärlig
  // tom-text). Att svälja felet vore en tyst lögn: "ingen lojalitet" i stället för
  // "vi kunde inte läsa den" (samma ärlighetsprincip som listCustomers/getStats).
  if (error) throw new Error(`getCustomerLoyalty: ${error.message}`)
  const row = data?.[0]
  if (!row) return null
  return { loyaltyPoints: row.loyalty_points, tier: tierOf(row.loyalty_points) }
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
  /** B-25: dold ur listor/sök (soft delete — historiken kvar). */
  hidden: boolean
  /** B-25: får kunden boka själv via sajten/kundkontot? */
  selfBook: boolean
}

export async function getCustomerDetail(
  tenantId: string,
  customerId: string,
): Promise<CustomerDetail | null> {
  const supabase = await createClient()
  const { data: c } = await supabase
    .from('customers')
    .select(
      'id, display_name, full_name, name_hidden, status, first_seen_at, last_seen_at, auth_user_id, hidden_at, self_book',
    )
    .eq('tenant_id', tenantId)
    .eq('id', customerId)
    .maybeSingle()
  if (!c) return null

  // History via the new stable band (bookings.customer_id). Newest first.
  const { data: bd } = await supabase
    .from('bookings')
    .select(
      'id, start_ts, end_ts, status, price_cents, note, created_at, staff_id, service_id, location_id, services(name), staff(title), locations(name)',
    )
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
    service_id: string
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
    serviceId: b.service_id,
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
    hidden: c.hidden_at != null,
    selfBook: c.self_book,
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

/** En resurs (personal) och dess arbetstid en given veckodag. `start`/`end` är null
 *  när resursen inte arbetar den dagen — det är ett ärligt "ledig", inte saknad data. */
export type StaffDay = {
  staffId: string
  name: string
  start: string | null
  end: string | null
  /** Faktiska arbetsminuter för dagen = SUMMAN av alla pass, inte ytterspannet
   *  (start→end). Ett delat schema 09–12 + 15–18 = 360 min, inte 540. Beläggningen
   *  på översikten delar bokade minuter med detta; ytterspannet skulle överskatta
   *  nämnaren och förvränga procenten (Codex-granskning). 0 när resursen är ledig. */
  workedMinutes: number
  /** goal-67: kalenderfärgen. Alltid en hex — härledd ur id:t när ingen är vald,
   *  så kalendern är färgkodad från dag ett utan att någon behövt välja. */
  color: string
}

/** Dagens resursläge: aktiv personal + deras arbetstid för veckodagen (0=sön … 6=lör,
 *  samma konvention som working_hours.weekday). EN läsning för hela tenanten — den
 *  gamla listWorkingHours(staffId) är per resurs och blir N+1 i en dagvy.
 *  Kalenderns kolumner (goal-66) läser samma funktion: en resurs som är ledig ska
 *  ritas som ledig, inte utelämnas. */
export async function staffDay(
  tenantId: string,
  weekday: number,
  locationId?: string,
): Promise<StaffDay[]> {
  const supabase = await createClient()
  let hoursQuery = supabase
    .from('working_hours')
    .select('staff_id, weekday, start_time, end_time')
    .eq('tenant_id', tenantId)
    .order('start_time', { ascending: true })
  if (locationId) hoursQuery = hoursQuery.eq('location_id', locationId)
  else hoursQuery = hoursQuery.eq('weekday', weekday)

  const [staffRes, hoursRes] = await Promise.all([
    supabase
      .from('staff')
      .select('id, title, color')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      // Stabil kolumnordning i kalendern kräver en deterministisk sortering — samma
      // ordning varje ladd, annars hoppar resurserna mellan kolumner.
      .order('created_at', { ascending: true }),
    hoursQuery,
  ])
  // Kasta, svälj inte (B-10): noll resurser p.g.a. datafel skulle rita en kalender
  // helt utan kolumner — som ser ut som "ingen jobbar idag".
  if (staffRes.error) throw new Error(`staffDay: ${staffRes.error.message}`)
  if (hoursRes.error) throw new Error(`staffDay: ${hoursRes.error.message}`)
  const { data: staffRows } = staffRes
  const { data: hourRows } = hoursRes
  const locationStaffIds = locationId
    ? new Set((hourRows ?? []).map((row: { staff_id: string }) => row.staff_id))
    : null

  // Flera pass samma dag (t.ex. förmiddag + kväll) → resursens dag spänner från
  // första starten till sista slutet. Luckan mellan passen ritas som ej tillgänglig
  // i kalendern; här räcker ytterkanterna.
  const span = new Map<string, { start: string; end: string }>()
  // Pass-intervall per resurs (minuter) — slås ihop nedan så överlapp inte dubbelräknas.
  const passes = new Map<string, [number, number][]>()
  for (const row of (hourRows ?? []) as {
    staff_id: string
    weekday: number
    start_time: string
    end_time: string
  }[]) {
    if (row.weekday !== weekday) continue
    const prev = span.get(row.staff_id)
    span.set(row.staff_id, {
      start: prev && prev.start < row.start_time ? prev.start : row.start_time,
      end: prev && prev.end > row.end_time ? prev.end : row.end_time,
    })
    const arr = passes.get(row.staff_id) ?? []
    arr.push([hmToMinutes(row.start_time), hmToMinutes(row.end_time)])
    passes.set(row.staff_id, arr)
  }
  // Faktiska arbetsminuter per resurs = sammanslagna pass (ej ytterspann, ej dubbelräknat).
  const worked = new Map<string, number>()
  for (const [id, ivs] of passes) worked.set(id, sumMergedMinutes(ivs))

  return ((staffRows ?? []) as { id: string; title: string | null; color: string | null }[])
    .filter((staffRow) => !locationStaffIds || locationStaffIds.has(staffRow.id))
    .map((s) => {
      const hours = span.get(s.id)
      return {
        staffId: s.id,
        // Samma fallback som listStaff.displayName — identiteten bärs av namnet.
        name: s.title?.trim() || 'Namnlös medarbetare',
        start: hours?.start ?? null,
        end: hours?.end ?? null,
        workedMinutes: worked.get(s.id) ?? 0,
        color: staffColor(s.id, s.color),
      }
    })
}

/** goal-67: översikten svarar på "vad händer idag" — inget annat. `servicesActive`,
 *  `staffActive`, `serviceMix` och `peakHours` räknades ut här men renderades av INGEN
 *  sida; den frågan bor nu på /admin/statistik med riktig period och jämförelse. */
export type DashboardData = {
  todayCount: number
  upcomingToday: AdminBooking[]
  /** Dagens BOKADE VÄRDE (öre) — summan av dagens aktiva tider, genomförda som
   *  kommande. Det är INTE "intäkt": en tid kl 16 har inte tjänats in kl 09. Kortet
   *  heter därför "Bokat idag" och hintan säger hur mycket som redan är klart.
   *  (Codex-granskning: etiketten "Intäkt" ljög om framtida tider.) */
  todayBookedCents: number
  /** Av det bokade värdet: den del som redan är genomförd (status = completed). */
  todayDoneCents: number
  /** Antal av dagens tider som saknar pris — ett tyst 0 hade underskattat summan
   *  utan att någon märkte det. Kortet flaggar det i stället för att ljuga tyst. */
  todayUnpriced: number
  /** Samma veckodag förra veckan: bokat värde (öre). Driver "+X% v. {dag}"-jämförelsen
   *  i "Idag i siffror". 0 om ingen jämförbar dag fanns → chipet döljs (ingen falsk 0%). */
  prevWeekdayBookedCents: number
  /** Dagens AVBOKADE tider (avbokade idag, cancelled_at) — frigjorda luckor som
   *  inkorgen "Kräver uppmärksamhet" listar med en "Fyll luckan"-åtgärd. */
  cancellationsToday: AdminBooking[]
  /** Avbokningspanelens aggregat: antal + förlorat värde (öre) per period, bucketade
   *  på cancelled_at mot varje periods egen startgräns (idag/veckans måndag/månadens
   *  1:a). Fönstren är oberoende — veckan kan spänna in i föregående månad. */
  cancellationStats: {
    today: { count: number; cents: number }
    week: { count: number; cents: number }
    month: { count: number; cents: number }
  }
}

export async function dashboardData(
  tenantId: string,
  today: { fromUtc: string; toUtc: string },
  prevWeekday: { fromUtc: string; toUtc: string },
  options: { weekFromUtc: string; monthFromUtc: string; locationId?: string },
): Promise<DashboardData> {
  const supabase = await createClient()
  let todayCountQuery = supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status', ACTIVE_BOOKING as unknown as string[])
    .gte('start_ts', today.fromUtc)
    .lt('start_ts', today.toUtc)
  let previousQuery = supabase
    .from('bookings')
    .select('price_cents')
    .eq('tenant_id', tenantId)
    .in('status', ACTIVE_BOOKING as unknown as string[])
    .gte('start_ts', prevWeekday.fromUtc)
    .lt('start_ts', prevWeekday.toUtc)
  let cancellationQuery = supabase
    .from('bookings')
    .select('cancelled_at, price_cents')
    .eq('tenant_id', tenantId)
    .eq('status', 'cancelled')
    .gte(
      'cancelled_at',
      options.weekFromUtc < options.monthFromUtc ? options.weekFromUtc : options.monthFromUtc,
    )
  if (options.locationId) {
    todayCountQuery = todayCountQuery.eq('location_id', options.locationId)
    previousQuery = previousQuery.eq('location_id', options.locationId)
    cancellationQuery = cancellationQuery.eq('location_id', options.locationId)
  }

  const [todayB, upcoming, prevRows, cancellations, cancelAgg] = await Promise.all([
    todayCountQuery,
    listBookings(tenantId, {
      fromUtc: today.fromUtc,
      toUtc: today.toUtc,
      locationId: options.locationId,
    }),
    // Samma veckodag förra veckan — bara prislappen behövs, inte raderna. Summeras i JS
    // (en dags bokningar = litet); PostgREST saknar billig SUM här.
    previousQuery,
    // Avbokningar som SKEDDE idag (cancelled_at, inte start_ts) — verkliga händelser
    // för inkorgen. En bokning avbokad för veckor sedan är ingen ny lucka att fylla.
    listBookings(tenantId, {
      cancelledFromUtc: today.fromUtc,
      cancelledToUtc: today.toUtc,
      status: 'cancelled',
      locationId: options.locationId,
    }),
    // Avbokningspanelens aggregat: EN läsning från det TIDIGASTE fönstret (veckan kan
    // börja i föregående månad vid månadsskifte), bucketas i JS till idag/vecka/månad.
    cancellationQuery,
  ])
  // Kasta, svälj inte (B-10): ett query-fel som blir 0 avbokningar ser ut som en lugn
  // dag — en farligare lögn än en felsida.
  if (cancelAgg.error) throw new Error(`dashboardData cancelAgg: ${cancelAgg.error.message}`)
  if (prevRows.error) throw new Error(`dashboardData prevRows: ${prevRows.error.message}`)

  // Keep the list consistent with `todayCount` (both exclude cancelled/no_show).
  const active = new Set<string>(ACTIVE_BOOKING)
  const todayRows = upcoming.filter((b) => active.has(b.status))
  const prevWeekdayBookedCents = ((prevRows.data ?? []) as { price_cents: number | null }[]).reduce(
    (sum, r) => sum + (r.price_cents ?? 0),
    0,
  )

  // Bucketa avbokningar (kumulativt: idag ⊆ vecka ⊆ månad).
  const cancellationStats = {
    today: { count: 0, cents: 0 },
    week: { count: 0, cents: 0 },
    month: { count: 0, cents: 0 },
  }
  for (const r of (cancelAgg.data ?? []) as {
    cancelled_at: string | null
    price_cents: number | null
  }[]) {
    if (!r.cancelled_at) continue
    const cents = r.price_cents ?? 0
    cancellationStats.month.count++
    cancellationStats.month.cents += cents
    if (r.cancelled_at >= options.weekFromUtc) {
      cancellationStats.week.count++
      cancellationStats.week.cents += cents
    }
    if (r.cancelled_at >= today.fromUtc) {
      cancellationStats.today.count++
      cancellationStats.today.cents += cents
    }
  }

  return {
    todayCount: todayB.count ?? 0,
    upcomingToday: todayRows,
    // Dagens värde styr en dag — antalet bokningar gör det inte (tre färgningar ≠ tre
    // luggklipp). Men BOKAT ≠ INTJÄNAT: hela dagen summeras, klart och kommande, och
    // de två hålls isär i stället för att bakas ihop till ett tal som ljuger.
    todayBookedCents: todayRows.reduce((sum, b) => sum + (b.priceCents ?? 0), 0),
    todayDoneCents: todayRows
      .filter((b) => b.status === 'completed')
      .reduce((sum, b) => sum + (b.priceCents ?? 0), 0),
    todayUnpriced: todayRows.filter((b) => b.priceCents == null).length,
    prevWeekdayBookedCents,
    cancellationsToday: cancellations,
    cancellationStats,
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
export function normalisePaymentStatus(
  raw: string | null | undefined,
): BookingPaymentStatus | null {
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
  for (const p of (data ?? []) as {
    booking_id: string | null
    status: string | null
    amount_cents: number | null
  }[]) {
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
