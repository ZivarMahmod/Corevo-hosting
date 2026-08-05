// SINGLE source of truth for "ska denna bokning ta betalt online vid bokning?".
// Gate = payments_enabled (salongens master-toggle) AND stripe_charges_enabled
// (Connect-kontot redo). payment_mode (0001) ingår MEDVETET INTE — den styr
// kund-facing copy, inte charge-beslutet. Repointa ALLA call-sites hit så att
// klient ("kräver betalning") och server (skapar PaymentIntent) aldrig glider isär.

export type PaymentGate = {
  paymentsEnabled: boolean
  chargesEnabled: boolean
  releaseEnabled: boolean
  /** True ⇒ boka-flödet startar Stripe Checkout; annars "betala på plats". */
  canTakeOnline: boolean
}

export type PaymentSettingsStatus = {
  label: 'AV I PILOT' | 'Inte kopplat' | 'AV' | 'PÅ'
  tone: 'neutral' | 'success'
}

/** Pure form — used by the confirmation page where flags come from the RPC. */
export function paymentGateFromFlags(
  paymentsEnabled: boolean,
  chargesEnabled: boolean,
  releaseEnabled = false,
): PaymentGate {
  return {
    paymentsEnabled,
    chargesEnabled,
    releaseEnabled,
    canTakeOnline: paymentsEnabled && chargesEnabled && releaseEnabled,
  }
}

export function paymentSettingsStatus(gate: PaymentGate): PaymentSettingsStatus {
  if (!gate.releaseEnabled) return { label: 'AV I PILOT', tone: 'neutral' }
  if (!gate.chargesEnabled) return { label: 'Inte kopplat', tone: 'neutral' }
  if (!gate.paymentsEnabled) return { label: 'AV', tone: 'neutral' }
  return { label: 'PÅ', tone: 'success' }
}
