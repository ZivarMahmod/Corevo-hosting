'use server'

import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/public'
import { computeSlots, type Interval } from '@/lib/booking/availability'
import { weekdayOf, zonedTimeToUtc } from '@/lib/booking/tz'

// The public booking flow runs as the anon role. Reads of staff/services/
// working_hours are gated by the anon RLS policies; busy times come from the
// get_busy_intervals RPC (no PII) and the insert goes through create_public_booking
// (validates tenant/service/staff server-side). Tenant identity is taken from the
// middleware-resolved header — NEVER from the client.

export type SlotOption = { start: string; staffId: string; staffTitle: string | null }
export type SlotsResult =
  | { ok: true; timeZone: string; slots: SlotOption[] }
  | { ok: false; error: string }

export type CreateBookingInput = {
  serviceId: string
  staffId: string
  startISO: string
  name: string
  email: string
  phone: string
  note?: string
}
export type CreateResult =
  | { ok: true; bookingId: string; requiresPayment: boolean }
  | { ok: false; reason: 'slot_taken' | 'invalid' | 'error'; message: string }

const SLOT_STEP_MIN = 15

type TenantContext = { tenantId: string; slug: string; timeZone: string }

/** Resolve the request's tenant from the middleware header (never the client). */
async function getTenantContext(): Promise<TenantContext | null> {
  const h = await headers()
  const slug = h.get('x-corevo-tenant-slug')
  if (!slug) return null
  const supabase = createPublicClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  if (!tenant) return null
  const { data: loc } = await supabase
    .from('locations')
    .select('timezone')
    .eq('tenant_id', tenant.id)
    .eq('is_primary', true)
    .maybeSingle()
  return { tenantId: tenant.id, slug: tenant.slug, timeZone: loc?.timezone ?? 'Europe/Stockholm' }
}

/**
 * Available start times for a service on a date, optionally for one staff member
 * (null = "Alla", any staff who offers it). Each returned slot carries the staff
 * member who would take it, so booking is unambiguous.
 */
export async function getAvailableSlots(
  serviceId: string,
  staffId: string | null,
  date: string,
): Promise<SlotsResult> {
  const ctx = await getTenantContext()
  if (!ctx) return { ok: false, error: 'Okänd salong.' }
  const supabase = createPublicClient()

  const { data: service } = await supabase
    .from('services')
    .select('duration_min')
    .eq('id', serviceId)
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .maybeSingle()
  if (!service) return { ok: false, error: 'Tjänsten hittades inte.' }

  // staff who offer this service
  const { data: offers } = await supabase
    .from('staff_services')
    .select('staff_id')
    .eq('tenant_id', ctx.tenantId)
    .eq('service_id', serviceId)
  let candidateIds = (offers ?? []).map((r) => r.staff_id)
  if (staffId) candidateIds = candidateIds.filter((id) => id === staffId)
  if (candidateIds.length === 0) return { ok: true, timeZone: ctx.timeZone, slots: [] }

  const { data: staffRows } = await supabase
    .from('staff')
    .select('id, title')
    .eq('tenant_id', ctx.tenantId)
    .eq('active', true)
    .in('id', candidateIds)
  const staffIds = (staffRows ?? []).map((s) => s.id)
  const titleById = new Map((staffRows ?? []).map((s) => [s.id, s.title]))
  if (staffIds.length === 0) return { ok: true, timeZone: ctx.timeZone, slots: [] }

  const weekday = weekdayOf(date)
  const { data: hours } = await supabase
    .from('working_hours')
    .select('staff_id, start_time, end_time')
    .eq('tenant_id', ctx.tenantId)
    .eq('weekday', weekday)
    .in('staff_id', staffIds)

  // busy intervals for the whole day (+margin for DST-long days) via RPC
  const dayStart = zonedTimeToUtc(date, '00:00', ctx.timeZone)
  const dayEnd = new Date(dayStart.getTime() + 26 * 60 * 60 * 1000)
  const { data: busyRows } = await supabase.rpc('get_busy_intervals', {
    p_tenant: ctx.tenantId,
    p_staff_ids: staffIds,
    p_from: dayStart.toISOString(),
    p_to: dayEnd.toISOString(),
  })

  const windowsByStaff = new Map<string, { start: string; end: string }[]>()
  for (const w of hours ?? []) {
    const list = windowsByStaff.get(w.staff_id) ?? []
    list.push({ start: w.start_time, end: w.end_time })
    windowsByStaff.set(w.staff_id, list)
  }
  const busyByStaff = new Map<string, Interval[]>()
  for (const b of busyRows ?? []) {
    const list = busyByStaff.get(b.staff_id) ?? []
    list.push({ start: new Date(b.start_ts), end: new Date(b.end_ts) })
    busyByStaff.set(b.staff_id, list)
  }

  const now = new Date()
  // start ISO → the (first) staff free at that time
  const byStart = new Map<string, string>()
  for (const id of staffIds) {
    const slots = computeSlots({
      date,
      timeZone: ctx.timeZone,
      workingWindows: windowsByStaff.get(id) ?? [],
      busy: busyByStaff.get(id) ?? [],
      durationMin: service.duration_min,
      slotStepMin: SLOT_STEP_MIN,
      now,
    })
    for (const d of slots) {
      const iso = d.toISOString()
      if (!byStart.has(iso)) byStart.set(iso, id)
    }
  }

  const slots: SlotOption[] = [...byStart.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([start, sId]) => ({ start, staffId: sId, staffTitle: titleById.get(sId) ?? null }))

  return { ok: true, timeZone: ctx.timeZone, slots }
}

/** Create a booking from the public flow. Leans on the EXCLUDE constraint. */
export async function createBooking(input: CreateBookingInput): Promise<CreateResult> {
  const ctx = await getTenantContext()
  if (!ctx) return { ok: false, reason: 'invalid', message: 'Okänd salong.' }

  const name = input.name.trim()
  const email = input.email.trim()
  const phone = input.phone.trim()
  if (!name || !email || !phone) {
    return { ok: false, reason: 'invalid', message: 'Fyll i namn, e-post och telefon.' }
  }
  if (!input.serviceId || !input.staffId || !input.startISO) {
    return { ok: false, reason: 'invalid', message: 'Ofullständig bokning. Börja om.' }
  }

  // Guest contact has no home table yet (customers table is a future goal), so it
  // rides `note` as a clearly-labelled temporary seam.
  const contactNote =
    `Gäst: ${name} <${email}> ${phone}` + (input.note?.trim() ? ` — ${input.note.trim()}` : '')

  const supabase = createPublicClient()
  const { data: bookingId, error } = await supabase.rpc('create_public_booking', {
    p_tenant_slug: ctx.slug,
    p_service: input.serviceId,
    p_staff: input.staffId,
    p_start: input.startISO,
    p_note: contactNote,
  })

  if (error) {
    if (error.code === '23P01') {
      return { ok: false, reason: 'slot_taken', message: 'Tyvärr, tiden togs precis. Välj en annan tid.' }
    }
    return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  }
  if (!bookingId) {
    return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  }

  // requiresPayment is the G09 seam — derived from the tenant's payment mode.
  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('payment_mode')
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  const requiresPayment = settings?.payment_mode === 'online' || settings?.payment_mode === 'both'

  return { ok: true, bookingId, requiresPayment }
}
