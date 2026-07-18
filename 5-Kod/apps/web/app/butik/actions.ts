'use server'

import { headers } from 'next/headers'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/platform/service'
import { getStripe } from '@/lib/stripe/client'
import { requestOrigin } from '@/lib/url'
import { checkRateLimit, getClientIp, rateLimitKey, LIMITS } from '@/lib/security/rate-limit'
import {
  parseShopConfig,
  availablePaymentMethods,
  STRIPE_PAYMENT_METHODS,
  type ShopPaymentMethod,
  type ReserveItem,
} from '@/lib/storefront/shop/types'
import { paypalReady, createPaypalOrder } from '@/lib/payments/paypal'
import { sendOrderPlacedEmail } from '@/lib/notifications/shop'
import { deliverIssuedGiftCards } from '@/lib/notifications/gift'
import { logger } from '@/lib/observability'
import { commerceReleaseGate } from '@/lib/release/commerce'

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

async function requireReleasedShopContext(): Promise<TenantCtx | null> {
  const ctx = await getTenantContext()
  return ctx && commerceReleaseGate(ctx.tenantId).shop ? ctx : null
}

export type ReserveInput = {
  /** goal-64: raden kan vara en produkt, ett presentkort ELLER en kursplats.
   *  `kind` utelämnad ⇒ 'product' ⇒ oförändrat beteende (gammal kassa, sparad korg). */
  items: ReserveItem[]
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
  const ctx = await requireReleasedShopContext()
  if (!ctx) return { ok: false, reason: 'invalid', message: 'Webshop är inte aktiverad ännu.' }

  const ip = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('shop_order', ctx.tenantId, ip), LIMITS.booking))) {
    return { ok: false, reason: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }

  // Släpp bara igenom rader som ÄR något: en produkt behöver sin variant, ett
  // presentkort sitt belopps-VAL, en kursplats sitt tillfälle. Priset kommer aldrig
  // härifrån — servern (0059) slår upp det. En manipulerad korg vinner ingenting.
  const items = (input.items ?? []).filter((i) => {
    if (i.quantity <= 0) return false
    const kind = i.kind ?? 'product'
    if (kind === 'giftcard') return typeof i.giftAmount === 'number' && i.giftAmount > 0
    if (kind === 'event') return Boolean(i.eventId)
    return Boolean(i.variantId)
  })
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

  const writer = createServiceClient()
  if (!writer) return { ok: false, reason: 'error', message: 'Något gick fel. Försök igen.' }
  const { data: orderId, error } = await writer.rpc('reserve_shop_order', {
    p_tenant_slug: ctx.slug,
    // Radens form per typ (0059). En produktrad ser EXAKT ut som förut — `kind`
    // defaultar till 'product' i RPC:n, så gamla klienter/korgar är oförändrade.
    p_items: items.map((i) => {
      const kind = i.kind ?? 'product'
      if (kind === 'giftcard') {
        return {
          kind,
          amount: i.giftAmount, // VAL i hela kronor — valideras mot kundens lista server-side
          delivery_mode: i.giftDeliveryMode ?? null,
          recipient_name: i.giftRecipientName ?? null,
          recipient_email: i.giftRecipientEmail ?? null,
          message: i.giftMessage ?? null,
        }
      }
      if (kind === 'event') {
        return { kind, event_id: i.eventId, quantity: i.quantity }
      }
      return { kind: 'product', variant_id: i.variantId, quantity: i.quantity }
    }),
    p_fulfilment: fulfilment,
    p_token: input.token,
    p_ttl_min: 30,
  })

  if (error) {
    // 23P01 = slutsålt. Gäller BÅDE produktlager och kursplatser (0059 kastar samma
    // kod när sista platsen tog slut) → köparen får rätt besked utan en ny gren.
    if (error.code === '23P01') {
      return { ok: false, reason: 'out_of_stock', message: 'Tyvärr, en vara tog precis slut. Justera varukorgen.' }
    }
    if (error.code === 'P0002') {
      return { ok: false, reason: 'invalid', message: 'En vara finns inte längre. Uppdatera varukorgen.' }
    }
    // P0001 = modulen är inte live / kursen betalas på plats / inga belopp konfigurerade.
    // 22023 = ogiltigt val (t.ex. ett presentkortsbelopp som inte finns i kundens lista).
    // Båda betyder: korgen bär något som inte får köpas här. Töm och börja om.
    if (error.code === 'P0001' || error.code === '22023') {
      logger.warn('shop.reserve.rejected_line', { tenantId: ctx.tenantId, code: error.code })
      return {
        ok: false,
        reason: 'invalid',
        message: 'Något i varukorgen går inte att köpa längre. Uppdatera varukorgen.',
      }
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
  /** goal-64: ID:t på det VALDA leveranssättet. Bara id:t — priset slår servern upp
   *  ur shop_shipping_options (confirm_shop_order). Klienten kan inte sätta ett belopp. */
  shippingOptionId?: string | null
  /** Plan 003: aktivt godkännande av köpvillkor + ångerrätt (distansavtalslagen).
   *  Valideras SERVER-SIDE — en order utan godkännande skapas aldrig. */
  acceptTerms?: boolean
  /** goal-64: valt betalsätt ('card'|'swish'|'klarna'|'paypal'|'applepay'). */
  paymentMethod?: ShopPaymentMethod | null
}
export type ConfirmResult =
  | { ok: true; orderId: string; requiresPayment: boolean }
  | { ok: false; reason: 'expired' | 'invalid' | 'error'; message: string }

/** Confirm the held order with customer details (köp-räls step 2). No-payment →
 *  commits stock + status 'pending'. Payment required → 'awaiting_payment' (Fas 3). */
export async function confirmOrder(input: ConfirmInput): Promise<ConfirmResult> {
  const ctx = await requireReleasedShopContext()
  if (!ctx) return { ok: false, reason: 'invalid', message: 'Webshop är inte aktiverad ännu.' }
  // Plan 009 SÄK-06: nedströms-actionen skickar orderbekräftelse-mejl per anrop —
  // samma hink som reserveOrder så hela köpkedjan delar budget per IP+tenant.
  const confirmIp = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('shop_order', ctx.tenantId, confirmIp), LIMITS.booking))) {
    return { ok: false, reason: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }

  const name = input.name.trim()
  const email = input.email.trim()
  const phone = input.phone.trim()
  if (!name || !email || !phone) {
    return { ok: false, reason: 'invalid', message: 'Fyll i namn, e-post och telefon.' }
  }
  // Plan 003: distansköp av varor kräver AKTIVT godkännande av köpvillkor +
  // ångerrättsinfo. Servervalidering — ordern skapas inte utan flaggan.
  if (input.acceptTerms !== true) {
    return { ok: false, reason: 'invalid', message: 'Godkänn köpvillkoren för att slutföra köpet.' }
  }
  if (!input.orderId || !input.token) {
    return { ok: false, reason: 'error', message: 'Sessionen saknas. Börja om.' }
  }

  // BETALSÄTTET VALIDERAS SERVER-SIDE (goal-64). Klienten skickar en sträng; vi
  // godtar den BARA om butiken faktiskt har det betalsättet påslaget OCH rälsen är
  // kopplad (Stripe godkänt / PayPal-nycklar satta). Ett manipulerat 'klarna' i en
  // butik utan Stripe blir alltså null (= betala på plats), aldrig en falsk betalning.
  let paymentMethod: ShopPaymentMethod | null = null
  if (input.paymentMethod) {
    const allowed = await allowedPaymentMethods(ctx.tenantId)
    paymentMethod = allowed.includes(input.paymentMethod) ? input.paymentMethod : null
    if (!paymentMethod) {
      return { ok: false, reason: 'invalid', message: 'Det betalsättet är inte tillgängligt.' }
    }
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
    // goal-64: bara ID:t på leveransvalet — RPC:n slår upp priset ur DB och räknar om
    // totalen (subtotal + frakt − rabatt + moms). Klienten får aldrig sätta ett belopp.
    p_shipping_option: input.shippingOptionId ?? undefined,
    p_payment_method: paymentMethod ?? undefined,
  })

  if (error) {
    // P0001 = order_not_reservable / order_expired (stale page, TTL passed).
    if (error.code === 'P0001') {
      return { ok: false, reason: 'expired', message: 'Beställningen gick ut — lägg den igen.' }
    }
    // P0002 = invalid_shipping_option / shipping_option_required (0058): kunden valde
    // ett leveranssätt som inte finns/är avstängt, eller hoppade över steget.
    if (error.code === 'P0002') {
      return { ok: false, reason: 'invalid', message: 'Välj ett giltigt leveranssätt.' }
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

  // goal-64: tar kunden INTE betalt online committade confirm_shop_order just nu — och
  // då utfärdades presentkorten (gift_cards med kod + saldo) i samma andetag. Koden ska
  // fram till mottagaren. Kräver betalning → korten föds först i webhooken, och mejlet
  // skickas därifrån i stället. Best-effort, exakt som orderbekräftelsen: ett mejlfel
  // får aldrig sänka ett genomfört köp.
  if (!row.requires_payment) {
    const service = createServiceClient()
    if (service) await deliverIssuedGiftCards(service, ctx.tenantId, row.order_id as string)
  }

  return { ok: true, orderId: row.order_id as string, requiresPayment: Boolean(row.requires_payment) }
}

/** Cancel a held order (release stock). Best-effort — abandoning the cart. */
export async function cancelOrder(orderId: string, token: string): Promise<{ ok: boolean }> {
  if (!orderId || !token) return { ok: false }
  const ctx = await requireReleasedShopContext()
  if (!ctx) return { ok: false }
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
  /** goal-64: läsbart, per-tenant-unikt ordernummer ("4821"). Mallen sätter PREFIXET
   *  (FloristTheme.orderPrefix → "#OX-"). null på ordrar lagda före 0058. */
  order_no: string | null
  /** goal-64: vad kunden valde att betala med. */
  payment_method: string | null
  /** goal-64: fraktens namn ("Bud samma dag") — så kvittoraden kan skriva ut den. */
  shipping_name: string | null
}

/** Token-gated order read for the confirmation page (PII boundary: null token rejected). */
export async function getShopOrder(orderId: string, token: string): Promise<PublicShopOrder | null> {
  if (!orderId || !token) return null
  const ctx = await requireReleasedShopContext()
  if (!ctx) return null
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc('get_public_shop_order', { p_id: orderId, p_token: token })
  if (error || !data) return null
  return data as unknown as PublicShopOrder
}

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'unavailable' | 'error'; message: string }

/**
 * Butikens FAKTISKT erbjudbara betalsätt (goal-64) — server-side sanning, samma
 * korsning som lib/storefront/shop/checkout-options.ts men läst med service-klienten
 * här inne i actionen (vi kör som anon och kommer inte åt tenant_settings annars).
 *
 * Används för att VALIDERA klientens val i confirmOrder. Sanningen får aldrig bo i
 * klienten: en manipulerad POST kan annars sätta payment_method='klarna' på en order
 * i en butik som inte har Klarna, och ordern skulle se betald ut utan att vara det.
 */
async function allowedPaymentMethods(tenantId: string): Promise<ShopPaymentMethod[]> {
  const admin = createServiceClient()
  const supabase = createPublicClient()
  const { data: moduleRow } = await supabase
    .from('tenant_modules')
    .select('config')
    .eq('tenant_id', tenantId)
    .eq('module_key', 'shop')
    .maybeSingle()
  const configured = parseShopConfig(moduleRow?.config).paymentMethods

  let stripeReady = false
  if (admin) {
    const [{ data: tenant }, { data: settings }] = await Promise.all([
      admin.from('tenants').select('stripe_charges_enabled').eq('id', tenantId).maybeSingle(),
      admin.from('tenant_settings').select('payments_enabled').eq('tenant_id', tenantId).maybeSingle(),
    ])
    stripeReady = (settings?.payments_enabled ?? false) && (tenant?.stripe_charges_enabled ?? false)
  }
  return availablePaymentMethods(configured, {
    stripeReady,
    paypalReady: commerceReleaseGate(tenantId).paypal && paypalReady(),
  })
}

/**
 * Betalsätt → Stripes `payment_method_types` (goal-64).
 *
 * Apple Pay har INGEN egen typ i Checkout: plånboken tänds automatiskt på `card` när
 * domänen är verifierad hos Stripe och köparen sitter i Safari/på en Apple-enhet.
 * Den mappas därför till 'card' — kunden ser sitt val, Stripe ser rätt räls.
 */
function stripeMethodTypes(method: ShopPaymentMethod | null): ('card' | 'swish' | 'klarna')[] {
  switch (method) {
    case 'swish':
      return ['swish']
    case 'klarna':
      return ['klarna']
    case 'applepay': // Apple Pay = card + verifierad domän (Stripe tänder plånboken själv)
    case 'card':
      return ['card']
    default:
      // Inget (eller okänt) val → låt Stripe visa vad kontot stödjer, som tidigare.
      return ['card']
  }
}

/**
 * Start a Stripe Checkout Session for an awaiting_payment order (Fas 3). DIRECT
 * charge on the salong's connected account, application_fee OMITTED ⇒ fee = 0
 * (samma modell som booking, 0007). Service-role (RLS-bypass; connected account-id
 * stannar server-side). Gatad av payments_enabled AND stripe_charges_enabled →
 * degraderar till { unavailable } när rälsen är av (= dagens default, dormant).
 */
export async function startShopCheckout(
  orderId: string,
  /** goal-64: kundens valda betalsätt → Stripes payment_method_types. Utelämnat = 'card'
   *  (oförändrat beteende för den gamla kassan). */
  method?: ShopPaymentMethod | null,
): Promise<CheckoutResult> {
  const ctx = await requireReleasedShopContext()
  if (!ctx) return { ok: false, reason: 'unavailable', message: 'Webshop är inte aktiverad ännu.' }
  if (!orderId) return { ok: false, reason: 'error', message: 'Saknar beställning.' }
  // Plan 009 SÄK-06: varje anrop skapar en Stripe Checkout-session — begränsa.
  const checkoutIp = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('shop_order', ctx.tenantId, checkoutIp), LIMITS.booking))) {
    return { ok: false, reason: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }

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
    // EN sträng-literal: Supabases typ-parser läser select-strängen statiskt, och en
    // uppbruten (+-konkatenerad) sträng gör hela raden otypad (GenericStringError).
    .select('id,total_cents,shipping_cents,currency,status,payment_method,shop_order_items(product_name,unit_price_cents,quantity)')
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
  const { error: stripePaymentError } = await admin.from('payments').upsert(
    { tenant_id: ctx.tenantId, order_id: orderId, amount_cents: amount, currency: 'sek', status: 'pending' },
    { onConflict: 'order_id' },
  )
  if (stripePaymentError) {
    return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }
  }

  const items = (order.shop_order_items ?? []) as { product_name: string; unit_price_cents: number; quantity: number }[]
  const lineItems = items.length
    ? items.map((it) => ({
        quantity: it.quantity,
        price_data: { currency: 'sek', unit_amount: it.unit_price_cents, product_data: { name: it.product_name } },
      }))
    : [{ quantity: 1, price_data: { currency: 'sek', unit_amount: amount, product_data: { name: 'Beställning' } } }]

  // FRAKTEN MÅSTE MED SOM EGEN RAD (goal-64). Utan den summerar Stripes rader till
  // DELSUMMAN medan vår order säger TOTAL — kunden hade betalat frakten på papperet
  // men inte i verkligheten. Beloppet är order.shipping_cents (uppslaget ur DB i
  // confirm_shop_order), aldrig något klienten skickat.
  const shippingCents = order.shipping_cents ?? 0
  if (shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency: 'sek', unit_amount: shippingCents, product_data: { name: 'Leverans' } },
    })
  }

  // Betalsättet: argumentet (kundens val i kassan) vinner, annars det som redan står på
  // ordern (satt av confirm_shop_order — server-side validerat).
  const chosen = (method ?? (order.payment_method as ShopPaymentMethod | null)) ?? null

  const origin = await requestOrigin()
  let session
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: lineItems,
        // goal-64: Kort · Swish · Klarna (Apple Pay rider på 'card'). Ett betalsätt som
        // kundens Stripe-konto inte har aktiverat får Stripe att svara med ett fel →
        // fångas nedan och blir "Kunde inte starta betalning" i stället för en trasig sida.
        payment_method_types: stripeMethodTypes(chosen),
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
  const { error: stripeSessionError } = await admin
    .from('payments')
    .update({ stripe_checkout_session_id: session.id })
    .eq('order_id', orderId)
  if (stripeSessionError) {
    return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }
  }
  return { ok: true, url: session.url }
}

/**
 * PAYPAL-kassan (goal-64). Skapar en PayPal-order på orderns SERVER-SIDE-total och
 * returnerar approve-länken. Kunden godkänner hos PayPal → skickas till
 * /api/paypal/retur → vi CAPTURE:ar → mark_shop_order_paid (idempotent).
 *
 * GATAD PÅ NYCKLARNA: utan PAYPAL_CLIENT_ID/SECRET → { unavailable }. Kassan visar
 * ändå aldrig PayPal som val i det läget (availablePaymentMethods filtrerar bort det);
 * den här grinden är andra linjen, för en klient som ändå försöker.
 *
 * Till skillnad från Stripe kräver den här rälsen INTE att kundens Stripe är kopplad —
 * PayPal går (v1) via plattformens konto. Se lib/payments/paypal.ts + docs/ops/paypal.md.
 */
export async function startPaypalCheckout(orderId: string): Promise<CheckoutResult> {
  const ctx = await requireReleasedShopContext()
  if (!ctx) return { ok: false, reason: 'unavailable', message: 'Webshop är inte aktiverad ännu.' }
  if (!orderId) return { ok: false, reason: 'error', message: 'Saknar beställning.' }
  if (!commerceReleaseGate(ctx.tenantId).paypal) {
    return { ok: false, reason: 'unavailable', message: 'PayPal är inte tillgängligt.' }
  }
  // Plan 009 SÄK-06: varje anrop skapar en PayPal-order hos providern — begränsa.
  const paypalIp = await getClientIp()
  if (!(await checkRateLimit(rateLimitKey('shop_order', ctx.tenantId, paypalIp), LIMITS.booking))) {
    return { ok: false, reason: 'error', message: 'För många försök. Vänta en stund och försök igen.' }
  }
  if (!paypalReady()) {
    return { ok: false, reason: 'unavailable', message: 'PayPal är inte tillgängligt.' }
  }

  const admin = createServiceClient()
  if (!admin) return { ok: false, reason: 'unavailable', message: 'PayPal är inte tillgängligt.' }

  // Ordern MÅSTE tillhöra denna tenant. Beloppet läses UR ORDERN (server-side uppslaget
  // i confirm_shop_order) — klienten skickar bara ett order-id.
  const { data: order } = await admin
    .from('shop_orders')
    .select('id, total_cents, currency, status, payment_status')
    .eq('id', orderId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()
  if (!order) return { ok: false, reason: 'error', message: 'Beställningen hittades inte.' }
  // 'awaiting_payment' = Stripe-gaten var på. 'pending' + obetald = butiken tar inte
  // betalt via Stripe men kunden valde PayPal → betalning är fortfarande giltig.
  if (!['awaiting_payment', 'pending'].includes(order.status) || order.payment_status === 'paid') {
    return { ok: false, reason: 'error', message: 'Beställningen kan inte betalas nu.' }
  }
  const amount = order.total_cents ?? 0
  if (amount <= 0) return { ok: false, reason: 'unavailable', message: 'Inget belopp att betala.' }

  const { error: paypalPaymentError } = await admin.from('payments').upsert(
    { tenant_id: ctx.tenantId, order_id: orderId, amount_cents: amount, currency: 'sek', status: 'pending' },
    { onConflict: 'order_id' }, // UNIQUE(order_id) = idempotensgrunden, samma som Stripe
  )
  if (paypalPaymentError) {
    return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }
  }

  const origin = await requestOrigin()
  const pp = await createPaypalOrder({
    amountCents: amount,
    currency: order.currency ?? 'SEK',
    reference: orderId,
    returnUrl: `${origin}/api/paypal/retur?order=${orderId}`,
    cancelUrl: `${origin}/bekraftelse/${orderId}?avbruten=1`,
  })
  if (!pp) return { ok: false, reason: 'error', message: 'Kunde inte starta betalning. Försök igen.' }

  return { ok: true, url: pp.approveUrl }
}
