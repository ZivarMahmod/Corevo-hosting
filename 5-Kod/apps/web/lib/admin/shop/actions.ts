'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { revalidateTenant } from '@/lib/admin/tenant'
import { kronorToCents } from '@/lib/admin/format'
import type { ActionState } from '@/lib/admin/actions'
import { refundShopOrder } from '@/lib/stripe/refund'
import { SHOP_ORDER_STATUSES, isShopOrderTransitionAllowed, type ShopOrderStatus } from './types'
import { sendOrderStatusEmail } from '@/lib/notifications/shop'

const NO_TENANT = 'Ingen salong är kopplad till ditt konto.'
const GENERIC = 'Något gick fel. Försök igen.'

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

/**
 * Synka produktens default-VARIANT (köp-rälsens köpbara enhet, 0042). Den enkla
 * produkt-CRUD:en redigerar pris/lager på shop_products, men kunden köper en
 * shop_product_variants-rad → utan denna sync skulle priset aldrig nå kassan.
 * v1: en 'Standard'-variant per produkt; finns redan → uppdatera, annars (och bara
 * om produkten saknar ALLA varianter) → skapa. Multi-variant-produkter (egna
 * variantnamn) lämnas orörda (full variant-UI = v1.1).
 */
async function syncDefaultVariant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  productId: string,
  fields: { price_cents: number; stock: number | null; image_asset_id: string | null },
): Promise<void> {
  const { data: std } = await supabase
    .from('shop_product_variants')
    .select('id')
    .eq('product_id', productId)
    .eq('name', 'Standard')
    .maybeSingle()
  if (std) {
    await supabase
      .from('shop_product_variants')
      .update({ price_cents: fields.price_cents, stock: fields.stock, image_asset_id: fields.image_asset_id })
      .eq('id', std.id)
      .eq('tenant_id', tenantId)
    return
  }
  const { count } = await supabase
    .from('shop_product_variants')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId)
  if ((count ?? 0) === 0) {
    await supabase.from('shop_product_variants').insert({
      tenant_id: tenantId,
      product_id: productId,
      name: 'Standard',
      price_cents: fields.price_cents,
      stock: fields.stock,
      image_asset_id: fields.image_asset_id,
    })
  }
}

// ── Products ──────────────────────────────────────────────────────────────────

export async function createShopProduct(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
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
  const { data: created, error } = await supabase
    .from('shop_products')
    .insert({
      tenant_id: ctx.tenant.id,
      name,
      description,
      price_cents: priceCents,
      stock,
      active: true,
      sort_order,
      image_asset_id,
    })
    .select('id')
    .single()
  if (error || !created) return { error: GENERIC }

  // Köp-rälsen köper en variant → skapa produktens Standard-variant (0042-modellen).
  await syncDefaultVariant(supabase, ctx.tenant.id, created.id, { price_cents: priceCents, stock, image_asset_id })

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/webshop')
  return { success: 'Produkt skapad.' }
}

export async function updateShopProduct(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
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

  // Synka Standard-varianten (köpbar enhet) med produktens nya pris/lager/bild.
  await syncDefaultVariant(supabase, ctx.tenant.id, id, { price_cents: priceCents, stock, image_asset_id })

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/webshop')
  return { success: 'Produkt uppdaterad.' }
}

export async function toggleShopProductActive(
  _p: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
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
  const ctx = await moduleCtx(fd)
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
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar order.' }

  const status = String(fd.get('status') ?? '')
  if (!(SHOP_ORDER_STATUSES as readonly string[]).includes(status)) {
    return { error: 'Ogiltig status.' }
  }

  const supabase = await createClient()

  // FSM-gate (goal-54): läs nuvarande status tenant-scopat. Samma status = no-op-
  // success (admin-selecten defaultar till nuvarande — spegel av bokningsmönstret).
  // Okänd/legacy nuvarande status → endast →cancelled; annars matrisen.
  const { data: current } = await supabase
    .from('shop_orders')
    .select('status')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!current) return { error: 'Saknar order.' }
  if (current.status === status) return { success: 'Status uppdaterad.' }
  if (!isShopOrderTransitionAllowed(current.status, status as ShopOrderStatus)) {
    return { error: 'Ogiltig statusövergång.' }
  }

  // Gate the write on the status we validated against (zero rows ⇒ concurrent change).
  const { data: updated, error } = await supabase
    .from('shop_orders')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .eq('status', current.status)
    .select('id')
    .maybeSingle()
  if (error) return { error: GENERIC }
  if (!updated) return { error: 'Ogiltig statusövergång.' }

  // Kundmejl EFTER lyckad write. Best-effort — sendOrderStatusEmail kastar aldrig
  // och får aldrig blockera statusändringen.
  await sendOrderStatusEmail(supabase, ctx.tenant.id, id, status)

  // NOTE: payment_status is intentionally NOT touched here (checkout rails paused).
  revalidatePath('/admin/webshop')
  return { success: 'Status uppdaterad.' }
}

/** Registrera spårningsnummer + transportör på en order (logistik-metadata, 0044).
 *  Sätter shipped_at första gången ett spårningsnummer anges. */
export async function setShopOrderTracking(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar order.' }
  const tracking = String(fd.get('tracking_number') ?? '').trim() || null
  const carrier = String(fd.get('carrier') ?? '').trim() || null

  const supabase = await createClient()
  const patch: { tracking_number: string | null; carrier: string | null; shipped_at?: string } = {
    tracking_number: tracking,
    carrier,
  }
  if (tracking) {
    // sätt shipped_at om ej redan satt (första spårningsregistreringen).
    const { data: existing } = await supabase
      .from('shop_orders')
      .select('shipped_at')
      .eq('id', id)
      .eq('tenant_id', ctx.tenant.id)
      .maybeSingle()
    if (existing && !existing.shipped_at) patch.shipped_at = new Date().toISOString()
  }

  const { error } = await supabase.from('shop_orders').update(patch).eq('id', id).eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidatePath('/admin/webshop')
  return { success: 'Spårning uppdaterad.' }
}

/** Återbetala en betald order (Fas 3). refundShopOrder är idempotent + no-op om ingen
 *  lyckad betalning finns (betal-rälsen pausad → tyst no-op tills den tänds). */
export async function refundShopOrderAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar order.' }

  // Verifiera att ordern tillhör tenanten (refundShopOrder är tenant-scopad internt).
  const supabase = await createClient()
  const { data: order } = await supabase
    .from('shop_orders')
    .select('id, payment_status')
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
    .maybeSingle()
  if (!order) return { error: 'Ordern hittades inte.' }
  if (order.payment_status !== 'paid') return { error: 'Ordern är inte betald.' }

  await refundShopOrder(id, ctx.tenant.id)
  revalidatePath('/admin/webshop')
  return { success: 'Återbetalning genomförd.' }
}
