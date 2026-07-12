'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { revalidateTenant } from '@/lib/admin/tenant'
import { kronorToCents } from '@/lib/admin/format'
import type { ActionState } from '@/lib/admin/actions'
import { EVENT_STATUSES } from './types'

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

/**
 * Parse the shared event form fields (create + update use the same drawer form).
 * Returns an error string OR the validated payload. starts_at comes from
 * <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") and is stored as ISO.
 */
function parseEventFields(fd: FormData):
  | { error: string }
  | {
      title: string
      description: string | null
      starts_at: string
      duration_min: number
      capacity: number
      price_cents: number
    } {
  const title = String(fd.get('title') ?? '').trim()
  if (!title) return { error: 'Ange en titel.' }

  const startsRaw = String(fd.get('starts_at') ?? '').trim()
  const startsDate = startsRaw ? new Date(startsRaw) : null
  if (!startsDate || Number.isNaN(startsDate.getTime()))
    return { error: 'Ange datum och tid.' }

  const durationRaw = String(fd.get('duration_min') ?? '').trim()
  const duration_min = durationRaw !== '' ? parseInt(durationRaw, 10) : 120
  if (!Number.isInteger(duration_min) || duration_min <= 0)
    return { error: 'Ogiltig längd (minuter).' }

  const capacityRaw = String(fd.get('capacity') ?? '').trim()
  const capacity = parseInt(capacityRaw, 10)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)
    return { error: 'Ange max antal platser (1–500).' }

  const priceRaw = String(fd.get('price') ?? '').trim()
  const price_cents = priceRaw === '' ? 0 : (kronorToCents(priceRaw) ?? -1)
  if (price_cents < 0) return { error: 'Ogiltig avgift.' }

  const description = String(fd.get('description') ?? '').trim() || null

  return { title, description, starts_at: startsDate.toISOString(), duration_min, capacity, price_cents }
}

export async function createTenantEvent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const parsed = parseEventFields(fd)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { error } = await supabase.from('tenant_events').insert({
    tenant_id: ctx.tenant.id,
    ...parsed,
  })
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/kurser')
  return { success: 'Tillfälle skapat.' }
}

export async function updateTenantEvent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar tillfälle.' }

  const parsed = parseEventFields(fd)
  if ('error' in parsed) return parsed

  const supabase = await createClient()
  const { error } = await supabase
    .from('tenant_events')
    .update(parsed)
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/kurser')
  return { success: 'Tillfälle uppdaterat.' }
}

export async function setTenantEventStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar tillfälle.' }

  const statusRaw = String(fd.get('status') ?? '')
  if (!(EVENT_STATUSES as readonly string[]).includes(statusRaw))
    return { error: 'Ogiltig status.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tenant_events')
    .update({ status: statusRaw })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/kurser')
  return { success: 'Status uppdaterad.' }
}

export async function deleteTenantEvent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar tillfälle.' }

  const supabase = await createClient()

  // Ett tillfälle med bekräftade anmälningar får INTE raderas — anmälda gäster
  // skulle tappa sin plats spårlöst. Ställ in det i stället (status cancelled).
  const { count } = await supabase
    .from('event_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
    .eq('tenant_id', ctx.tenant.id)
    .eq('status', 'confirmed')
  if ((count ?? 0) > 0)
    return { error: 'Tillfället har anmälningar — ställ in det i stället.' }

  const { error } = await supabase
    .from('tenant_events')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/kurser')
  return { success: 'Tillfälle borttaget.' }
}

export async function setRegistrationStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar anmälan.' }

  const statusRaw = String(fd.get('status') ?? '')
  if (statusRaw !== 'confirmed' && statusRaw !== 'cancelled')
    return { error: 'Ogiltig status.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('event_registrations')
    .update({ status: statusRaw })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/kurser')
  return { success: 'Anmälan uppdaterad.' }
}
