'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireAdminArea, type CurrentUser } from '@/lib/auth/session'
import { getAdminTenant, revalidateTenant, type AdminTenant } from './tenant'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { addDays } from '@/lib/personal/format'

export type ActionState = { error?: string; success?: string }

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Samma auktoriseringsstaket som lib/admin/actions.ts (adminCtx): RLS isolerar
 * bara tenants, den är INTE roll-medveten — roll-grinden ligger därför här i
 * server-actionen. Tenanten kommer ALLTID ur sessionen, aldrig ur klient-input.
 */
async function adminCtx(): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  const user = await requireAdminArea('scheman')
  const tenant = await getAdminTenant(user)
  if (!tenant) return null
  return { user, tenant }
}

type LocationBookingHourInput = {
  weekday: number
  start_time: string
  end_time: string
}

type LocationSettingsRpc = {
  rpc(
    fn: 'save_location_booking_settings',
    args: {
      p_location: string
      p_hours: LocationBookingHourInput[]
      p_slot_step_min: number
      p_min_notice_min: number
      p_max_advance_days: number
    },
  ): Promise<{ error: { message: string; code?: string } | null }>
}

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function parseLocationBookingSettings(fd: FormData):
  | { error: string }
  | {
      locationId: string
      hours: LocationBookingHourInput[]
      slotStepMin: number
      minNoticeMin: number
      maxAdvanceDays: number
    } {
  const locationId = String(fd.get('location_id') ?? '')
  if (!locationId) return { error: 'Välj vilken plats tiderna gäller.' }

  const weekdays = fd.getAll('weekday').map(Number)
  const starts = fd.getAll('start_time').map(String)
  const ends = fd.getAll('end_time').map(String)
  if (weekdays.length !== starts.length || weekdays.length !== ends.length || weekdays.length > 28) {
    return { error: 'Kontrollera veckans öppettider och försök igen.' }
  }

  const hours = weekdays
    .map((weekday, index) => ({
      weekday,
      start_time: starts[index] ?? '',
      end_time: ends[index] ?? '',
    }))
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))

  if (hours.length === 0) {
    return { error: 'Lägg in minst ett öppet pass innan tiderna kan bekräftas.' }
  }

  for (let index = 0; index < hours.length; index += 1) {
    const row = hours[index]!
    if (
      !Number.isInteger(row.weekday) ||
      row.weekday < 0 ||
      row.weekday > 6 ||
      !TIME_RE.test(row.start_time) ||
      !TIME_RE.test(row.end_time) ||
      row.end_time <= row.start_time
    ) {
      return { error: 'Varje öppet pass måste ha en giltig start- och sluttid.' }
    }
    const previous = hours[index - 1]
    if (previous?.weekday === row.weekday && row.start_time < previous.end_time) {
      return { error: 'Öppettider samma dag får inte överlappa varandra.' }
    }
  }

  const slotStepMin = Number(fd.get('slot_step_min'))
  const minNoticeMin = Number(fd.get('min_notice_min'))
  const maxAdvanceDays = Number(fd.get('max_advance_days'))
  if (!Number.isInteger(slotStepMin) || slotStepMin < 1 || slotStepMin > 240) {
    return { error: 'Tidsintervallet måste vara mellan 1 och 240 minuter.' }
  }
  if (!Number.isInteger(minNoticeMin) || minNoticeMin < 0 || minNoticeMin > 525_600) {
    return { error: 'Framförhållningen måste vara mellan 0 och 525 600 minuter.' }
  }
  if (!Number.isInteger(maxAdvanceDays) || maxAdvanceDays < 1 || maxAdvanceDays > 1095) {
    return { error: 'Bokningshorisonten måste vara mellan 1 och 1 095 dagar.' }
  }

  return { locationId, hours, slotStepMin, minNoticeMin, maxAdvanceDays }
}

/** Sparar platsens bokningsfönster atomiskt i 0076-RPC:n: regler och alla
 *  veckointervall lyckas tillsammans eller inte alls. */
export async function saveLocationBookingSettings(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const parsed = parseLocationBookingSettings(fd)
  if ('error' in parsed) return { error: parsed.error }
  const { locationId, hours, slotStepMin, minNoticeMin, maxAdvanceDays } = parsed

  const supabase = await createClient()
  const { error } = await (supabase as unknown as LocationSettingsRpc).rpc(
    'save_location_booking_settings',
    {
      p_location: locationId,
      p_hours: hours,
      p_slot_step_min: slotStepMin,
      p_min_notice_min: minNoticeMin,
      p_max_advance_days: maxAdvanceDays,
    },
  )
  if (error) return { error: GENERIC }

  revalidatePath('/admin/scheman')
  revalidatePath('/personal/arbetstider')
  revalidatePath('/boka')
  revalidateTenant(ctx.tenant.slug)
  return { success: 'Öppettider och bokningsregler sparade.' }
}

/**
 * Lägg frånvaro för en medarbetare (heldagar). Datumen tolkas i TENANTENS tz:
 * från-dagens 00:00 → dagen EFTER till-dagens 00:00 ("24:00"), via den delade
 * DST-säkra zonedTimeToUtc — samma konvertering som personalens egen addTimeOff,
 * så motorn subtraherar exakt samma UTC-intervall oavsett vem som skrev raden.
 */
export async function addStaffTimeOff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const staffId = String(fd.get('staff_id') ?? '')
  const from = String(fd.get('from') ?? '')
  const to = String(fd.get('to') ?? '')
  const reason = String(fd.get('reason') ?? '').trim()
  const kind = String(fd.get('kind') ?? '')

  if (!staffId) return { error: 'Välj en medarbetare.' }
  if (!['leave', 'sick', 'other'].includes(kind)) return { error: 'Välj typ av frånvaro.' }
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return { error: 'Ange både från- och till-datum.' }
  if (to < from) return { error: 'Till-datumet måste vara samma dag som eller efter från-datumet.' }

  const supabase = await createClient()

  // staff_id är klient-input och MÅSTE höra till adminens egen tenant. RLS fencar
  // insert:en ändå, men vi verifierar explicit för ett rent fel — och för att
  // hämta medarbetarens plats så frånvaron pinnas likadant som personal-flödet.
  const { data: staff } = await supabase
    .from('staff')
    .select('id, location_id')
    .eq('id', staffId)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!staff) return { error: 'Medarbetaren hittades inte.' }

  if (!staff.location_id) return { error: 'Medarbetaren saknar en giltig plats.' }
  const { data: location } = await supabase
    .from('locations')
    .select('timezone')
    .eq('id', staff.location_id)
    .eq('tenant_id', ctx.tenant.id)
    .eq('active', true)
    .maybeSingle()
  if (!location) return { error: 'Medarbetarens plats är inte tillgänglig.' }

  const startUtc = zonedTimeToUtc(from, '00:00', location.timezone)
  const endUtc = zonedTimeToUtc(addDays(to, 1), '00:00', location.timezone)

  const timeOffRpc = supabase as unknown as {
    rpc(
      name: 'create_admin_time_off',
      args: {
        p_location: string
        p_staff: string
        p_start: string
        p_end: string
        p_kind: string
        p_reason: string
        p_series_id: null
      },
    ): PromiseLike<{ data: string | null; error: { message: string } | null }>
  }
  const { error } = await timeOffRpc.rpc('create_admin_time_off', {
    p_location: staff.location_id,
    p_staff: staff.id,
    p_start: startUtc.toISOString(),
    p_end: endUtc.toISOString(),
    p_kind: kind,
    p_reason: reason || (kind === 'sick' ? 'Sjukfrånvaro' : kind === 'leave' ? 'Ledighet' : 'Annat'),
    p_series_id: null,
  })
  if (error) return { error: GENERIC }

  // Frånvaron stänger tider i det publika boka-flödet → invalidera storefronten också.
  revalidatePath('/admin/scheman')
  revalidateTenant(ctx.tenant.slug)
  return { success: 'Frånvaro tillagd — tiderna blockeras i boka-flödet.' }
}

/** Ta bort en frånvaro-rad. `.select('id')` efter delete så vi ser om raden
 *  faktiskt fanns i vår tenant — en tyst no-op ska inte ge en falsk succé-toast. */
export async function removeStaffTimeOff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar rad.' }

  const supabase = await createClient()
  const timeOffRpc = supabase as unknown as {
    rpc(
      name: 'delete_admin_time_off',
      args: { p_time_off: string; p_delete_series: false },
    ): PromiseLike<{ data: number | null; error: { message: string } | null }>
  }
  const { data, error } = await timeOffRpc.rpc('delete_admin_time_off', {
    p_time_off: id,
    p_delete_series: false,
  })
  if (error) return { error: GENERIC }
  if (!data) return { error: 'Frånvaron hittades inte.' }

  revalidatePath('/admin/scheman')
  revalidateTenant(ctx.tenant.slug)
  return { success: 'Frånvaro borttagen — tiderna öppnas igen i boka-flödet.' }
}

// ── Schema-lås med ångra (Zivar: tiderna läggs en gång och ska inte ändras av
// misstag — "Lås upp" kräver bekräftelse, och allt kan återställas till exakt
// som det var innan upplåsningen). Kopian tas VID upplåsningen och ligger i
// tenant_settings.settings.schedule_backup (merge, aldrig clobber — settings är
// co-owned jsonb). En kopia per tenant: nästa upplåsning skriver över förra.

type BackupHourRow = {
  staff_id: string
  location_id: string | null
  weekday: number
  start_time: string
  end_time: string
}
type BackupSlotRow = {
  staff_id: string
  location_id: string | null
  weekday: number
  start_time: string
  active: boolean
}
type ScheduleBackup = { taken_at: string; working_hours: BackupHourRow[]; slots: BackupSlotRow[] }

/** Ta en kopia av ALLA grundtider (arbetstider + bokbara starttider) för salongen.
 *  Anropas när ägaren låser upp schemaredigeringen. */
export async function unlockScheduleWithBackup(): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }
  const supabase = await createClient()

  const [{ data: hours, error: e1 }, { data: slots, error: e2 }] = await Promise.all([
    supabase
      .from('working_hours')
      .select('staff_id, location_id, weekday, start_time, end_time')
      .eq('tenant_id', ctx.tenant.id),
    supabase
      .from('working_hour_slots')
      .select('staff_id, location_id, weekday, start_time, active')
      .eq('tenant_id', ctx.tenant.id),
  ])
  if (e1 || e2) return { error: GENERIC }

  const backup: ScheduleBackup = {
    taken_at: new Date().toISOString(),
    working_hours: (hours ?? []) as BackupHourRow[],
    slots: (slots ?? []) as BackupSlotRow[],
  }

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  const prev = (existing?.settings ?? {}) as Record<string, unknown>
  const { error } = await supabase
    .from('tenant_settings')
    .upsert({ tenant_id: ctx.tenant.id, settings: { ...prev, schedule_backup: backup } }, { onConflict: 'tenant_id' })
  if (error) return { error: GENERIC }

  return { success: 'Upplåst. En kopia av tiderna är sparad — du kan alltid återställa.' }
}

/** Återställ grundtiderna till kopian som togs vid senaste upplåsningen. */
export async function restoreScheduleBackup(): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }
  const supabase = await createClient()

  // Delete+insert av båda tabellerna sker i en DB-transaktion. Ett enda fel rullar
  // tillbaka allt; användaren kan aldrig stå med ett halvåterställt schema.
  const { error } = await supabase.rpc('restore_schedule_backup')
  if (error?.message.includes('missing_schedule_backup')) {
    return { error: 'Ingen sparad kopia finns att återställa till.' }
  }
  if (error) return { error: GENERIC }

  revalidatePath('/admin/scheman')
  revalidateTenant(ctx.tenant.slug)
  return { success: 'Tiderna är återställda till som de var när du låste upp.' }
}
