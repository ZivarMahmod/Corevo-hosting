export type CommerceReleaseGate = {
  shop: boolean
  presentkort: boolean
  paypal: boolean
  bookingPayment: boolean
}

type ReleaseEnvironment = Record<string, string | undefined>

const SETTLEMENT_ACCEPTED = 'settlement-v1-verified'
const PAYPAL_ACCEPTED = 'partner-v1-reviewed'

function tenantIsAllowlisted(raw: string | undefined, tenantId: string): boolean {
  const wanted = tenantId.trim().toLowerCase()
  if (!wanted) return false
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(wanted)
}

/**
 * Code-level release fence for money-bearing flows that are outside the first
 * booking-only pilot. A DB module toggle, Stripe connection or provider secret
 * can never open these paths by itself: the reviewed release acknowledgement
 * and the exact tenant allowlist must both be present.
 */
export function commerceReleaseGate(
  tenantId: string,
  env: ReleaseEnvironment = process.env,
): CommerceReleaseGate {
  const commerce =
    env.COREVO_COMMERCE_RELEASE === SETTLEMENT_ACCEPTED &&
    tenantIsAllowlisted(env.COREVO_COMMERCE_TENANT_IDS, tenantId)
  const bookingPayment =
    env.COREVO_BOOKING_PAYMENT_RELEASE === SETTLEMENT_ACCEPTED &&
    tenantIsAllowlisted(env.COREVO_BOOKING_PAYMENT_TENANT_IDS, tenantId)
  const paypal =
    commerce &&
    env.COREVO_PAYPAL_RELEASE === PAYPAL_ACCEPTED &&
    tenantIsAllowlisted(env.COREVO_PAYPAL_TENANT_IDS, tenantId)

  return {
    shop: commerce,
    presentkort: commerce,
    paypal,
    bookingPayment,
  }
}
