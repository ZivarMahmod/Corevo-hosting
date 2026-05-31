'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal } from '@/lib/auth/session'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { getMyStaff } from './staff'

export type ActionState = { error?: string; success?: string }

const NO_PROFILE = 'Ingen personalprofil är kopplad till ditt konto. Kontakta salongsadmin.'
const TIME_RE = /^\d{2}:\d{2}$/

// ── Booking status: completed / no_show ──────────────────────────────────────
// staff_id is constrained to the caller's OWN staff ids (server-resolved) +
// status to active, so a staff can never mutate a colleague's or another
// tenant's booking. completed keeps the slot blocked; no_show frees it (the
// no_double_booking EXCLUDE excludes no_show).
export async function setBookingStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePortal('personal')
  const bookingId = String(formData.get('bookingId') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!bookingId) return { error: 'Saknar bokning.' }
  if (status !== 'completed' && status !== 'no_show') return { error: 'Ogiltig status.' }

  const staff = await getMyStaff(user.id)
  if (staff.length === 0) return { error: NO_PROFILE }
  const myStaffIds = staff.map((s) => s.id)

  const supabase = await createClient()
  const { error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .in('staff_id', myStaffIds)
    .in('status', ['pending', 'confirmed'])
  if (error) return { error: 'Kunde inte spara statusen. Försök igen.' }

  revalidatePath('/personal')
  return { success: 'Status sparad.' }
}

// ── Working hours (own) ──────────────────────────────────────────────────────
export async function addWorkingHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePortal('personal')
  const weekday = Number(formData.get('weekday'))
  const start = String(formData.get('start_time') ?? '')
  const end = String(formData.get('end_time') ?? '')

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { error: 'Välj en veckodag.' }
  if (!TIME_RE.test(start) || !TIME_RE.test(end)) return { error: 'Ange giltiga tider (HH:MM).' }
  if (end <= start) return { error: 'Sluttiden måste vara efter starttiden.' }

  const me = (await getMyStaff(user.id))[0]
  if (!me) return { error: NO_PROFILE }

  const supabase = await createClient()
  const { error } = await supabase.from('working_hours').insert({
    tenant_id: user.tenantId ?? '',
    staff_id: me.id,
    location_id: me.locationId,
    weekday,
    start_time: start,
    end_time: end,
  })
  if (error) return { error: 'Kunde inte spara arbetstiden. Försök igen.' }

  revalidatePath('/personal/arbetstider')
  return { success: 'Arbetstid tillagd.' }
}

export async function deleteWorkingHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePortal('personal')
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Saknar rad.' }

  const staff = await getMyStaff(user.id)
  if (staff.length === 0) return { error: NO_PROFILE }

  const supabase = await createClient()
  const { error } = await supabase
    .from('working_hours')
    .delete()
    .eq('id', id)
    .in('staff_id', staff.map((s) => s.id))
  if (error) return { error: 'Kunde inte ta bort arbetstiden. Försök igen.' }

  revalidatePath('/personal/arbetstider')
  return { success: 'Arbetstid borttagen.' }
}

// ── Time off (own) ───────────────────────────────────────────────────────────
// datetime-local values are tz-less wall-clock strings; convert through the
// shared zonedTimeToUtc in the staff's location timezone so the stored UTC
// interval lines up with what the M3 availability engine subtracts.
export async function addTimeOff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePortal('personal')
  const startLocal = String(formData.get('start') ?? '')
  const endLocal = String(formData.get('end') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()

  if (!startLocal || !endLocal) return { error: 'Ange både start och slut.' }

  const me = (await getMyStaff(user.id))[0]
  if (!me) return { error: NO_PROFILE }

  const startUtc = localToUtc(startLocal, me.timeZone)
  const endUtc = localToUtc(endLocal, me.timeZone)
  if (!startUtc || !endUtc) return { error: 'Ogiltigt datum/tid.' }
  if (endUtc.getTime() <= startUtc.getTime()) return { error: 'Slutet måste vara efter starten.' }

  const supabase = await createClient()
  const { error } = await supabase.from('time_off').insert({
    tenant_id: user.tenantId ?? '',
    staff_id: me.id,
    location_id: me.locationId,
    start_ts: startUtc.toISOString(),
    end_ts: endUtc.toISOString(),
    reason: reason || null,
  })
  if (error) return { error: 'Kunde inte spara frånvaron. Försök igen.' }

  revalidatePath('/personal/franvaro')
  return { success: 'Frånvaro tillagd.' }
}

export async function deleteTimeOff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePortal('personal')
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Saknar rad.' }

  const staff = await getMyStaff(user.id)
  if (staff.length === 0) return { error: NO_PROFILE }

  const supabase = await createClient()
  const { error } = await supabase
    .from('time_off')
    .delete()
    .eq('id', id)
    .in('staff_id', staff.map((s) => s.id))
  if (error) return { error: 'Kunde inte ta bort frånvaron. Försök igen.' }

  revalidatePath('/personal/franvaro')
  return { success: 'Frånvaro borttagen.' }
}

/** 'YYYY-MM-DDTHH:MM' (datetime-local) → exact UTC instant in `timeZone`. */
function localToUtc(local: string, timeZone: string): Date | null {
  const [date, time] = local.split('T')
  if (!date || !time) return null
  return zonedTimeToUtc(date, time.slice(0, 5), timeZone)
}
