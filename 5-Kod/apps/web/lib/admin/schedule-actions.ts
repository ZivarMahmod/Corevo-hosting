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

  if (!staffId) return { error: 'Välj en medarbetare.' }
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

  const startUtc = zonedTimeToUtc(from, '00:00', ctx.tenant.timeZone)
  const endUtc = zonedTimeToUtc(addDays(to, 1), '00:00', ctx.tenant.timeZone)

  const { error } = await supabase.from('time_off').insert({
    tenant_id: ctx.tenant.id,
    staff_id: staff.id,
    location_id: staff.location_id,
    start_ts: startUtc.toISOString(),
    end_ts: endUtc.toISOString(),
    reason: reason || null,
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
  const { data, error } = await supabase
    .from('time_off')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .select('id')
  if (error) return { error: GENERIC }
  if (!data || data.length === 0) return { error: 'Frånvaron hittades inte.' }

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

  const { data: existing } = await supabase
    .from('tenant_settings')
    .select('settings')
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  const backup = ((existing?.settings ?? {}) as { schedule_backup?: ScheduleBackup }).schedule_backup
  if (!backup || !Array.isArray(backup.working_hours) || !Array.isArray(backup.slots)) {
    return { error: 'Ingen sparad kopia finns att återställa till.' }
  }

  // Släng-och-återinsätt (raderna refereras inte av bokningar — bokade tider
  // ligger som timestamps på bookings). Inte transaktionellt över PostgREST:
  // om insert:en fallerar finns kopian kvar i settings och kan köras igen.
  const del1 = await supabase.from('working_hour_slots').delete().eq('tenant_id', ctx.tenant.id)
  const del2 = await supabase.from('working_hours').delete().eq('tenant_id', ctx.tenant.id)
  if (del1.error || del2.error) return { error: GENERIC }

  if (backup.working_hours.length > 0) {
    const { error } = await supabase
      .from('working_hours')
      .insert(backup.working_hours.map((r) => ({ ...r, tenant_id: ctx.tenant.id })))
    if (error) return { error: 'Återställningen misslyckades halvvägs — försök igen.' }
  }
  if (backup.slots.length > 0) {
    const { error } = await supabase
      .from('working_hour_slots')
      .insert(backup.slots.map((r) => ({ ...r, tenant_id: ctx.tenant.id })))
    if (error) return { error: 'Återställningen misslyckades halvvägs — försök igen.' }
  }

  revalidatePath('/admin/scheman')
  revalidateTenant(ctx.tenant.slug)
  return { success: 'Tiderna är återställda till som de var när du låste upp.' }
}
