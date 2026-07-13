'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { moduleCtx } from '@/lib/admin/module-ctx'
import { revalidateTenant } from '@/lib/admin/tenant'
import { kronorToCents } from '@/lib/admin/format'
import type { ActionState } from '@/lib/admin/actions'
import { refundShopOrder } from '@/lib/stripe/refund'
import { SHOP_ORDER_STATUSES, isShopOrderTransitionAllowed, type ShopOrderStatus } from './types'
import { parsePaymentMethods } from '@/lib/storefront/shop/types'
import { sendOrderStatusEmail } from '@/lib/notifications/shop'

const NO_TENANT = 'Inget företag är kopplat till ditt konto.'
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

/**
 * goal-64 (migration 0057) — MALL-FÄLTEN ur formuläret.
 *
 * Kategori/badge/jämförelsepris/"från"-pris är det mallarna renderar (filterchips, märket över
 * bilden, kurstavlans ▲▼, "fr. 950 kr"). Utan formulärfält vore kolumnerna döda, och utan
 * kolumnerna kunde mallen bara ljuga eller amputeras — båda är förbjudna.
 *
 * TOM STRÄNG → null (render-on-present hela vägen ner i DB:n): kunden ska kunna TA BORT en
 * kategori/badge igen, och ett tomt fält får aldrig bli en tom chip eller ett tomt märke.
 */
function productDesignFields(fd: FormData): {
  category: string | null
  badge: string | null
  compare_at_price_cents: number | null
  price_from: boolean
} {
  const compareRaw = String(fd.get('compare_at_price') ?? '').trim()
  return {
    category: String(fd.get('category') ?? '').trim() || null,
    badge: String(fd.get('badge') ?? '').trim() || null,
    // Tomt jämförelsepris = ingen prisrörelse → priceMovement() ger '—'. Aldrig 0 (0 vore "priset
    // har stigit från gratis", vilket kurstavlan skulle rita som ▲).
    compare_at_price_cents: compareRaw === '' ? null : (kronorToCents(compareRaw) ?? null),
    price_from: String(fd.get('price_from') ?? '') === 'on',
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
      ...productDesignFields(fd),
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
    .update({
      name,
      description,
      price_cents: priceCents,
      stock,
      sort_order,
      image_asset_id,
      ...productDesignFields(fd),
    })
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

// ── Leveransval (goal-64) ─────────────────────────────────────────────────────
// KUNDEN äger sina leveranssätt: namn, beskrivning, pris, ordning, av/på. Kassan visar
// exakt dem — motorn hittar aldrig på ett alternativ. Priset som kunden skriver här är
// det ENDA priset som finns: confirm_shop_order (0058) slår upp det ur den här tabellen
// när ordern läggs, så en manipulerad klient kan aldrig ändra frakten.
//
// Samma dual-guard (moduleCtx) som resten: super-admin i kundkortet → tenantId ur
// formuläret; kundens egen admin → tenantId FORCERAT ur JWT:n.

/** "79" (kr) → 7900 (öre). Tomt → 0 ("Fritt"). Negativt/skräp → null (anropare avvisar). */
function costCentsFrom(fd: FormData): number | null {
  const raw = String(fd.get('cost') ?? '').trim()
  if (!raw) return 0 // ett tomt fraktpris = gratis frakt, ett giltigt och vanligt val
  const cents = kronorToCents(raw)
  return cents === null || cents < 0 ? null : cents
}

/** Nyckeln är stabil och maskinläsbar ('bud', 'hamta') — härledd ur namnet när den
 *  inte anges. Den behövs för unique(tenant_id, key) och för att en mall ska kunna
 *  känna igen ett val utan att jämföra fritext. */
function slugKey(raw: string): string {
  return (
    raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // å/ä/ö → a/a/o
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'leverans'
  )
}

export async function createShippingOption(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const name = String(fd.get('name') ?? '').trim().slice(0, 120)
  const description = String(fd.get('description') ?? '').trim().slice(0, 240) || null
  const costCents = costCentsFrom(fd)
  const sortOrder = parseInt(String(fd.get('sort_order') ?? '0'), 10) || 0

  if (!name) return { error: 'Ange ett namn på leveranssättet.' }
  if (costCents === null) return { error: 'Ange ett giltigt pris (kr). 0 = Fritt.' }

  const key = slugKey(String(fd.get('key') ?? '') || name)

  const supabase = await createClient()
  const { error } = await supabase.from('shop_shipping_options').insert({
    tenant_id: ctx.tenant.id,
    key,
    name,
    description,
    cost_cents: costCents,
    sort_order: sortOrder,
    active: true,
  })
  // 23505 = unique(tenant_id, key): två val med samma namn. Säg det rakt ut.
  if (error) return { error: error.code === '23505' ? 'Det finns redan ett leveranssätt med det namnet.' : GENERIC }

  revalidateTenant(ctx.tenant.slug) // kassan cachar valen under tenant:<slug>
  revalidatePath('/admin/webshop')
  return { success: `Leveranssättet "${name}" tillagt.` }
}

export async function updateShippingOption(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  const name = String(fd.get('name') ?? '').trim().slice(0, 120)
  const description = String(fd.get('description') ?? '').trim().slice(0, 240) || null
  const costCents = costCentsFrom(fd)
  const sortOrder = parseInt(String(fd.get('sort_order') ?? '0'), 10) || 0
  const active = fd.get('active') === 'on'

  if (!id) return { error: 'Saknar leveranssätt.' }
  if (!name) return { error: 'Ange ett namn på leveranssättet.' }
  if (costCents === null) return { error: 'Ange ett giltigt pris (kr). 0 = Fritt.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('shop_shipping_options')
    .update({
      name,
      description,
      cost_cents: costCents,
      sort_order: sortOrder,
      active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id) // tenant-fence: en tampererad id kan inte nå en annan butik
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/webshop')
  return { success: 'Leveranssättet uppdaterat.' }
}

export async function deleteShippingOption(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  const id = String(fd.get('id') ?? '')
  if (!id) return { error: 'Saknar leveranssätt.' }

  const supabase = await createClient()
  // shop_orders.shipping_option_id är ON DELETE SET NULL (0057) → lagda ordrar överlever
  // en radering; de tappar bara kopplingen till valet. Beloppet (shipping_cents) står
  // kvar på ordern — ett kvitto får aldrig ändra sig i efterhand.
  const { error } = await supabase
    .from('shop_shipping_options')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenant.id)
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/webshop')
  return { success: 'Leveranssättet borttaget.' }
}

// ── Betalsätt (goal-64) ───────────────────────────────────────────────────────
/**
 * Vilka betalsätt butiken tar emot → tenant_modules.config.payment_methods.
 *
 * Att slå PÅ ett betalsätt här är ett ÖNSKEMÅL, inte ett löfte: kassan visar det bara
 * om rälsen också är kopplad (Stripe godkänd / PayPal-nycklar satta). Så kan kunden
 * förbereda sin butik utan att någonsin råka visa en knapp som inte fungerar.
 */
export async function setShopPaymentMethods(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await moduleCtx(fd)
  if (!ctx) return { error: NO_TENANT }

  // Checkbox-fälten heter 'method' (flera med samma namn) → getAll. Okända värden
  // filtreras bort av parsePaymentMethods: configen kan aldrig bära ett betalsätt
  // motorn saknar räls för.
  const methods = parsePaymentMethods(fd.getAll('method').map(String))

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('tenant_modules')
    .select('config')
    .eq('tenant_id', ctx.tenant.id)
    .eq('module_key', 'shop')
    .maybeSingle()
  if (!row) return { error: 'Webshop-modulen är inte aktiverad för den här kunden.' }

  // MERGE, aldrig ersätt: configen bär även fulfilment/pickup_days/lead_days. Ett blint
  // överskrivande hade tyst nollat butikens leveranslöfte.
  const config = (row.config && typeof row.config === 'object' ? row.config : {}) as Record<string, unknown>
  const { error } = await supabase
    .from('tenant_modules')
    .update({ config: { ...config, payment_methods: methods } })
    .eq('tenant_id', ctx.tenant.id)
    .eq('module_key', 'shop')
  if (error) return { error: GENERIC }

  revalidateTenant(ctx.tenant.slug)
  revalidatePath('/admin/webshop')
  return {
    success: methods.length
      ? `Betalsätt sparade: ${methods.length} st.`
      : 'Inga betalsätt på — kunden betalar vid leverans/upphämtning.',
  }
}
