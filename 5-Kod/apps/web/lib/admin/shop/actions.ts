'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePortal, type CurrentUser } from '@/lib/auth/session'
import { getAdminTenant, revalidateTenant, type AdminTenant } from '@/lib/admin/tenant'
import { kronorToCents } from '@/lib/admin/format'
import type { ActionState } from '@/lib/admin/actions'
import { SHOP_ORDER_STATUSES } from './types'

const NO_TENANT = 'Ingen salong är kopplad till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

/**
 * Authorization fence for every shop mutation. Mirrors the pattern in
 * lib/admin/actions.ts: requirePortal('admin') + getAdminTenant, which together
 * verify the caller's role AND resolve the tenant (id + slug) for scoped writes
 * and cache invalidation. RLS is defence-in-depth, not a substitute.
 */
async function adminCtx(): Promise<{ user: CurrentUser; tenant: AdminTenant } | null> {
  const user = await requirePortal('admin')
  const tenant = await getAdminTenant(user)
  if (!tenant) return null
  return { user, tenant }
}

/**
 * Resolve a submitted media asset id to a value safe to persist.
 * '' / missing → null. A non-empty id is verified to belong to THIS tenant
 * (defence-in-depth: a tampered cross-tenant id resolves to null, never persists).
 */
async function resolveTenantAssetId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  raw: string,
): Promise<string | null> {
  const id = raw.trim()
  if (!id) return null
  const { data } = await supabase
    .from('media_assets')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data ? id : null
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function createShopProduct(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const name = String(fd.get('name') ?? '').trim()
  if (!name) return { error: 'Ange ett namn.' }

  const priceCents = kronorToCents(String(fd.get('price') ?? '')) ?? 0
  const descRaw = String(fd.get('description') ?? '').trim()
  const description = descRaw || null

  const stockRaw = String(fd.get('stock') ?? '').trim()
  let stock: number | null = null
  if (stockRaw !== '') {
    const n = parseInt(stockRaw, 10)
    if (!Number.isInteger(n) || n < 0) return { error: 'Lager måste vara 0 eller ett positivt heltal.' }
    stock = n
  }

  const sortOrderRaw = String(fd.get('sort_order') ?? '0').trim()
  const sort_order = parseInt(sortOrderRaw, 10) || 0

  const supabase = await createClient()
  const image_asset_id = await resolveTenantAssetId(
    supabase,
    ctx.tenant.id,
    String(fd.get('image_asset_id') ?? ''),
  )
  const { error } = await supabase.from('shop_products').insert({
    tenant_id: ctx.tenant.id,
    name,
    description,
    price_cents: priceCents,
    stock,
    active: true,
    sort_order,
    image_asset_id,
  })
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/webshop')
  return { success: 'Produkt skapad.' }
}

export async function updateShopProduct(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar produkt.' }

  const name = String(fd.get('name') ?? '').trim()
  if (!name) return { error: 'Ange ett namn.' }

  const priceCents = kronorToCents(String(fd.get('price') ?? '')) ?? 0
  const descRaw = String(fd.get('description') ?? '').trim()
  const description = descRaw || null

  const stockRaw = String(fd.get('stock') ?? '').trim()
  let stock: number | null = null
  if (stockRaw !== '') {
    const n = parseInt(stockRaw, 10)
    if (!Number.isInteger(n) || n < 0) return { error: 'Lager måste vara 0 eller ett positivt heltal.' }
    stock = n
  }

  const sortOrderRaw = String(fd.get('sort_order') ?? '0').trim()
  const sort_order = parseInt(sortOrderRaw, 10) || 0

  const supabase = await createClient()
  const image_asset_id = await resolveTenantAssetId(
    supabase,
    ctx.tenant.id,
    String(fd.get('image_asset_id') ?? ''),
  )
  const { error } = await supabase
    .from('shop_products')
    .update({ name, description, price_cents: priceCents, stock, sort_order, image_asset_id })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/webshop')
  return { success: 'Produkt uppdaterad.' }
}

export async function toggleShopProductActive(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar produkt.' }

  const active = String(fd.get('active') ?? '') === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('shop_products')
    .update({ active })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/webshop')
  return { success: active ? 'Produkt aktiverad.' : 'Produkt inaktiverad.' }
}

export async function deleteShopProduct(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar produkt.' }

  const supabase = await createClient()
  // FK from order_items(product_id) is ON DELETE SET NULL — no 23503 to handle.
  const { error } = await supabase
    .from('shop_products')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/webshop')
  return { success: 'Produkt borttagen.' }
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function setShopOrderStatus(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await adminCtx()
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar order.' }

  const status = String(fd.get('status') ?? '')
  if (!(SHOP_ORDER_STATUSES as readonly string[]).includes(status)) {
    return { error: 'Ogiltig status.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('shop_orders')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  // NOTE: payment_status is intentionally NOT touched here (checkout rails paused).
  revalidatePath('/admin/webshop')
  return { success: 'Status uppdaterad.' }
}
