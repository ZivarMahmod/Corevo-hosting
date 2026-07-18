import 'server-only'
import { platformCtx } from './guard'
import { customerDisplayName, customerRole, customerAuthLabel, customerStatusLabel } from './people'

// Rich per-tenant end-customer surface for the super-admin Kunder tab. One customers
// read + one tenant-wide bookings read + one offert_requests read (RLS bypass via the
// platform_admin JWT), then everything is bucketed by customer_id IN MEMORY — no
// per-customer fan-out. Every metric (frequency, last visit, cancellations, inquiries)
// is derived from existing tables; no schema was added.
//
// ponytail: loads ALL of a tenant's bookings + offert in one shot to build history +
// aggregates together. Fine at salon scale; if a tenant ever has tens of thousands of
// bookings, cap the history read (order start_ts desc + limit) and keep aggregates via
// a separate count query.

const ACTIVE = ['pending', 'confirmed', 'completed'] as const

export type CustomerBooking = {
  id: string
  startTs: string
  status: string
  priceCents: number | null
  serviceName: string
  staffTitle: string
}
export type CustomerInquiry = {
  id: string
  subject: string | null
  status: string
  mode: string
  createdAt: string
  customerName: string | null
}
export type TenantCustomer = {
  id: string
  tenantId: string
  name: string
  maskedEmail: string
  maskedPhone: string
  hasEmail: boolean
  hasPhone: boolean
  role: string
  auth: string
  status: string
  nameHidden: boolean
  total: number
  completed: number
  cancelled: number
  noShow: number
  upcoming: number
  lastVisit: string | null
  firstSeen: string | null
  returning: boolean
  bookings: CustomerBooking[]
  inquiries: CustomerInquiry[]
}
export type TenantCustomersData = {
  customers: TenantCustomer[]
  summary: { total: number; withBookings: number; returning: number; newThisMonth: number }
  unlinkedInquiries: CustomerInquiry[]
  hasInquiries: boolean
}

type CustomerRow = {
  id: string
  full_name: string | null
  display_name: string | null
  name_hidden: boolean
  masked_email: string
  masked_phone: string
  has_email: boolean
  has_phone: boolean
  status: string
  auth_user_id: string | null
  first_seen_at: string | null
  last_seen_at: string | null
}
type BookingRow = {
  id: string
  customer_id: string | null
  status: string
  start_ts: string
  price_cents: number | null
  services: { name: string } | null
  staff: { title: string | null } | null
}
type OffertRow = {
  id: string
  customer_id: string | null
  subject: string | null
  status: string
  mode: string
  created_at: string
  customer_name: string | null
}

const RETURNING_MIN = 5 // ≥5 genomförda besök = återkommande (befintlig konvention)

export async function getTenantCustomers(tenantId: string): Promise<TenantCustomersData> {
  const { supabase } = await platformCtx()

  const [custRes, bookRes, offertRes] = await Promise.all([
    supabase.rpc('platform_customer_safe_rows', {
      p_tenant: tenantId,
      p_limit: 1000,
    }),
    supabase
      .from('bookings')
      .select('id, customer_id, status, start_ts, price_cents, services(name), staff(title)')
      .eq('tenant_id', tenantId)
      .order('start_ts', { ascending: false })
      .limit(2000),
    // offert_requests may be RLS-guarded / the module off — tolerate an error → no inquiries.
    supabase
      .from('offert_requests')
      .select('id, customer_id, subject, status, mode, created_at, customer_name')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  // Bucket bookings by customer.
  const bookingsByCustomer = new Map<string, CustomerBooking[]>()
  for (const b of (bookRes.data ?? []) as unknown as BookingRow[]) {
    if (!b.customer_id) continue
    const list = bookingsByCustomer.get(b.customer_id) ?? []
    list.push({
      id: b.id,
      startTs: b.start_ts,
      status: b.status,
      priceCents: b.price_cents,
      serviceName: b.services?.name ?? 'Okänd tjänst',
      staffTitle: b.staff?.title?.trim() || 'Medarbetare',
    })
    bookingsByCustomer.set(b.customer_id, list)
  }

  // Bucket inquiries by customer; unlinked ones (no customer_id) surface separately.
  const inquiriesByCustomer = new Map<string, CustomerInquiry[]>()
  const unlinkedInquiries: CustomerInquiry[] = []
  for (const o of (offertRes.data ?? []) as unknown as OffertRow[]) {
    const inq: CustomerInquiry = {
      id: o.id,
      subject: o.subject,
      status: o.status,
      mode: o.mode,
      createdAt: o.created_at,
      customerName: o.customer_name,
    }
    if (o.customer_id) {
      const list = inquiriesByCustomer.get(o.customer_id) ?? []
      list.push(inq)
      inquiriesByCustomer.set(o.customer_id, list)
    } else {
      unlinkedInquiries.push(inq)
    }
  }

  const now = Date.now()
  const monthStart = (() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  })()

  let withBookings = 0
  let returningCount = 0
  let newThisMonth = 0

  const customers: TenantCustomer[] = ((custRes.data ?? []) as CustomerRow[]).map((c) => {
    const bookings = bookingsByCustomer.get(c.id) ?? []
    const inquiries = inquiriesByCustomer.get(c.id) ?? []
    const completed = bookings.filter((b) => b.status === 'completed').length
    const cancelled = bookings.filter((b) => b.status === 'cancelled').length
    const noShow = bookings.filter((b) => b.status === 'no_show').length
    const upcoming = bookings.filter(
      (b) => (ACTIVE as readonly string[]).includes(b.status) && new Date(b.startTs).getTime() > now,
    ).length
    // Senaste besök = nyaste GENOMFÖRDA bokning (bookings är start_ts desc).
    const lastVisit = bookings.find((b) => b.status === 'completed')?.startTs ?? null
    const returning = completed >= RETURNING_MIN

    if (bookings.length > 0) withBookings++
    if (returning) returningCount++
    if (c.first_seen_at && new Date(c.first_seen_at).getTime() >= monthStart) newThisMonth++

    return {
      id: c.id,
      tenantId,
      name: customerDisplayName(c),
      maskedEmail: c.masked_email,
      maskedPhone: c.masked_phone,
      hasEmail: c.has_email,
      hasPhone: c.has_phone,
      role: customerRole(c.auth_user_id),
      auth: customerAuthLabel(c.auth_user_id),
      status: customerStatusLabel(c.status, c.name_hidden),
      nameHidden: c.name_hidden,
      total: bookings.length,
      completed,
      cancelled,
      noShow,
      upcoming,
      lastVisit,
      firstSeen: c.first_seen_at,
      returning,
      bookings,
      inquiries,
    }
  })

  return {
    customers,
    summary: { total: customers.length, withBookings, returning: returningCount, newThisMonth },
    unlinkedInquiries,
    hasInquiries: inquiriesByCustomer.size > 0 || unlinkedInquiries.length > 0,
  }
}
