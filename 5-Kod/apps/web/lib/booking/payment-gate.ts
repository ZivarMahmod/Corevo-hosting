import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@corevo/db'

// SINGLE source of truth for "ska denna bokning ta betalt online vid bokning?".
// Gate = payments_enabled (salongens master-toggle) AND stripe_charges_enabled
// (Connect-kontot redo). payment_mode (0001) ingår MEDVETET INTE — den styr
// kund-facing copy, inte charge-beslutet. Repointa ALLA call-sites hit så att
// klient ("kräver betalning") och server (skapar PaymentIntent) aldrig glider isär.

export type PaymentGate = {
  paymentsEnabled: boolean
  chargesEnabled: boolean
  /** True ⇒ boka-flödet startar Stripe Checkout; annars "betala på plats". */
  canTakeOnline: boolean
}

/** Pure form — used by the confirmation page where flags come from the RPC. */
export function paymentGateFromFlags(paymentsEnabled: boolean, chargesEnabled: boolean): PaymentGate {
  return { paymentsEnabled, chargesEnabled, canTakeOnline: paymentsEnabled && chargesEnabled }
}

/** Read the gate for a tenant (works with the anon public client or service-role). */
export async function getPaymentGate(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<PaymentGate> {
  const [{ data: settings }, { data: tenant }] = await Promise.all([
    supabase.from('tenant_settings').select('payments_enabled').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('tenants').select('stripe_charges_enabled').eq('id', tenantId).maybeSingle(),
  ])
  return paymentGateFromFlags(
    settings?.payments_enabled ?? false,
    tenant?.stripe_charges_enabled ?? false,
  )
}
