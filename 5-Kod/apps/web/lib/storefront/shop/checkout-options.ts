import 'server-only'

// KASSANS VAL — vad butiken FAKTISKT kan erbjuda (goal-64).
//
// Zivars regel, översatt till kod: "ett betalsätt som inte är konfigurerat visas INTE —
// hellre färre val än en knapp som ljuger." Den här modulen är det enda stället som
// avgör vad kassan får rita. Den korsar TRE sanningar:
//
//   1. Kundens VAL          — tenant_modules.config.payment_methods (vad de vill ta emot)
//   2. Kundens STRIPE       — payments_enabled ∧ stripe_charges_enabled (kort/swish/klarna/applepay)
//   3. Plattformens PAYPAL  — PAYPAL_CLIENT_ID/SECRET i miljön (kontot finns inte än)
//
// Bara det som passerar alla tre når kassan. Ett betalsätt kunden slagit på men vars
// räls inte är kopplad faller alltså tyst bort i stället för att bli en knapp som
// kraschar i betalsteget.

import { createServiceClient } from '@/lib/platform/service'
import { paypalReady } from '@/lib/payments/paypal'
import { commerceReleaseGate } from '@/lib/release/commerce'
import { loadShippingOptions } from './shipping'
import {
  availablePaymentMethods,
  type ShippingOption,
  type ShopConfig,
  type ShopPaymentMethod,
} from './types'

export type CheckoutOptions = {
  /** Kundens leveransval (tom lista = inget val-steg, frakt 0 — dagens beteende). */
  shippingOptions: ShippingOption[]
  /** Betalsätt som är BÅDE påslagna och kopplade. Tom = "betala vid leverans". */
  paymentMethods: ShopPaymentMethod[]
}

/**
 * Vad den här butikens kassa får erbjuda just nu. Anropas av kassa-sidan (server) och
 * skickas som props ner i mallens kassa-vy — vyn får ALDRIG räkna ut det här själv.
 */
export async function loadCheckoutOptions(
  tenantId: string,
  slug: string,
  config: ShopConfig,
): Promise<CheckoutOptions> {
  const release = commerceReleaseGate(tenantId)
  const [shippingOptions, stripeReady] = await Promise.all([
    loadShippingOptions(tenantId, slug),
    tenantStripeReady(tenantId),
  ])
  return {
    shippingOptions,
    paymentMethods: availablePaymentMethods(config.paymentMethods, {
      stripeReady,
      paypalReady: release.paypal && paypalReady(),
    }),
  }
}

/**
 * Tar kundens Stripe-koppling FAKTISKT emot pengar? Exakt samma dubbla grind som
 * confirm_shop_order (0042) och startShopCheckout: ägaren måste ha slagit PÅ betalningar
 * OCH Stripe måste ha godkänt kontot (charges_enabled). Service-klienten krävs — anon
 * kommer inte in i tenant_settings, och flaggorna får inte läcka till klienten.
 * Ingen service-klient (lokalt/CI utan secrets) → false, dvs. degradera till obetalt.
 */
/**
 * Rälsernas status för ADMIN-ytan (goal-64): är Stripe kopplad, finns PayPal-nycklarna?
 * Admin visar en toggle per betalsätt — men en toggle utan besked om varför betalsättet
 * inte syns i kassan är en fälla. Därför får admin samma sanning som kassan.
 */
export async function shopRailsStatus(
  tenantId: string,
): Promise<{ stripeReady: boolean; paypalReady: boolean }> {
  const release = commerceReleaseGate(tenantId)
  return {
    stripeReady: release.shop && (await tenantStripeReady(tenantId)),
    paypalReady: release.paypal && paypalReady(),
  }
}

async function tenantStripeReady(tenantId: string): Promise<boolean> {
  const admin = createServiceClient()
  if (!admin) return false
  const [{ data: tenant }, { data: settings }] = await Promise.all([
    admin.from('tenants').select('stripe_charges_enabled').eq('id', tenantId).maybeSingle(),
    admin.from('tenant_settings').select('payments_enabled').eq('tenant_id', tenantId).maybeSingle(),
  ])
  return (settings?.payments_enabled ?? false) && (tenant?.stripe_charges_enabled ?? false)
}
