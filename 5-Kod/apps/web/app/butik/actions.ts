'use server'

import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/platform/service'
import { getStripe } from '@/lib/stripe/client'
import { requestOrigin } from '@/lib/url'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'
import { parseShopConfig } from '@/lib/storefront/shop/types'
import { sendOrderPlacedEmail } from '@/lib/notifications/shop'
import { logger } from '@/lib/observability'

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

  // Orderbekräftelse-mejl direkt vid lagd order (goal-55 W5). BEST-EFFORT — får
  // ALDRIG blockera confirm-svaret. Service-klient krävs: vi kör som anon här och
  // RLS släpper inte in anon i shop_orders; mejlaren läser ordern tenant-scopat.
  try {
    const service = createServiceClient()
    if (service) await sendOrderPlacedEmail(service, ctx.tenantId, row.order_id as string)
    else logger.warn('shop.notify.no_service_client', { orderId: row.order_id })
  } catch (err) {
    logger.warn('shop.notify.placed_failed', {
      orderId: row.order_id,
      error: err instanceof Error ? err.message : String(err),
    })
  }

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

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'unavailable' | 'error'; message: string }

/**
 * Start a Stripe Checkout Session for an awaiting_payment order (Fas 3). DIRECT
 * charge on the salong's connected account, application_fee OMITTED ⇒ fee = 0
 * (samma modell som booking, 0007). Service-role (RLS-bypass; connected account-id
 * stannar server-side). Gatad av payments_enabled AND stripe_charges_enabled →
 * degraderar till { unavailable } när rälsen är av (= dagens default, dormant).
 */
export async function startShopCheckout(orderId: string): Promise<CheckoutResult> {
  const ctx = await getTenantContext()
  if (!ctx) return { ok: false, reason: 'error', message: 'Okänd butik.' }
  if (!orderId) return { ok: false, reason: 'error', message: 'Saknar beställning.' }

  const stripe = getStripe()
  const admin = createServiceClient()
  if (!stripe || !admin) return { ok: false, reason: 'unavailable', message: 'Onlinebetalning är inte tillgänglig.' }

  const [{ data: tenant }, { data: settings }] = await Promise.all([
    admin.from('tenants').select('stripe_account_id, stripe_charges_enabled').eq('id', ctx.tenantId).maybeSingle(),
    admin.from('tenant_settings').select('payments_enabled').eq('tenant_id', ctx.tenantId).maybeSingle(),
  ])
  const canTakeOnline = (settings?.payments_enabled ?? false) && (tenant?.stripe_charges_enabled ?? false)
  if (!canTakeOnline || !tenant?.stripe_account_id) {
    return { ok: false, reason: 'unavailable', message: 'Onlinebetalning är inte tillgänglig.' }
  }

  // Ordern MÅSTE tillhöra denna tenant + vänta på betalning (orderId från klienten).
  const { data: order } = await admin
    .from('shop_orders')
    .select('id, total_cents, currency, status, shop_order_items(product_name, unit_price_cents, quantity)')
    .eq('id', orderId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (!order) return { ok: false, reason: 'error', message: 'Beställningen hittades inte.' }
  if (order.status !== 'awaiting_payment') {
    return { ok: false, reason: 'error', message: 'Beställningen kan inte betalas nu.' }
  }
  const amount = order.total_cents ?? 0
  if (amount <= 0) return { ok: false, reason: 'unavailable', message: 'Inget belopp att betala.' }

  // En payment-rad per order (UNIQUE(order_id) → idempotensgrund för webhooken).
  await admin.from('payments').upsert(
    { tenant_id: ctx.tenantId, order_id: orderId, amount_cents: amount, currency: 'sek', status: 'pending' },
    { onConflict: 'order_id' },
  )

  const items = (order.shop_order_items ?? []) as { product_name: string; unit_price_cents: number; quantity: number }[]
  const lineItems = items.length
    ? items.map((it) => ({
        quantity: it.quantity,
        price_data: { currency: 'sek', unit_amount: it.unit_price_cents, product_data: { name: it.product_name } },
      }))
    : [{ quantity: 1, price_data: { currency: 'sek', unit_amount: amount, product_data: { name: 'Beställning' } } }]

  const origin = await requestOrigin()
  let session
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: lineItems,
        // application_fee_amount UTELÄMNAS medvetet ⇒ fee = 0 (DIRECT charge).
        payment_intent_data: { metadata: { order_id: orderId, tenant_id: ctx.tenantId } },
        metadata: { order_id: orderId, tenant_id: ctx.tenantId },
        // goal-55 körning 7A: bekräftelsen bor i (public)/bekraftelse — köparen
        // stannar i det temade skalet efter Stripe-returen.
        success_url: `${origin}/bekraftelse/${orderId}?betald=1`,
        cancel_url: `${origin}/bekraftelse/${orderId}?avbruten=1`,
      },
      { stripeAccount: tenant.stripe_account_id }, // DIRECT charge på salongens konto
    )
  } catch {
    return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }
  }
  if (!session.url) return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }
  await admin.from('payments').update({ stripe_checkout_session_id: session.id }).eq('order_id', orderId)
  return { ok: true, url: session.url }
}
