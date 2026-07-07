'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { kronorToCents } from '../billing'
import { logPlatformAction } from '../audit'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'

// Ongoing super-admin services management for a CHOSEN salon (goal: manage a tenant's
// services from the platform tenant-detail page, not just at tenant-create). Mirrors
// people.ts (createTenantStaff / createPlatformCustomer): every action goes through
// platformCtx() (RLS bypass via platform_admin), validates input server-side, never
// trusts the client's tenant_id, then revalidates + audit-logs. update/delete are
// scoped `.eq('tenant_id', tenantId)` so a tampered form can't touch another salon's
// service. "Kund" here = the SALONG (tenant); this is the platform operator's surface,
// not the salon's own admin.

/** kr form field → integer öre, never negative (kronorToCents floors invalid/negative
 *  to null; we treat a blank/invalid price as 0, the services.price_cents default). */
function priceCentsFrom(fd: FormData): number {
  return kronorToCents(String(fd.get('price') ?? '')) ?? 0
}

/** "45" → 45, clamped to a positive int. null when absent/invalid so callers can decide
 *  (create seeds the 30-min default; update rejects). */
function parseDuration(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null
  return n
}

/**
 * Add a service to a CHOSEN salon. duration_min is NOT NULL CHECK>0 — the design
 * collects no duration at create, so seed the universal 30-min default (mirrors
 * createTenant's service seed at tenants.ts:258); the operator edits it per service
 * here. Validates the tenant EXISTS server-side (never trust the client's tenant_id);
 * no active-gate — prepping a paused/pre-launch salon's service list is a normal
 * operator activity.
 */
export async function createTenantService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const name = String(fd.get('name') ?? '').trim().slice(0, 120)
  const priceCents = priceCentsFrom(fd)
  const durationMin = parseDuration(fd.get('duration_min')) ?? 30

  if (!tenantId) return { error: 'Saknar salong.' }
  if (!name) return { error: 'Ange ett namn på tjänsten.' }
  if (priceCents < 0) return { error: 'Ogiltigt pris.' }

  // Validate the chosen tenant server-side: never attach a service to a non-existent
  // salon, and never trust the client's tenant_id without this check.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) return { error: 'Salongen finns inte.' }

  const { data: created, error } = await supabase
    .from('services')
    .insert({
      tenant_id: tenantId,
      name,
      duration_min: durationMin,
      price_cents: priceCents,
      active: true,
    })
    .select('id')
    .single()
  if (error || !created) {
    await reportActionError('createTenantService.insert', error, { tenantId })
    return { error: GENERIC }
  }

  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.service_create',
    tenantId,
    actorId: user.id,
    entityId: created.id,
    meta: { name, price_cents: priceCents, duration_min: durationMin },
  })
  return { success: `Tjänst "${name}" tillagd.` }
}

/**
 * Edit a service (name · duration · price · active) by id, scoped to the tenant so a
 * tampered form can't edit another salon's service. duration_min > 0 is enforced
 * (schema CHECK); price floored to ≥0.
 */
export async function updateTenantService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const serviceId = String(fd.get('serviceId') ?? '')
  const name = String(fd.get('name') ?? '').trim().slice(0, 120)
  const priceCents = priceCentsFrom(fd)
  const durationMin = parseDuration(fd.get('duration_min'))
  const active = fd.get('active') === 'on'

  if (!tenantId) return { error: 'Saknar salong.' }
  if (!serviceId) return { error: 'Saknar tjänst.' }
  if (!name) return { error: 'Ange ett namn på tjänsten.' }
  if (durationMin === null) return { error: 'Längd måste vara ett positivt antal minuter.' }
  if (priceCents < 0) return { error: 'Ogiltigt pris.' }

  const { error } = await supabase
    .from('services')
    .update({
      name,
      duration_min: durationMin,
      price_cents: priceCents,
      active,
    })
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('updateTenantService.update', error, { tenantId })
    return { error: GENERIC }
  }

  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.service_update',
    tenantId,
    actorId: user.id,
    entityId: serviceId,
    meta: { name, price_cents: priceCents, duration_min: durationMin, active },
  })
  return { success: `Tjänst "${name}" sparad.` }
}

/**
 * Delete a service by id, scoped to the tenant so a tampered form can't delete another
 * salon's service. Hard delete is appropriate here (a service is catalog content, not
 * the build-once-never-delete tenant/booking history).
 */
export async function deleteTenantService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const serviceId = String(fd.get('serviceId') ?? '')

  if (!tenantId) return { error: 'Saknar salong.' }
  if (!serviceId) return { error: 'Saknar tjänst.' }

  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('deleteTenantService.delete', error, { tenantId })
    return { error: GENERIC }
  }

  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.service_delete',
    tenantId,
    actorId: user.id,
    entityId: serviceId,
  })
  return { success: 'Tjänst borttagen.' }
}
