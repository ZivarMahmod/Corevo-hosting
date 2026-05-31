'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal, type CurrentUser } from '@/lib/auth/session'
import { getAdminTenant, revalidateTenant, type AdminTenant } from './tenant'
import { kronorToCents } from './format'

export type ActionState = { error?: string; success?: string }

const NO_TENANT = 'Ingen salong är kopplad till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

/**
 * Authorization fence for EVERY admin mutation. RLS only isolates tenants, it is
 * NOT role-aware (a level-2 kund shares the tenant claim), so the role gate lives
 * here in the server action. Also resolves the tenant (id + slug) needed to scope
 * writes and invalidate the public cache.
 */
async function adminCtx(): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return null
  return { user, tenant }
}

// ── Services ────────────────────────────────────────────────────────────────
export async function createService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const name = String(fd.get('name') ?? '').trim()
  const category = String(fd.get('category') ?? '').trim()
  const duration = Number(fd.get('duration_min'))
  const priceCents = kronorToCents(String(fd.get('price') ?? '')) ?? 0

  if (!name) return { error: 'Ange ett namn.' }
  if (!Number.isInteger(duration) || duration <= 0) return { error: 'Ange en giltig varaktighet (minuter).' }

  const supabase = await createClient()
  const { error } = await supabase.from('services').insert({
    tenant_id: ctx.tenant.id,
    location_id: ctx.tenant.locationId,
    name,
    category: category || null,
    duration_min: duration,
    price_cents: priceCents,
    active: true,
  })
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: 'Tjänst skapad.' }
}

export async function updateService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const name = String(fd.get('name') ?? '').trim()
  const category = String(fd.get('category') ?? '').trim()
  const duration = Number(fd.get('duration_min'))
  const priceCents = kronorToCents(String(fd.get('price') ?? '')) ?? 0

  if (!id) return { error: 'Saknar tjänst.' }
  if (!name) return { error: 'Ange ett namn.' }
  if (!Number.isInteger(duration) || duration <= 0) return { error: 'Ange en giltig varaktighet (minuter).' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('services')
    .update({ name, category: category || null, duration_min: duration, price_cents: priceCents })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: 'Tjänst uppdaterad.' }
}

export async function toggleServiceActive(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const active = String(fd.get('active') ?? '') === 'true'
  if (!id) return { error: 'Saknar tjänst.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('services')
    .update({ active })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: active ? 'Tjänst aktiverad.' : 'Tjänst inaktiverad.' }
}

export async function deleteService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar tjänst.' }

  const supabase = await createClient()
  const { error } = await supabase.from('services').delete().eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) {
    // FK from bookings(service_id) → can't delete a service with history.
    if (error.code === '23503')
      return { error: 'Tjänsten har bokningar och kan inte tas bort. Inaktivera den i stället.' }
    return { error: GENERIC }
  }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/tjanster')
  return { success: 'Tjänst borttagen.' }
}
