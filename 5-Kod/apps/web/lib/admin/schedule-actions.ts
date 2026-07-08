'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal, type CurrentUser } from '@/lib/auth/session'
import { getAdminTenant, revalidateTenant, type AdminTenant } from './tenant'
import { zonedTimeToUtc } from '@/lib/booking/tz'
import { addDays } from '@/lib/personal/format'

export type ActionState = { error?: string; success?: string }

const NO_TENANT = 'Ingen salong är kopplad till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Samma auktoriseringsstaket som lib/admin/actions.ts (adminCtx): RLS isolerar
 * bara tenants, den är INTE roll-medveten — roll-grinden ligger därför här i
 * server-actionen. Tenanten kommer ALLTID ur sessionen, aldrig ur klient-input.
 */
async function adminCtx(): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  const user = await requirePortal('admin')
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
