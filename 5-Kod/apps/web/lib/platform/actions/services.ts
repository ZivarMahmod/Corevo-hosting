'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { kronorToCents } from '../billing'
import { logPlatformAction } from '../audit'
import { uploadImage, deleteByPublicUrl } from '@/lib/r2/upload'
import { type ActionState, GENERIC } from './shared'
import { reportActionError } from './observe'
import { revalidateTenantById } from '@/lib/admin/tenant'

// Ongoing super-admin services management for a CHOSEN salon (goal: manage a tenant's
// services from the platform tenant-detail page). Every action goes through
// platformCtx() (RLS bypass via platform_admin), validates input server-side, never
// trusts the client's tenant_id, then revalidates + audit-logs. update/delete/etc are
// scoped `.eq('tenant_id', tenantId)` so a tampered form can't touch another salon's
// service. "Kund" here = the SALONG (tenant); this is the platform operator's surface.
//
// The merch columns (sale_price_cents / badge / image_url / sort_order) land in
// migration 0046 — the generated Supabase types don't know them yet, so writes cast
// the patch to `never` (bypass the row-type check) and reads cast the row to the
// extended shape below. Runtime is safe: 0046 is applied before this ships.
type ServiceMerchPatch = Record<string, unknown>

/** kr form field → integer öre (>= 0). Blank/invalid → null so callers REJECT it
 *  (never silently store 0 kr — a blanked price field must not make a tjänst gratis). */
function priceCentsFrom(fd: FormData, field = 'price'): number | null {
  const cents = kronorToCents(String(fd.get(field) ?? ''))
  return cents === null || cents < 0 ? null : cents
}

/** kr field → öre or null (blank = no value; used for the optional sale price). */
function optionalCentsFrom(fd: FormData, field: string): number | null {
  const raw = String(fd.get(field) ?? '').trim()
  if (!raw) return null
  const cents = kronorToCents(raw)
  return cents === null || cents < 0 ? null : cents
}

/** "45" → 45 (positive int) else null so callers decide (create seeds 30, update rejects). */
function parseDuration(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null
  return n
}

/** Optional trimmed text → the string or null (blank = clear). Capped defensively. */
function optionalText(fd: FormData, field: string, max: number): string | null {
  const raw = String(fd.get(field) ?? '').trim()
  return raw ? raw.slice(0, max) : null
}

/** "3" → 3 (non-negative int); blank/invalid → 0 (default order). */
function parseSort(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? '').trim())
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : 0
}

/**
 * Add a service to a CHOSEN salon. Minimal by design (namn · pris · längd) so the
 * add-form stays light; the operator fills description/category/badge/rabatt/personal
 * per service in the edit surface. duration_min is NOT NULL CHECK>0 → seed 30 when
 * blank. Validates the tenant EXISTS (never trust the client's tenant_id).
 */
export async function createTenantService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const name = String(fd.get('name') ?? '').trim().slice(0, 120)
  const priceCents = priceCentsFrom(fd)
  const durationMin = parseDuration(fd.get('duration_min')) ?? 30

  if (!tenantId) return { error: 'Saknar kund.' }
  if (!name) return { error: 'Ange ett namn på tjänsten.' }
  if (priceCents === null) return { error: 'Ange ett giltigt pris (kr).' }

  const { data: tenant } = await supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle()
  if (!tenant) return { error: 'Kunden finns inte.' }

  const { data: created, error } = await supabase
    .from('services')
    .insert({ tenant_id: tenantId, name, duration_min: durationMin, price_cents: priceCents, active: true })
    .select('id')
    .single()
  if (error || !created) {
    await reportActionError('createTenantService.insert', error, { tenantId })
    return { error: GENERIC }
  }

  // goal-61 preview-parity: tjänsterna cachas under `tenant:<slug>` (getServices) —
  // utan tag-bust visade preview + publika sajten gamla tjänster i upp till 300 s.
  await revalidateTenantById(supabase, tenantId)
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
 * Edit a service in full (namn · pris · rabattpris · längd · kategori · badge ·
 * beskrivning · sortering · aktiv), scoped to the tenant. duration_min > 0 enforced;
 * blank optional fields are stored as NULL (= cleared / fall back to defaults).
 */
export async function updateTenantService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const serviceId = String(fd.get('serviceId') ?? '')
  const name = String(fd.get('name') ?? '').trim().slice(0, 120)
  const priceCents = priceCentsFrom(fd)
  const salePriceCents = optionalCentsFrom(fd, 'sale_price')
  const durationMin = parseDuration(fd.get('duration_min'))
  const active = fd.get('active') === 'on'
  const description = optionalText(fd, 'description', 2000)
  const category = optionalText(fd, 'category', 60)
  const badge = optionalText(fd, 'badge', 40)
  const sortOrder = parseSort(fd.get('sort_order'))

  if (!tenantId) return { error: 'Saknar kund.' }
  if (!serviceId) return { error: 'Saknar tjänst.' }
  if (!name) return { error: 'Ange ett namn på tjänsten.' }
  if (priceCents === null) return { error: 'Ange ett giltigt pris (kr).' }
  if (durationMin === null) return { error: 'Längd måste vara ett positivt antal minuter.' }
  // A rabattpris must be lower than ordinarie pris to mean anything (else it reads as
  // a price hike badge). Reject rather than store a confusing "discount".
  if (salePriceCents !== null && salePriceCents >= priceCents) {
    return { error: 'Rabattpriset måste vara lägre än ordinarie pris.' }
  }

  const patch: ServiceMerchPatch = {
    name,
    price_cents: priceCents,
    sale_price_cents: salePriceCents,
    duration_min: durationMin,
    active,
    description,
    category,
    badge,
    sort_order: sortOrder,
  }

  const { error } = await supabase
    .from('services')
    .update(patch as never)
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('updateTenantService.update', error, { tenantId })
    return { error: GENERIC }
  }

  // goal-61 preview-parity: tjänsterna cachas under `tenant:<slug>` (getServices) —
  // utan tag-bust visade preview + publika sajten gamla tjänster i upp till 300 s.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.service_update',
    tenantId,
    actorId: user.id,
    entityId: serviceId,
    meta: { name, price_cents: priceCents, sale_price_cents: salePriceCents, duration_min: durationMin, active },
  })
  return { success: `Tjänst "${name}" sparad.` }
}

/**
 * Delete a service — but bookings.service_id is FK RESTRICT (0001), so a service that
 * has ANY booking CAN'T be hard-deleted (the DB blocks it). We pre-check and refuse
 * with an honest message pointing at the reversible path (stäng av = active=false,
 * bevarar historiken). Only a service with zero bookings is actually removed.
 */
export async function deleteTenantService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const serviceId = String(fd.get('serviceId') ?? '')

  if (!tenantId) return { error: 'Saknar kund.' }
  if (!serviceId) return { error: 'Saknar tjänst.' }

  const { count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('service_id', serviceId)
  if ((count ?? 0) > 0) {
    return {
      error:
        'Tjänsten har bokningar och kan inte raderas (historiken skyddas). Stäng av den i stället — då försvinner den från bokning och sida men raden bevaras.',
    }
  }

  const { error } = await supabase.from('services').delete().eq('id', serviceId).eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('deleteTenantService.delete', error, { tenantId })
    return { error: GENERIC }
  }

  // goal-61 preview-parity: tjänsterna cachas under `tenant:<slug>` (getServices) —
  // utan tag-bust visade preview + publika sajten gamla tjänster i upp till 300 s.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.service_delete',
    tenantId,
    actorId: user.id,
    entityId: serviceId,
  })
  return { success: 'Tjänst borttagen.' }
}

/**
 * Set which staff can perform a service (staff_services, existing 0001 join). REPLACE
 * semantics: the submitted `staffId` set becomes the whole set for this service. Booking
 * uses this to fence which behandlare are offered (boka/actions.ts). Scoped to the tenant
 * on every write; each staff_id is verified to belong to the tenant before insert.
 */
export async function setServiceStaff(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const serviceId = String(fd.get('serviceId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!serviceId) return { error: 'Saknar tjänst.' }

  // Service must belong to the tenant (never trust the client ids).
  const { data: svc } = await supabase
    .from('services')
    .select('id')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!svc) return { error: 'Tjänsten finns inte.' }

  const submitted = fd.getAll('staffId').map((v) => String(v)).filter(Boolean)
  // Keep only staff that actually belong to this tenant (fence against tampered ids).
  const { data: validStaff } = await supabase.from('staff').select('id').eq('tenant_id', tenantId)
  const allowed = new Set((validStaff ?? []).map((s) => s.id))
  const staffIds = [...new Set(submitted)].filter((id) => allowed.has(id))

  // Replace: clear this service's assignments, then insert the new set.
  const { error: delErr } = await supabase
    .from('staff_services')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('service_id', serviceId)
  if (delErr) {
    await reportActionError('setServiceStaff.delete', delErr, { tenantId })
    return { error: GENERIC }
  }
  if (staffIds.length > 0) {
    const rows = staffIds.map((staff_id) => ({ tenant_id: tenantId, service_id: serviceId, staff_id }))
    const { error: insErr } = await supabase.from('staff_services').insert(rows)
    if (insErr) {
      await reportActionError('setServiceStaff.insert', insErr, { tenantId })
      return { error: GENERIC }
    }
  }

  // goal-61 preview-parity: tjänsterna cachas under `tenant:<slug>` (getServices) —
  // utan tag-bust visade preview + publika sajten gamla tjänster i upp till 300 s.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.service_staff_set',
    tenantId,
    actorId: user.id,
    entityId: serviceId,
    meta: { count: staffIds.length },
  })
  return {
    success:
      staffIds.length > 0
        ? `${staffIds.length} i personalen kan utföra tjänsten.`
        : 'Ingen personal kopplad — alla kan utföra tjänsten (ingen begränsning).',
  }
}

/** Upload one service photo → set services.image_url (R2 public url), tenant-scoped. */
export async function uploadServiceImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const serviceId = String(fd.get('serviceId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!serviceId) return { error: 'Saknar tjänst.' }

  const image = fd.get('image')
  if (!(image instanceof File) || image.size === 0) return { error: 'Välj en bild att ladda upp.' }

  const { data: svc } = await supabase
    .from('services')
    .select('id')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!svc) return { error: 'Tjänsten finns inte.' }

  const res = await uploadImage(image, `tenants/${tenantId}/services`)
  if (!res.ok) {
    return {
      error:
        res.reason === 'too_large'
          ? 'Bilden är för stor (max 8 MB).'
          : res.reason === 'bad_type'
            ? 'Bilden måste vara PNG, JPG, WEBP eller GIF.'
            : res.reason === 'no_public_base' || res.reason === 'no_binding'
              ? 'Bilduppladdning är inte aktiverad i denna miljö (kräver R2).'
              : 'Uppladdningen misslyckades. Försök igen.',
    }
  }

  const { error } = await supabase
    .from('services')
    .update({ image_url: res.url } as never)
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('uploadServiceImage.update', error, { tenantId })
    return { error: GENERIC }
  }

  // goal-61 preview-parity: tjänsterna cachas under `tenant:<slug>` (getServices) —
  // utan tag-bust visade preview + publika sajten gamla tjänster i upp till 300 s.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.service_image_add',
    tenantId,
    actorId: user.id,
    entityId: serviceId,
  })
  return { success: 'Bild uppladdad. Syns på tjänsten.' }
}

/** Clear services.image_url + best-effort delete the R2 object (never blocks the save). */
export async function removeServiceImage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const serviceId = String(fd.get('serviceId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  if (!serviceId) return { error: 'Saknar tjänst.' }

  const { data: svc } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!svc) return { error: 'Tjänsten finns inte.' }
  const url = (svc as unknown as { image_url?: string | null }).image_url ?? null

  const { error } = await supabase
    .from('services')
    .update({ image_url: null } as never)
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
  if (error) {
    await reportActionError('removeServiceImage.update', error, { tenantId })
    return { error: GENERIC }
  }

  if (url) await deleteByPublicUrl(url)

  // goal-61 preview-parity: tjänsterna cachas under `tenant:<slug>` (getServices) —
  // utan tag-bust visade preview + publika sajten gamla tjänster i upp till 300 s.
  await revalidateTenantById(supabase, tenantId)
  revalidatePath(`/salonger/${tenantId}`)
  await logPlatformAction(supabase, {
    action: 'tenant.service_image_remove',
    tenantId,
    actorId: user.id,
    entityId: serviceId,
  })
  return { success: 'Bild borttagen.' }
}
