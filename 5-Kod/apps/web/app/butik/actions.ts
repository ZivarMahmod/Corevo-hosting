'use server'

import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'
import { parseShopConfig } from '@/lib/storefront/shop/types'

// Webshop köp-räls (goal-49). Runs as the anon role — the order INSERT goes
// through the SECURITY DEFINER RPC:er in migration 0042 (reserve_shop_order /
// confirm_shop_order), which compute totals server-side and hold stock atomically.
// Tenant identity is the middleware-resolved header — NEVER the client. The cart
// lives client-side (browse-fasen); the order is born at checkout-start as
// 'reserved', then confirmed. anon reaches its own order only via the opaque
// session_token (mirrors slot_holds). Betal-rails pausade → confirm utan betalning
// committar lagret direkt (requiresPayment=false tills Fas 3 + compliance-gate).

type TenantCtx = { tenantId: string; slug: string }

async function getTenantContext(): Promise<TenantCtx | null> {
  const h = await headers()
  const slug = h.get('x-corevo-tenant-slug')
  if (!slug) return null
  const supabase = createPublicClient()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()
  if (!tenant) return null
  return { tenantId: tenant.id, slug: tenant.slug }
}

export type ReserveInput = {
  items: { variantId: string; quantity: number }[]
  /** Opaque, client-generated session token (NOT auth) — gates this order for anon. */
  token: string
}
export type ReserveResult =
  | { ok: true; orderId: string }
  | { ok: false; reason: 'out_of_stock' | 'invalid' | 'error'; message: string }

/** Reserve a held order from the cart (köp-räls step 1). Holds stock via reserved_qty.
 *  The fulfilment snapshot is read SERVER-SIDE from the tenant's shop config (never
 *  trusted from the client), then the RPC snapshots it onto the order. */
export async function reserveOrder(input: ReserveInput): Promise<ReserveResult> {
  const ctx = await getTenantContext()
  if (!ctx) return { ok: false, reason: 'invalid', message: 'Okänd butik.' }

  const ip = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('shop_order', ctx.tenantId, ip), LIMITS.booking))) {
    return { ok: false, reason: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }

  const items = (input.items ?? []).filter((i) => i.variantId && i.quantity > 0)
  if (items.length === 0) return { ok: false, reason: 'invalid', message: 'Varukorgen är tom.' }
  if (!input.token) return { ok: false, reason: 'error', message: 'Sessionen saknas. Ladda om sidan.' }

  const supabase = createPublicClient()
  // Fulfilment-snapshot ur tenantens shop-config (server-side sanning, ej klient).
  const { data: moduleRow } = await supabase
    .from('tenant_modules')
    .select('config')
    .eq('tenant_id', ctx.tenantId)
    .eq('module_key', 'shop')
    .maybeSingle()
  const fulfilment = parseShopConfig(moduleRow?.config).fulfilment

  const { data: orderId, error } = await supabase.rpc('reserve_shop_order', {
    p_tenant_slug: ctx.slug,
    p_items: items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })),
    p_fulfilment: fulfilment,
    p_token: input.token,
    p_ttl_min: 30,
  })

  if (error) {
    if (error.code === '23P01') {
      return { ok: false, reason: 'out_of_stock', message: 'Tyvärr, en vara tog precis slut. Justera varukorgen.' }
    }
    if (error.code === 'P0002') {
      return { ok: false, reason: 'invalid', message: 'En vara finns inte längre. Uppdatera varukorgen.' }
    }
    return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  }
  if (!orderId) return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  return { ok: true, orderId: orderId as string }
}

export type ConfirmInput = {
  orderId: string
  token: string
  name: string
  email: string
  phone: string
  shipAddress?: string
  pickupLocationId?: string | null
  note?: string
}
export type ConfirmResult =
  | { ok: true; orderId: string; requiresPayment: boolean }
  | { ok: false; reason: 'expired' | 'invalid' | 'error'; message: string }

/** Confirm the held order with customer details (köp-räls step 2). No-payment →
 *  commits stock + status 'pending'. Payment required → 'awaiting_payment' (Fas 3). */
export async function confirmOrder(input: ConfirmInput): Promise<ConfirmResult> {
  const ctx = await getTenantContext()
  if (!ctx) return { ok: false, reason: 'invalid', message: 'Okänd butik.' }

  const name = input.name.trim()
  const email = input.email.trim()
  const phone = input.phone.trim()
  if (!name || !email || !phone) {
    return { ok: false, reason: 'invalid', message: 'Fyll i namn, e-post och telefon.' }
  }
  if (!input.orderId || !input.token) {
    return { ok: false, reason: 'error', message: 'Sessionen saknas. Börja om.' }
  }

  // Session-medveten: en INLOGGAD kund bekräftar via den authenticated-klienten med
  // p_customer = auth.uid() (RPC-fence kräver p_customer = auth.uid()), så ordern
  // länkas till deras auth-customer_id och dyker upp i /konto. Utloggad gäst →
  // anon-klient + gästfält (länkas via email-hash, resolve_customer_id).
  const authed = await createClient()
  const { data: auth } = await authed.auth.getUser()
  const user = auth?.user ?? null
  const client = user ? authed : createPublicClient()
  const { data, error } = await client.rpc('confirm_shop_order', {
    p_order_id: input.orderId,
    p_token: input.token,
    p_customer: user?.id ?? undefined,
    p_guest_name: name,
    p_guest_email: email,
    p_guest_phone: phone,
    p_ship_address: input.shipAddress?.trim() || undefined,
    p_pickup_location: input.pickupLocationId ?? undefined,
    p_note: input.note?.trim() || undefined,
  })

  if (error) {
    // P0001 = order_not_reservable / order_expired (stale page, TTL passed).
    if (error.code === 'P0001') {
      return { ok: false, reason: 'expired', message: 'Beställningen gick ut — lägg den igen.' }
    }
    if (error.code === '42501') {
      return { ok: false, reason: 'invalid', message: 'Beställningen kunde inte bekräftas.' }
    }
    return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  return { ok: true, orderId: row.order_id as string, requiresPayment: Boolean(row.requires_payment) }
}

/** Cancel a held order (release stock). Best-effort — abandoning the cart. */
export async function cancelOrder(orderId: string, token: string): Promise<{ ok: boolean }> {
  if (!orderId || !token) return { ok: false }
  const supabase = createPublicClient()
  const { error } = await supabase.rpc('release_shop_order', {
    p_order_id: orderId,
    p_token: token,
    p_status: 'cancelled',
  })
  return { ok: !error }
}

export type PublicShopOrder = {
  id: string
  status: string
  payment_status: string
  fulfilment: string
  total_cents: number
  subtotal_cents: number
  shipping_cents: number
  discount_cents: number
  tax_cents: number
  currency: string
  customer_name: string | null
  customer_email: string | null
  ship_address: string | null
  created_at: string
  items: { product_name: string; quantity: number; unit_price_cents: number }[]
  payments_enabled: boolean
  stripe_charges_enabled: boolean
  requires_payment: boolean
}

/** Token-gated order read for the confirmation page (PII boundary: null token rejected). */
export async function getShopOrder(orderId: string, token: string): Promise<PublicShopOrder | null> {
  if (!orderId || !token) return null
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_shop_order', { p_id: orderId, p_token: token })
  if (error || !data) return null
  return data as unknown as PublicShopOrder
}
