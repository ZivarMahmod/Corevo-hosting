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
const REFUND_REQUIRED =
  'Återbetalning krävs innan en betald anmälan kan avbokas. Ingen status ändrades.'

function eventLifecycleError(error: { message?: string; code?: string; details?: string } | null): string | null {
  if (!error) return null
  const message = error.message ?? ''
  if (message.includes('paid_refund_required')) return REFUND_REQUIRED
  if (message.includes('event_capacity_exceeded')) {
    const left = Number.parseInt(error.details ?? '', 10)
    return Number.isFinite(left)
      ? `Anmälan får inte plats. Lediga platser: ${Math.max(0, left)}.`
      : 'Anmälan får inte plats.'
  }
  if (message.includes('event_capacity_below_occupancy'))
    return 'Max platser kan inte vara lägre än redan bokade eller reserverade platser.'
  if (message.includes('event_module_read_only'))
    return 'Kurser & event är pausad och kan inte ändras.'
  if (message.includes('status_transition_invalid'))
    return 'Den statusövergången är inte tillåten.'
  return GENERIC
}

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
  const ctx = await moduleCtx(fd, 'kurser')
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
  const ctx = await moduleCtx(fd, 'kurser')
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
  const ctx = await moduleCtx(fd, 'kurser')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar tillfälle.' }

  const statusRaw = String(fd.get('status') ?? '')
  if (!(EVENT_STATUSES as readonly string[]).includes(statusRaw))
    return { error: 'Ogiltig status.' }

  const reason = String(fd.get('reason') ?? '').trim()
    || (statusRaw === 'cancelled' ? 'Inställt av administratör' : null)
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_tenant_event_status', {
    p_tenant: ctx.tenant.id,
    p_event: id,
    p_status: statusRaw,
    p_reason: reason ?? undefined,
  })
  if (error) return { error: eventLifecycleError(error) ?? GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/kurser')
  return { success: 'Status uppdaterad.' }
}

export async function deleteTenantEvent(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'kurser')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar tillfälle.' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('tenant_events')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error?.message.includes('event_has_registration_history') || error?.code === '23503')
    return { error: 'Tillfället har historik — ställ in det i stället.' }
  if (error) return { error: eventLifecycleError(error) ?? GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/kurser')
  return { success: 'Tillfälle borttaget.' }
}

export async function setRegistrationStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd, 'kurser')
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '').trim()
  if (!id) return { error: 'Saknar anmälan.' }

  const statusRaw = String(fd.get('status') ?? '')
  if (statusRaw !== 'confirmed' && statusRaw !== 'cancelled')
    return { error: 'Ogiltig status.' }

  const reason = String(fd.get('reason') ?? '').trim()
    || (statusRaw === 'cancelled'
      ? 'Avbokad av administratör'
      : 'Återanmäld av administratör')
  const supabase = await createClient()
  const { error } = await supabase.rpc('set_event_registration_status', {
    p_tenant: ctx.tenant.id,
    p_registration: id,
    p_status: statusRaw,
    p_reason: reason,
  })
  if (error) return { error: eventLifecycleError(error) ?? GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/kurser')
  return { success: 'Anmälan uppdaterad.' }
}
